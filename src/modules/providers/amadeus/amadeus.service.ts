import { Injectable } from '@nestjs/common';
// Importamos el cliente HTTP de Amadeus para hacer peticiones a la API
import { AmadeusClient } from './amadeus.client';
import { LoggerService } from '../../../infra/logging/logger.service';
// Importamos el DTO de request para validar y tipar los parámetros de búsqueda
import { AmadeusFlightOffersRequestDto } from './dto/amadeus-flight-offers-req.dto';
// Importamos el DTO de response para tipar la respuesta de Amadeus
import { AmadeusFlightOffersResponseDto } from './dto/amadeus-flight-offers-res.dto';
// Importamos las constantes de endpoints de Amadeus
import { AMADEUS_ENDPOINTS } from './amadeus.types';
// Importamos el mapper para normalizar las respuestas de Amadeus
import {
  mapAmadeusFlightOffersResponseToNormalized,
  NormalizedFlightDto,
} from './mappers/amadeus-flight-offers.mappers';
// Importamos el tipo de error de Amadeus para manejo de errores
import { AmadeusApiError } from './amadeus.types';
// Importamos la interfaz del proveedor de vuelos para implementarla
import { IFlightProvider } from '../../search/interfaces/flight-provider.interface';
// Importamos los DTOs del módulo search para la interfaz
import { SearchFlightsRequestDto } from '../../search/dto/search-flights-request.dto';
import { FlightDto } from '../../search/dto/flight.dto';
// Importamos el mapper de search para convertir NormalizedFlightDto a FlightDto
import { mapNormalizedFlightsToFlightDtos } from '../../search/mappers/flight.mapper';

@Injectable()
export class AmadeusService implements IFlightProvider {
  // Implementamos la propiedad readonly requerida por IFlightProvider
  readonly providerName = 'amadeus';
  constructor(
    // Cliente HTTP de Amadeus para hacer peticiones a la API
    // Este cliente maneja automáticamente autenticación, retry, circuit breaker, etc.
    private readonly client: AmadeusClient,
    private readonly logger: LoggerService,
  ) {
    // Establecemos el contexto del logger para que todos los logs de este servicio tengan el mismo contexto
    this.logger.setContext(AmadeusService.name);
  }

  // Método interno que busca vuelos usando el formato específico de Amadeus
  // Este método mantiene la compatibilidad con código que ya usa AmadeusFlightOffersRequestDto
  // Parámetro: params - Parámetros en formato específico de Amadeus
  // Retorna: Promise<NormalizedFlightDto[]> - Array de vuelos normalizados de Amadeus
  // Lanza: AmadeusApiError - Si Amadeus retorna un error o hay problemas de red
  async searchFlightsInternal(
    params: AmadeusFlightOffersRequestDto,
  ): Promise<NormalizedFlightDto[]> {
    this.logger.info('Iniciando búsqueda de vuelos en Amadeus', undefined, {
      origin: params.originLocationCode,
      destination: params.destinationLocationCode,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      adults: params.adults,
    });

    try {
      // Convertimos los parámetros de búsqueda a query params para la URL
      // Amadeus espera los parámetros como query string en la URL
      const queryParams = this.buildQueryParams(params);

      // Hacemos la petición GET a Amadeus usando el cliente HTTP
      // El cliente maneja automáticamente: autenticación, retry, circuit breaker, timeout
      // Retorna AmadeusFlightOffersResponseDto con la estructura completa de Amadeus
      const response = await this.client.get<AmadeusFlightOffersResponseDto>(
        AMADEUS_ENDPOINTS.FLIGHT_OFFERS, // Endpoint: '/v2/shopping/flight-offers'
        {
          // Query params que se agregan a la URL como ?originLocationCode=JFK&destinationLocationCode=LAX&...
          params: queryParams,
        },
      );

      // Validamos que la respuesta tenga la estructura esperada
      // Esto previene errores en runtime si Amadeus retorna una estructura inesperada
      if (!response || typeof response !== 'object') {
        throw new AmadeusApiError(
          {
            errors: [
              {
                code: 0,
                title: 'Invalid Response',
                detail: 'La respuesta de Amadeus no tiene la estructura esperada',
                status: 500,
              },
            ],
          },
          500,
        );
      }

      // Validamos que response.data sea un array
      // Amadeus siempre retorna un array en data, incluso si está vacío
      if (!Array.isArray(response.data)) {
        throw new AmadeusApiError(
          {
            errors: [
              {
                code: 0,
                title: 'Invalid Response',
                detail: 'La respuesta de Amadeus no contiene un array de vuelos válido',
                status: 500,
              },
            ],
          },
          500,
        );
      }

      // Logging debug para saber cuántos resultados recibimos
      this.logger.debug('Respuesta recibida de Amadeus', undefined, {
        resultsCount: response.data.length,
        meta: response.meta || null,
      });

      // Validamos la estructura de cada vuelo antes de mapear
      // Esto previene errores en el mapper si algún vuelo tiene estructura incorrecta
      for (const offer of response.data) {
        // Validar que el vuelo tenga ID
        if (!offer.id) {
          this.logger.error('Vuelo sin ID en respuesta de Amadeus', undefined, undefined, {
            offer,
          });
          throw new AmadeusApiError(
            {
              errors: [
                {
                  code: 0,
                  title: 'Invalid Flight Offer',
                  detail: 'Vuelo sin ID en respuesta de Amadeus',
                  status: 500,
                },
              ],
            },
            500,
          );
        }

        // Validar que el vuelo tenga precio válido
        if (!offer.price || !offer.price.total || !offer.price.currency) {
          this.logger.error(`Vuelo ${offer.id} sin precio válido`, undefined, undefined, {
            offerId: offer.id,
            price: offer.price,
          });
          throw new AmadeusApiError(
            {
              errors: [
                {
                  code: 0,
                  title: 'Invalid Flight Offer',
                  detail: `Vuelo ${offer.id} sin precio válido`,
                  status: 500,
                },
              ],
            },
            500,
          );
        }

        // Validar que el vuelo tenga itinerarios
        if (
          !offer.itineraries ||
          !Array.isArray(offer.itineraries) ||
          offer.itineraries.length === 0
        ) {
          this.logger.error(`Vuelo ${offer.id} sin itinerarios`, undefined, undefined, {
            offerId: offer.id,
            itineraries: offer.itineraries,
          });
          throw new AmadeusApiError(
            {
              errors: [
                {
                  code: 0,
                  title: 'Invalid Flight Offer',
                  detail: `Vuelo ${offer.id} sin itinerarios`,
                  status: 500,
                },
              ],
            },
            500,
          );
        }

        // Validar que cada itinerario tenga segmentos
        for (const itinerary of offer.itineraries) {
          if (
            !itinerary.segments ||
            !Array.isArray(itinerary.segments) ||
            itinerary.segments.length === 0
          ) {
            this.logger.error(
              `Vuelo ${offer.id} tiene itinerario sin segmentos`,
              undefined,
              undefined,
              {
                offerId: offer.id,
                itinerary,
              },
            );
            throw new AmadeusApiError(
              {
                errors: [
                  {
                    code: 0,
                    title: 'Invalid Flight Offer',
                    detail: `Vuelo ${offer.id} tiene itinerario sin segmentos`,
                    status: 500,
                  },
                ],
              },
              500,
            );
          }
        }
      }

      // Normalizamos la respuesta usando el mapper
      // El mapper transforma la estructura compleja de Amadeus a una estructura simple y normalizada
      // Esto permite que el resto de la aplicación no dependa de la estructura específica de Amadeus
      const normalizedFlights = mapAmadeusFlightOffersResponseToNormalized(response);

      this.logger.info('Búsqueda de vuelos completada exitosamente', undefined, {
        flightsFound: normalizedFlights.length,
        origin: params.originLocationCode,
        destination: params.destinationLocationCode,
      });

      return normalizedFlights;
    } catch (error) {
      // El error puede venir de:
      // - AmadeusClient (error de red, timeout, circuit breaker abierto)
      // - AmadeusApiError (error estructurado de Amadeus: 400, 401, 429, 500, etc.)

      this.logger.error(
        'Error al buscar vuelos en Amadeus',
        error instanceof Error ? error.stack : undefined,
        undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          origin: params.originLocationCode,
          destination: params.destinationLocationCode,
          departureDate: params.departureDate,
        },
      );

      // Si el error es un AmadeusApiError (error estructurado de Amadeus), lo relanzamos tal cual
      // Esto permite que el código que llama a este método pueda manejar errores específicos de Amadeus
      if (error instanceof AmadeusApiError) {
        throw error;
      }

      // Si es cualquier otro error, lo envolvemos en un AmadeusApiError genérico
      // Esto asegura que siempre retornamos un tipo de error conocido
      // Extraemos el mensaje del error de forma segura, manejando diferentes tipos de errores
      let errorMessage = 'Error desconocido al buscar vuelos';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Si el error es un objeto, intentamos extraer el mensaje de diferentes formas
        const errorObj = error as Record<string, unknown>;
        const message =
          typeof errorObj.message === 'string'
            ? errorObj.message
            : typeof errorObj.detail === 'string'
              ? errorObj.detail
              : typeof errorObj.error === 'string'
                ? errorObj.error
                : JSON.stringify(errorObj);
        errorMessage = message;
      }

      throw new AmadeusApiError(
        {
          errors: [
            {
              code: 0, // Código 0 indica error desconocido
              title: 'Search Error',
              detail: errorMessage,
              status: 500, // Internal Server Error por defecto
            },
          ],
        },
        500,
      );
    }
  }

  // Construye los query params para la petición a Amadeus
  // Convierte el DTO de request a un objeto de query params que Axios puede usar
  // Parámetro: params - Parámetros de búsqueda validados
  // Retorna: Objeto con los query params para Axios
  private buildQueryParams(
    params: AmadeusFlightOffersRequestDto,
  ): Record<string, string | number | string[] | undefined> {
    // Creamos un objeto con los query params
    // Solo incluimos los campos que tienen valor (no undefined)
    const queryParams: Record<string, string | number | string[] | undefined> = {
      // Parámetros requeridos
      originLocationCode: params.originLocationCode,
      destinationLocationCode: params.destinationLocationCode,
      departureDate: params.departureDate,
      adults: params.adults,
    };

    // Parámetros opcionales: solo los agregamos si tienen valor
    if (params.returnDate) {
      queryParams.returnDate = params.returnDate;
    }

    if (params.children !== undefined && params.children > 0) {
      queryParams.children = params.children;
    }

    if (params.infants !== undefined && params.infants > 0) {
      queryParams.infants = params.infants;
    }

    if (params.max !== undefined) {
      queryParams.max = params.max;
    }

    if (params.travelClass) {
      queryParams.travelClass = params.travelClass;
    }

    if (params.includedAirlineCodes && params.includedAirlineCodes.length > 0) {
      // Amadeus espera los códigos de aerolíneas como string separado por comas
      // Ejemplo: "AA,DL" en lugar de ["AA", "DL"]
      queryParams.includedAirlineCodes = params.includedAirlineCodes.join(',');
    }

    if (params.excludedAirlineCodes && params.excludedAirlineCodes.length > 0) {
      // Amadeus espera los códigos de aerolíneas como string separado por comas
      queryParams.excludedAirlineCodes = params.excludedAirlineCodes.join(',');
    }

    if (params.currencyCode) {
      queryParams.currencyCode = params.currencyCode;
    }

    // Filtramos los valores undefined para evitar que Axios los serialice como "undefined" en la URL
    // Axios puede convertir undefined a string "undefined" en la query string, lo cual es incorrecto
    const filteredParams: Record<string, string | number | string[]> = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
    }

    // Retornamos el objeto de query params sin valores undefined
    return filteredParams;
  }

  // Implementación de IFlightProvider.searchFlights()
  // Este método permite que AmadeusService funcione como un proveedor genérico
  // Recibe parámetros normalizados de la API pública y retorna FlightDto[]
  // Parámetro: params - Parámetros de búsqueda normalizados desde la API pública
  // Retorna: Promise<FlightDto[]> - Array de vuelos normalizados del dominio de búsqueda
  // Lanza: Error - Si hay problemas al buscar vuelos (red, autenticación, etc.)
  async searchFlights(params: SearchFlightsRequestDto): Promise<FlightDto[]> {
    // Convertimos los parámetros de la API pública a formato de Amadeus
    const amadeusParams = this.convertFromSearchParams(params);

    // Llamamos al método interno que busca en Amadeus
    // Este método retorna NormalizedFlightDto[] (formato intermedio de Amadeus)
    const normalizedFlights = await this.searchFlightsInternal(amadeusParams);

    // Convertimos NormalizedFlightDto[] a FlightDto[] usando el mapper de search
    // Esto adapta la estructura de Amadeus a la estructura del dominio de búsqueda
    const flights = mapNormalizedFlightsToFlightDtos(normalizedFlights);

    return flights;
  }

  // Convierte SearchFlightsRequestDto (API pública) a AmadeusFlightOffersRequestDto (formato Amadeus)
  // Este método adapta los nombres de campos entre la API pública y el proveedor
  // Parámetro: params - Parámetros de la API pública
  // Retorna: AmadeusFlightOffersRequestDto - Parámetros en formato de Amadeus
  private convertFromSearchParams(params: SearchFlightsRequestDto): AmadeusFlightOffersRequestDto {
    const amadeusParams = new AmadeusFlightOffersRequestDto();

    // Mapeamos los campos requeridos
    amadeusParams.originLocationCode = params.origin.toUpperCase();
    amadeusParams.destinationLocationCode = params.destination.toUpperCase();
    amadeusParams.departureDate = params.departureDate;
    amadeusParams.adults = params.adults;

    // Mapeamos los campos opcionales si existen
    if (params.returnDate) {
      amadeusParams.returnDate = params.returnDate;
    }

    if (params.children !== undefined) {
      amadeusParams.children = params.children;
    }

    if (params.infants !== undefined) {
      amadeusParams.infants = params.infants;
    }

    if (params.maxResults !== undefined) {
      amadeusParams.max = params.maxResults;
    }

    if (params.travelClass) {
      amadeusParams.travelClass = params.travelClass;
    }

    if (params.includedAirlines && params.includedAirlines.length > 0) {
      amadeusParams.includedAirlineCodes = params.includedAirlines;
    }

    if (params.excludedAirlines && params.excludedAirlines.length > 0) {
      amadeusParams.excludedAirlineCodes = params.excludedAirlines;
    }

    if (params.currency) {
      amadeusParams.currencyCode = params.currency;
    }

    return amadeusParams;
  }
}
