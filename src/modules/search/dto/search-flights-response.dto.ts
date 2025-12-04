// Importamos el DTO de vuelo que ya definimos
import { FlightDto } from './flight.dto';

// DTO para la respuesta de búsqueda de vuelos desde la API pública
// Este DTO envuelve los resultados de la búsqueda con metadatos opcionales
export interface SearchFlightsResponseDto {
  // Array de vuelos encontrados que coinciden con los criterios de búsqueda
  // Cada vuelo está normalizado e independiente del proveedor (Amadeus, Skyscanner, etc.)
  flights: FlightDto[];

  // Número total de vuelos encontrados
  // Es igual a flights.length, pero se incluye para facilitar el parsing en el cliente
  count: number;

  // Metadatos opcionales de la búsqueda
  // Puede incluir información adicional como tiempo de respuesta, proveedor usado, etc.
  meta?: {
    // Tiempo de respuesta en milisegundos (opcional)
    responseTimeMs?: number;
    // Proveedor que se usó para esta búsqueda (opcional, útil cuando hay múltiples proveedores)
    provider?: string;
    // Timestamp de cuándo se realizó la búsqueda (opcional)
    searchedAt?: string;
  };
}
