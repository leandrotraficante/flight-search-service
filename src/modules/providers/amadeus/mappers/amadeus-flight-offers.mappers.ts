import { AmadeusFlightOfferDto, AmadeusSegmentDto } from '../dto/amadeus-flight-offers-res.dto';

// DTOs normalizados que son independientes del proveedor (Amadeus, Skyscanner, etc.)
// Estos DTOs se usan en toda la aplicación y no dependen de la estructura específica de Amadeus

// Interfaz que representa un precio normalizado
export interface NormalizedPriceDto {
  // Precio como número (parseado desde string en Amadeus)
  amount: number;
  // Moneda del precio (código ISO 4217 de 3 letras, ej: "USD", "EUR")
  currency: string;
}

// Interfaz que representa un segmento de vuelo normalizado
// Un segmento es un tramo individual de vuelo (ej: JFK -> LAX)
export interface NormalizedSegmentDto {
  // Información del aeropuerto y hora de salida
  departure: {
    // Código IATA del aeropuerto de salida (3 letras, ej: "JFK")
    airport: string;
    // Terminal de salida (opcional, ej: "5")
    terminal?: string;
    // Fecha y hora de salida en formato ISO 8601 (ej: "2024-12-25T10:30:00")
    time: string;
  };
  // Información del aeropuerto y hora de llegada
  arrival: {
    // Código IATA del aeropuerto de llegada (3 letras, ej: "LAX")
    airport: string;
    // Terminal de llegada (opcional)
    terminal?: string;
    // Fecha y hora de llegada en formato ISO 8601
    time: string;
  };
  // Duración del segmento en minutos (convertido desde formato ISO 8601 duration)
  duration: number;
  // Código IATA de la aerolínea (2 letras, ej: "AA")
  airline: string;
  // Número de vuelo completo (ej: "AA1234")
  flightNumber: string;
  // Código de la aeronave (opcional)
  aircraftCode?: string;
  // Número de escalas en este segmento (0 = vuelo directo)
  stops: number;
}

// Interfaz que representa un vuelo normalizado completo
// Esta es la estructura que se retorna al módulo de búsqueda y a los clientes de la API
export interface NormalizedFlightDto {
  // ID único del vuelo (del proveedor, ej: Amadeus)
  id: string;
  // Precio del vuelo normalizado
  price: NormalizedPriceDto;
  // Array de segmentos que componen el vuelo
  // Para vuelos directos: 1 segmento
  // Para vuelos con escala: múltiples segmentos
  segments: NormalizedSegmentDto[];
  // Duración total del vuelo en minutos (suma de todos los segmentos)
  duration: number;
  // Array de códigos IATA de aerolíneas involucradas en el vuelo
  // Ejemplo: ["AA"] para un vuelo directo, ["AA", "DL"] para un vuelo con cambio de aerolínea
  airlines: string[];
  // Proveedor de la oferta (ej: "amadeus", "skyscanner")
  // Permite identificar de dónde viene la oferta cuando hay múltiples proveedores
  provider: 'amadeus';
}

// Convierte una duración en formato ISO 8601 (ej: "PT2H30M") a minutos
// Parámetro: duration - Duración en formato ISO 8601 (ej: "PT2H30M", "PT1H", "PT45M")
// Retorna: número de minutos
function parseDurationToMinutes(duration: string): number {
  // Expresión regular para extraer horas y minutos del formato ISO 8601
  // PT2H30M = 2 horas 30 minutos = 150 minutos
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?/;
  const match = duration.match(regex);

  if (!match) {
    // Si no coincide con el formato, retornamos 0 como fallback
    return 0;
  }

  // Extraemos horas y minutos (pueden ser undefined si no están presentes)
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (isNaN(hours) || isNaN(minutes)) {
    // Esto no debería pasar con el regex, pero validamos por seguridad
    return 0;
  }

  // Convertimos todo a minutos
  return hours * 60 + minutes;
}

// Mapea un segmento de Amadeus a un segmento normalizado
// Parámetro: segment - Segmento de Amadeus con su estructura original
// Retorna: Segmento normalizado con estructura simplificada
function mapSegment(segment: AmadeusSegmentDto): NormalizedSegmentDto {
  // Construimos el número de vuelo completo combinando código de aerolínea y número
  // Ejemplo: carrierCode="AA" + number="1234" = "AA1234"
  const flightNumber = `${segment.carrierCode}${segment.number}`;

  // Convertimos la duración de formato ISO 8601 a minutos
  const durationMinutes = parseDurationToMinutes(segment.duration);

  // Retornamos el segmento normalizado
  return {
    departure: {
      airport: segment.departure.iataCode,
      terminal: segment.departure.terminal,
      time: segment.departure.at,
    },
    arrival: {
      airport: segment.arrival.iataCode,
      terminal: segment.arrival.terminal,
      time: segment.arrival.at,
    },
    duration: durationMinutes,
    airline: segment.carrierCode,
    flightNumber: flightNumber,
    aircraftCode: segment.aircraft?.code,
    stops: segment.numberOfStops,
  };
}

// Mapea una oferta de vuelo de Amadeus a un vuelo normalizado
// Esta es la función principal que transforma la estructura compleja de Amadeus a una estructura simple
// Parámetro: offer - Oferta de vuelo de Amadeus con su estructura original
// Retorna: Vuelo normalizado con estructura simplificada e independiente del proveedor
export function mapAmadeusFlightOfferToNormalized(
  offer: AmadeusFlightOfferDto,
): NormalizedFlightDto {
  // Parseamos el precio total de string a number
  // Amadeus retorna el precio como string (ej: "500.00"), lo convertimos a número
  const priceAmount = parseFloat(offer.price.total);

  // Validamos que el precio parseado sea un número válido
  // parseFloat() puede retornar NaN si el string no es un número válido (ej: "abc", "", "   ")
  // Aunque Amadeus debería siempre retornar números válidos, validamos para evitar problemas
  if (isNaN(priceAmount) || priceAmount < 0) {
    throw new Error(
      `Invalid price format for flight ${offer.id}: "${offer.price.total}". Expected a valid positive number.`,
    );
  }

  // Extraemos todos los segmentos de todos los itinerarios
  // Un vuelo puede tener múltiples itinerarios (ida y vuelta), cada uno con múltiples segmentos
  // Aplanamos todos los segmentos en un solo array
  const allSegments: AmadeusSegmentDto[] = [];
  for (const itinerary of offer.itineraries) {
    // Agregamos todos los segmentos de este itinerario al array total
    allSegments.push(...itinerary.segments);
  }

  // Mapeamos cada segmento de Amadeus a un segmento normalizado
  const normalizedSegments = allSegments.map(mapSegment);

  // Calculamos la duración total sumando la duración de todos los segmentos
  // Si hay múltiples segmentos (escalas), sumamos sus duraciones
  const totalDuration = normalizedSegments.reduce((sum, segment) => sum + segment.duration, 0);

  // Extraemos todos los códigos únicos de aerolíneas de todos los segmentos
  // Usamos Set para eliminar duplicados (si el vuelo tiene múltiples segmentos de la misma aerolínea)
  const uniqueAirlines = Array.from(new Set(normalizedSegments.map((segment) => segment.airline)));

  // Retornamos el vuelo normalizado
  return {
    id: offer.id,
    price: {
      amount: priceAmount,
      currency: offer.price.currency,
    },
    segments: normalizedSegments,
    duration: totalDuration,
    airlines: uniqueAirlines,
    provider: 'amadeus',
  };
}

// Mapea una respuesta completa de Amadeus a un array de vuelos normalizados
// Esta función procesa toda la respuesta de Amadeus y retorna solo los vuelos normalizados
// Parámetro: response - Respuesta completa de Amadeus con data, meta y dictionaries
// Retorna: Array de vuelos normalizados
export function mapAmadeusFlightOffersResponseToNormalized(response: {
  data: AmadeusFlightOfferDto[];
}): NormalizedFlightDto[] {
  // Mapeamos cada oferta de vuelo de Amadeus a un vuelo normalizado
  // Usamos map para transformar cada elemento del array
  return response.data.map(mapAmadeusFlightOfferToNormalized);
}
