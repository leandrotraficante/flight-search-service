// Importamos los DTOs del módulo search
import { SearchFlightsRequestDto } from '../dto/search-flights-request.dto';
import { FlightDto } from '../dto/flight.dto';

// Interfaz que define el contrato que deben cumplir todos los proveedores de vuelos
// Esta interfaz permite que SearchService trabaje con múltiples proveedores (Amadeus, Skyscanner, etc.)
// de forma desacoplada, sin conocer los detalles específicos de cada proveedor
export interface IFlightProvider {
  // Busca vuelos según los parámetros proporcionados
  // Parámetro: params - Parámetros de búsqueda normalizados (SearchFlightsRequestDto)
  // Retorna: Promise<FlightDto[]> - Array de vuelos normalizados e independientes del proveedor
  // Lanza: Error - Si hay problemas al buscar vuelos (red, autenticación, etc.)
  searchFlights(params: SearchFlightsRequestDto): Promise<FlightDto[]>;

  // Identificador único del proveedor (ej: "amadeus", "skyscanner")
  // Permite identificar qué proveedor se usó para una búsqueda específica
  // Útil para logging, métricas y debugging
  readonly providerName: string;
}
