import { Controller, Get, Query, HttpCode, HttpStatus, ParseArrayPipe, Optional } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchFlightsRequestDto } from './dto/search-flights-request.dto';
import { SearchFlightsResponseDto } from './dto/search-flights-response.dto';

// Decorador que define la ruta base del controlador: todas las rutas empezarán con /search
@Controller('search')
// Clase del controlador que maneja las peticiones de búsqueda de vuelos
export class SearchController {
  constructor(
    // Inyectamos SearchService que contiene toda la lógica de negocio
    // SearchService se encarga de: cache, llamar al proveedor, mapear resultados
    private readonly searchService: SearchService,
  ) {}

  // GET /search/flights?origin=JFK&destination=LAX&departureDate=2024-12-25&adults=1
  // Endpoint principal para buscar vuelos
  // Los parámetros van en query string porque son filtros de búsqueda
  // ValidationPipe está configurado globalmente en main.ts, por lo que valida automáticamente
  @Get('flights')
  // Decorador que especifica el código de estado HTTP de respuesta (200 OK)
  @HttpCode(HttpStatus.OK)
  // Método asíncrono que recibe los parámetros de búsqueda desde query params
  // ValidationPipe global transforma automáticamente los query params al DTO y valida
  // Si la validación falla, retorna 400 Bad Request con los errores de validación
  // Parámetro: query - Parámetros de búsqueda validados y transformados a SearchFlightsRequestDto
  // Retorna: Promise<SearchFlightsResponseDto> - Respuesta con vuelos encontrados y metadatos
  async searchFlights(@Query() query: SearchFlightsRequestDto): Promise<SearchFlightsResponseDto> {
    // Llamamos a SearchService que orquesta toda la búsqueda:
    // 1. Verifica cache
    // 2. Si no hay cache, llama al proveedor (AmadeusService)
    // 3. Mapea los resultados a FlightDto[]
    // 4. Retorna la respuesta con metadatos
    const result = await this.searchService.searchFlights(query);

    // Retornamos la respuesta directamente
    // NestJS serializa automáticamente el objeto a JSON
    return result;
  }
}
