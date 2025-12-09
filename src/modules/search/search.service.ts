import { Inject, Injectable, BadRequestException } from '@nestjs/common';
// Importamos la interfaz del proveedor en lugar de la implementación específica
// Esto desacopla SearchService de AmadeusService, permitiendo agregar más proveedores fácilmente
// Usamos 'import type' porque solo necesitamos el tipo para la inyección de dependencias
import type { IFlightProvider } from './interfaces/flight-provider.interface';
import { CacheService } from '../../infra/cache/cache.service';
import { LoggerService } from '../../infra/logging/logger.service';
import { SearchFlightsRequestDto } from './dto/search-flights-request.dto';
import { SearchFlightsResponseDto } from './dto/search-flights-response.dto';
import { FlightDto } from './dto/flight.dto';

@Injectable()
export class SearchService {
  constructor(
    // Usamos @Inject con el token 'IFlightProvider' para inyectar AmadeusService como IFlightProvider
    // Esto permite que SearchService trabaje con cualquier proveedor que implemente la interfaz
    // En el futuro, podrías cambiar la implementación en SearchModule sin tocar SearchService
    @Inject('IFlightProvider')
    private readonly flightProvider: IFlightProvider,
    // Servicio de cache para almacenar y recuperar resultados de búsqueda
    private readonly cache: CacheService,
    // Servicio de logging para registrar eventos y errores
    private readonly logger: LoggerService,
  ) {
    // Establecemos el contexto del logger para que todos los logs tengan el mismo contexto
    this.logger.setContext(SearchService.name);
  }

  // Este método orquesta toda la búsqueda: cache, conversión de parámetros, llamada al proveedor, mapeo
  // Parámetro: params - Parámetros de búsqueda validados desde la API pública
  // Retorna: Promise<SearchFlightsResponseDto> - Respuesta con vuelos encontrados y metadatos
  async searchFlights(params: SearchFlightsRequestDto): Promise<SearchFlightsResponseDto> {
    const startTime = Date.now(); // start time es para medir el tiempo de respuesta de la búsqueda

    this.logger.info('Iniciando búsqueda de vuelos', undefined, {
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      adults: params.adults,
    });

    try {
      // Generamos la clave de cache basada en los parámetros de búsqueda
      // Esta clave identifica de forma única esta búsqueda específica
      const cacheKey = this.buildCacheKey(params);

      // Calculamos el TTL (Time To Live) del cache según la fecha del vuelo
      // Vuelos futuros (>7 días): 24 horas
      // Vuelos próximos (1-7 días): 6 horas
      // Vuelos hoy: 1 hora
      const ttlSeconds = this.calculateCacheTtl(params);

      // Usamos CacheService.wrap() para implementar el patrón cache-aside
      // Si existe en cache, retorna inmediatamente
      // Si no existe, ejecuta la función, guarda el resultado y lo retorna
      // Flag para trackear si los datos vienen del cache
      // Si el callback se ejecuta, significa cache miss (fromCache = false)
      // Si el callback NO se ejecuta, significa cache hit (fromCache = true)
      let fromCache = true;
      const flights = await this.cache.wrap<FlightDto[]>(cacheKey, ttlSeconds, async () => {
        // Esta función se ejecuta solo si no hay cache (cache miss)
        // Marcamos que NO vino del cache
        fromCache = false;
        this.logger.debug('Cache miss, buscando en proveedor', undefined, {
          cacheKey,
          provider: this.flightProvider.providerName,
        });

        // Llamamos al proveedor usando la interfaz IFlightProvider
        // El proveedor (AmadeusService) se encarga internamente de:
        // - Convertir SearchFlightsRequestDto a su formato específico
        // - Hacer la petición HTTP
        // - Normalizar la respuesta
        // - Convertir a FlightDto[]
        // SearchService no necesita conocer estos detalles
        const flights = await this.flightProvider.searchFlights(params);

        // Logging debug para saber cuántos vuelos encontramos
        this.logger.debug('Vuelos encontrados en proveedor', undefined, {
          count: flights.length,
          provider: this.flightProvider.providerName,
        });

        return flights;
      });

      // Calculamos el tiempo de respuesta
      const responseTimeMs = Date.now() - startTime;

      // Logging info para registrar que la búsqueda fue exitosa
      this.logger.info('Búsqueda de vuelos completada exitosamente', undefined, {
        flightsFound: flights.length,
        origin: params.origin,
        destination: params.destination,
        responseTimeMs,
        fromCache, // Ahora trackeamos correctamente si vino del cache
      });

      // Retornamos la respuesta con los vuelos y metadatos
      return {
        flights,
        count: flights.length,
        meta: {
          responseTimeMs,
          provider: this.flightProvider.providerName,
          searchedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      // Si hay un error, lo manejamos aquí
      const responseTimeMs = Date.now() - startTime;

      // Logging de error con detalles para debugging
      this.logger.error(
        'Error al buscar vuelos',
        error instanceof Error ? error.stack : undefined,
        undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          origin: params.origin,
          destination: params.destination,
          departureDate: params.departureDate,
          responseTimeMs,
        },
      );

      // Relanzamos el error para que el controller lo maneje
      throw error;
    }
  }

  // Construye la clave de cache basada en los parámetros de búsqueda
  // La clave debe ser única para cada combinación de parámetros
  // Parámetro: params - Parámetros de búsqueda
  // Retorna: string - Clave de cache única
  private buildCacheKey(params: SearchFlightsRequestDto): string {
    // Usamos composeKey para construir una clave consistente
    // Formato: search:flights:{origin}:{destination}:{departureDate}:{returnDate}:{adults}:{children}:{infants}
    const keyParts = [
      'search',
      'flights',
      params.origin.toUpperCase(),
      params.destination.toUpperCase(),
      params.departureDate,
      params.returnDate || 'oneway',
      params.adults.toString(),
      (params.children || 0).toString(),
      (params.infants || 0).toString(),
      params.travelClass || 'all',
      params.maxResults?.toString() || 'default',
      params.currency || 'default',
      // Incluimos aerolíneas si están especificadas (ordenadas para consistencia)
      params.includedAirlines ? [...params.includedAirlines].sort().join(',') : 'all',
      params.excludedAirlines ? [...params.excludedAirlines].sort().join(',') : 'none',
    ];

    return this.cache.composeKey(...keyParts);
  }

  // Calcula el TTL del cache según la fecha del vuelo
  // Vuelos futuros (>7 días): 24 horas (datos menos dinámicos)
  // Vuelos próximos (1-7 días): 6 horas (datos más dinámicos)
  // Vuelos hoy: 1 hora (datos muy dinámicos)
  // Si hay returnDate, usa la fecha más cercana (departureDate o returnDate) para calcular el TTL
  // Parámetro: params - Parámetros de búsqueda que incluyen departureDate y opcionalmente returnDate
  // Retorna: number - TTL en segundos
  private calculateCacheTtl(params: SearchFlightsRequestDto): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizamos a medianoche para comparar solo fechas

    // Validamos y parseamos departureDate
    const departure = new Date(params.departureDate);
    if (isNaN(departure.getTime())) {
      throw new BadRequestException('departureDate debe ser una fecha válida');
    }
    departure.setHours(0, 0, 0, 0);

    // Validamos que departureDate no sea una fecha pasada
    const diffTimeDeparture = departure.getTime() - today.getTime();
    const diffDaysDeparture = Math.ceil(diffTimeDeparture / (1000 * 60 * 60 * 24));
    if (diffDaysDeparture < 0) {
      throw new BadRequestException('departureDate no puede ser una fecha pasada');
    }

    // Si hay returnDate, validamos y usamos la fecha más cercana
    let diffDays = diffDaysDeparture;

    if (params.returnDate) {
      const returnDate = new Date(params.returnDate);
      if (isNaN(returnDate.getTime())) {
        throw new BadRequestException('returnDate debe ser una fecha válida');
      }
      returnDate.setHours(0, 0, 0, 0);

      // Validamos que returnDate no sea una fecha pasada
      const diffTimeReturn = returnDate.getTime() - today.getTime();
      const diffDaysReturn = Math.ceil(diffTimeReturn / (1000 * 60 * 60 * 24));
      if (diffDaysReturn < 0) {
        throw new BadRequestException('returnDate no puede ser una fecha pasada');
      }

      // Validamos que returnDate sea posterior a departureDate
      if (returnDate.getTime() < departure.getTime()) {
        throw new BadRequestException('returnDate debe ser posterior a departureDate');
      }

      // Usamos la fecha más cercana (menor diferencia con today) para calcular el TTL
      // Esto asegura que el TTL refleje la urgencia del vuelo más próximo
      if (diffDaysReturn < diffDaysDeparture) {
        diffDays = diffDaysReturn;
      }
    }

    // Aplicamos TTL según los días hasta el vuelo (usando la fecha más cercana)
    if (diffDays > 7) {
      // Vuelos futuros: 24 horas (86400 segundos)
      return 86400;
    } else if (diffDays >= 1) {
      // Vuelos próximos: 6 horas (21600 segundos)
      return 21600;
    } else {
      // Vuelos hoy: 1 hora (3600 segundos)
      return 3600;
    }
  }
}
