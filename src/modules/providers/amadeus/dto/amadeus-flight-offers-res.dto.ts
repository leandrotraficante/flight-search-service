// DTOs que representan la estructura completa de la respuesta de la API de Amadeus Flight Offers
// Estos DTOs reflejan exactamente la estructura JSON que retorna Amadeus

// Interfaz que representa el precio de un vuelo
// Amadeus retorna el precio como string (ej: "500.00") y la moneda
export interface AmadeusPriceDto {
  // Precio total como string (ej: "500.00")
  // Se parsea a number en el mapper
  total: string;
  // Moneda del precio (código ISO 4217 de 3 letras, ej: "USD", "EUR")
  currency: string;
  // Precio base (opcional, sin impuestos ni tasas)
  base?: string;
  // Impuestos y tasas (opcional, array de objetos con amount y currency)
  taxes?: Array<{
    amount: string;
    currency: string;
  }>;
}

// Interfaz que representa información de un aeropuerto o terminal
export interface AmadeusLocationDto {
  // Código IATA del aeropuerto (3 letras, ej: "JFK")
  iataCode: string;
  // Terminal del aeropuerto (opcional, ej: "5")
  terminal?: string;
  // Nombre del aeropuerto (opcional)
  at?: string;
}

// Interfaz que representa un segmento de vuelo (tramo individual)
// Un vuelo puede tener múltiples segmentos si tiene escalas
export interface AmadeusSegmentDto {
  // Información del aeropuerto de salida
  departure: {
    // Aeropuerto de salida
    iataCode: string;
    // Terminal de salida (opcional)
    terminal?: string;
    // Fecha y hora de salida en formato ISO 8601 (ej: "2024-12-25T10:30:00")
    at: string;
  };
  // Información del aeropuerto de llegada
  arrival: {
    // Aeropuerto de llegada
    iataCode: string;
    // Terminal de llegada (opcional)
    terminal?: string;
    // Fecha y hora de llegada en formato ISO 8601
    at: string;
  };
  // Código IATA de la aerolínea (2 letras, ej: "AA")
  carrierCode: string;
  // Número de vuelo (ej: "1234")
  number: string;
  // Información de la aeronave (opcional)
  aircraft?: {
    // Código de la aeronave
    code: string;
  };
  // Duración del segmento en formato ISO 8601 duration (ej: "PT2H30M" = 2 horas 30 minutos)
  duration: string;
  // Número de escalas en este segmento (0 = vuelo directo)
  numberOfStops: number;
  // Información de la clase de servicio (opcional)
  co2Emissions?: Array<{
    weight: number;
    weightUnit: string;
    cabin: string;
  }>;
}

// Interfaz que representa un itinerario completo (ida o vuelta)
// Un vuelo puede tener uno (solo ida) o dos (ida y vuelta) itinerarios
export interface AmadeusItineraryDto {
  // Duración total del itinerario en formato ISO 8601 duration
  duration: string;
  // Array de segmentos que componen este itinerario
  // Un segmento es un tramo de vuelo (ej: JFK -> LAX)
  segments: AmadeusSegmentDto[];
}

// Interfaz que representa el precio para un tipo específico de viajero
export interface AmadeusTravelerPricingDto {
  // ID del viajero (ej: "1")
  travelerId: string;
  // Tipo de tarifa (ej: "ADULT", "CHILD", "INFANT")
  fareOption: string;
  // Tipo de viajero (ej: "ADULT", "CHILD", "HELD_INFANT")
  travelerType: string;
  // Precio para este viajero
  price: AmadeusPriceDto;
  // Desglose del precio por tipo de tarifa (opcional)
  fareDetailsBySegment?: Array<{
    segmentId: string;
    cabin: string;
    fareBasis: string;
    class: string;
    includedCheckedBags?: {
      quantity: number;
    };
  }>;
}

// Interfaz que representa una oferta de vuelo completa de Amadeus
// Esta es la estructura principal que retorna Amadeus para cada vuelo encontrado
export interface AmadeusFlightOfferDto {
  // ID único de la oferta de vuelo
  type: string;
  id: string;
  // Precio total del vuelo
  price: AmadeusPriceDto;
  // Array de itinerarios (típicamente 1 para ida, 2 para ida y vuelta)
  itineraries: AmadeusItineraryDto[];
  // Precios desglosados por tipo de viajero (adulto, niño, infante)
  travelerPricings: AmadeusTravelerPricingDto[];
  // Información adicional de la oferta (opcional)
  validatingAirlineCodes?: string[];
  // Fuente de la oferta (opcional)
  source?: string;
}

// Interfaz que representa metadatos de la búsqueda
export interface AmadeusMetaDto {
  // Número de resultados retornados
  count: number;
  // Links de paginación (opcional)
  links?: {
    self: string;
  };
}

// Interfaz que representa diccionarios de referencias
// Amadeus retorna códigos abreviados y estos diccionarios los mapean a valores completos
export interface AmadeusDictionariesDto {
  // Diccionario de ubicaciones (aeropuertos)
  locations?: Record<
    string,
    {
      cityCode: string;
      countryCode: string;
    }
  >;
  // Diccionario de aeronaves
  aircraft?: Record<string, string>;
  // Diccionario de aerolíneas
  carriers?: Record<string, string>;
  // Diccionario de monedas
  currencies?: Record<string, string>;
}

// Interfaz que representa la respuesta completa de la API de Amadeus Flight Offers
// Esta es la estructura raíz que retorna el endpoint /v2/shopping/flight-offers
export interface AmadeusFlightOffersResponseDto {
  // Array de ofertas de vuelos encontradas
  // Cada elemento es una oferta de vuelo completa con precios, itinerarios, etc.
  data: AmadeusFlightOfferDto[];
  // Metadatos de la búsqueda (número de resultados, links, etc.)
  meta: AmadeusMetaDto;
  // Diccionarios de referencias (aeropuertos, aerolíneas, aeronaves, monedas)
  // Estos diccionarios mapean códigos abreviados a valores completos
  dictionaries: AmadeusDictionariesDto;
}
