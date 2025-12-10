// Importamos los DTOs normalizados de Amadeus que vienen del mapper de Amadeus
import { NormalizedFlightDto } from '../../providers/amadeus/mappers/amadeus-flight-offers.mappers';
// Importamos los DTOs del módulo search que representan el dominio de búsqueda
import { FlightDto } from '../dto/flight.dto';

// Convierte un vuelo normalizado de Amadeus a un FlightDto del módulo search
// Este mapper adapta la estructura de Amadeus a la estructura del dominio de búsqueda
// Parámetro: normalized - Vuelo normalizado de Amadeus (NormalizedFlightDto)
// Retorna: FlightDto - Vuelo en formato del módulo search
function mapNormalizedFlightToFlightDto(normalized: NormalizedFlightDto): FlightDto {
  return {
    // ID del vuelo se mantiene igual
    id: normalized.id,
    // Precio: convertimos NormalizedPriceDto a PriceDto (misma estructura, solo adaptamos nombres)
    price: {
      amount: normalized.price.amount,
      currency: normalized.price.currency,
    },
    // Segmentos: convertimos cada NormalizedSegmentDto a SegmentDto
    segments: normalized.segments.map((segment) => ({
      // Información de salida: adaptamos la estructura
      departure: {
        airport: segment.departure.airport,
        time: segment.departure.time,
        terminal: segment.departure.terminal,
      },
      // Información de llegada: adaptamos la estructura
      arrival: {
        airport: segment.arrival.airport,
        time: segment.arrival.time,
        terminal: segment.arrival.terminal,
      },
      // Duración: NormalizedSegmentDto usa "duration" (minutos), SegmentDto usa "durationMinutes"
      durationMinutes: segment.duration,
      // Aerolínea y número de vuelo se mantienen iguales
      airline: segment.airline,
      flightNumber: segment.flightNumber,
    })),
    // Duración total: NormalizedFlightDto usa "duration" (minutos), FlightDto usa "durationMinutes"
    durationMinutes: normalized.duration,
    // Aerolíneas se mantienen iguales
    airlines: normalized.airlines,
    // Proveedor se mantiene igual
    provider: normalized.provider,
  };
}

// Convierte un array de vuelos normalizados de Amadeus a un array de FlightDto del módulo search
// Esta es la función principal que se usa desde SearchService
// Parámetro: normalizedFlights - Array de vuelos normalizados de Amadeus
// Retorna: FlightDto[] - Array de vuelos en formato del módulo search
export function mapNormalizedFlightsToFlightDtos(
  normalizedFlights: NormalizedFlightDto[],
): FlightDto[] {
  // Mapeamos cada vuelo normalizado a un FlightDto usando la función helper
  return normalizedFlights.map(mapNormalizedFlightToFlightDto);
}
