// Importamos HttpException de NestJS para crear excepciones HTTP personalizadas que NestJS puede manejar automáticamente
import { HttpException, HttpStatus } from '@nestjs/common';

// Constantes de endpoints de la API de Amadeus
// Estas URLs son relativas a la baseUrl configurada (test.api.amadeus.com o api.amadeus.com)
// Se definen como constantes para evitar strings mágicos en el código y facilitar mantenimiento

export const AMADEUS_ENDPOINTS = {
  // Endpoint para obtener token de acceso OAuth2 usando client credentials
  // POST /v1/security/oauth2/token con grant_type=client_credentials
  OAUTH_TOKEN: '/v1/security/oauth2/token',
  // Endpoint para buscar ofertas de vuelos
  // GET /v2/shopping/flight-offers con query parameters (origin, destination, departureDate, etc.)
  FLIGHT_OFFERS: '/v2/shopping/flight-offers',
} as const; // as const hace que TypeScript trate esto como un objeto de solo lectura, mejorando el tipado

// Interfaz que define la estructura de la respuesta exitosa del endpoint OAuth2 de Amadeus
// Esta es la respuesta que recibimos cuando solicitamos un token de acceso
export interface AmadeusTokenResponse {
  // Tipo de token, siempre será "Bearer" en OAuth2 client credentials flow
  // Se usa en el header Authorization: Bearer {access_token}
  token_type: 'Bearer';
  // Token de acceso que debemos usar en todas las peticiones a la API
  // Este token expira después de expires_in segundos (típicamente 1 hora = 3600 segundos)
  access_token: string;
  // Tiempo de expiración del token en segundos desde el momento de emisión
  // Típicamente 3600 segundos (1 hora), pero puede variar según el plan de Amadeus
  expires_in: number;
}

// Interfaz que define la estructura de un error individual en las respuestas de error de Amadeus
// Amadeus puede retornar múltiples errores en un array, cada uno con su código y descripción
export interface AmadeusErrorDetail {
  // Código de error específico de Amadeus (ej: "477", "492", "10001")
  // Cada código tiene un significado específico según la documentación de Amadeus
  code: number;
  // Título descriptivo del error (ej: "Invalid date format")
  title: string;
  // Descripción detallada del error, proporciona contexto adicional sobre qué salió mal
  detail: string;
  // Código de estado HTTP asociado con este error (400, 401, 429, 500, etc.)
  status: number;
  // Fuente del error, indica qué parte de la request causó el problema (ej: "departureDate", "originLocationCode")
  source?: {
    // Parámetro o campo que causó el error
    parameter?: string;
    // Ejemplo del valor que causó el error (útil para debugging)
    example?: string;
  };
}

// Interfaz que define la estructura completa de una respuesta de error de Amadeus
// Amadeus siempre retorna errores en este formato cuando algo falla
export interface AmadeusErrorResponse {
  // Array de errores, puede contener uno o múltiples errores
  // Si hay múltiples errores, todos deben ser corregidos para que la request sea válida
  errors: AmadeusErrorDetail[];
}

// Clase de error personalizada para errores de la API de Amadeus
// Extiende HttpException de NestJS para que NestJS pueda manejarla automáticamente
// y retornar respuestas HTTP apropiadas al cliente
export class AmadeusApiError extends HttpException {
  // Almacena la respuesta de error original de Amadeus para referencia y debugging
  // Útil para logging detallado y análisis de errores
  readonly amadeusError: AmadeusErrorResponse;
  // Código de estado HTTP que se retornará al cliente
  // Se determina desde el primer error en el array (o 500 si no se puede determinar)
  readonly statusCode: number;

  // Constructor de la clase AmadeusApiError
  constructor(
    amadeusError: AmadeusErrorResponse,
    defaultStatus: number = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    // Extraemos el primer error del array para obtener el mensaje principal
    // Si hay múltiples errores, usamos el primero como mensaje principal
    const firstError = amadeusError.errors[0];
    // Construimos un mensaje descriptivo combinando título y detalle del error
    // Ejemplo: "Invalid date format: The departure date must be in YYYY-MM-DD format"
    const message = firstError
      ? `${firstError.title}: ${firstError.detail}`
      : 'Unknown Amadeus API error'; // Fallback si el array de errores está vacío (no debería pasar)

    // Llamamos al constructor de HttpException con el mensaje y el status code
    // HttpException maneja automáticamente la serialización a JSON para la respuesta HTTP
    super(
      {
        // Objeto que se serializará como JSON en la respuesta HTTP
        message, // Mensaje principal del error
        errors: amadeusError.errors, // Array completo de errores para que el cliente vea todos los problemas
        statusCode: firstError?.status || defaultStatus, // Status code HTTP (400, 401, 429, 500, etc.)
      },
      firstError?.status || defaultStatus, // Status code que NestJS usará para la respuesta HTTP
    );

    // Guardamos la respuesta de error original de Amadeus para acceso posterior
    // Esto permite que otros servicios o logs accedan a la estructura completa del error
    this.amadeusError = amadeusError;
    // Guardamos el status code como propiedad de la clase para acceso directo
    // this.statusCode ya existe en HttpException, pero lo redefinimos para claridad
    this.statusCode = firstError?.status || defaultStatus;
  }

  // Método helper para obtener el código de error principal de Amadeus
  getErrorCode(): number | null {
    // Retornamos el código del primer error si existe, null en caso contrario
    return this.amadeusError.errors[0]?.code ?? null; // ?? es nullish coalescing, retorna null si es undefined
  }

  // Método helper para verificar si el error es de un tipo específico
  // Útil para decidir si se debe hacer retry o no (ej: 429 sí, 400 no)
  hasStatusCode(statusCode: number): boolean {
    // Compara el status code del error con el proporcionado
    return this.statusCode === statusCode;
  }

  // Método helper para verificar si el error es retryable (se puede reintentar)
  // Errores 5xx (server errors) y 429 (rate limit) son retryables
  // Errores 4xx (client errors) generalmente NO son retryables
  isRetryable(): boolean {
    // Errores 5xx: problemas del servidor, pueden ser temporales
    // Error 429: rate limit, se puede retry después de esperar
    // Errores 4xx: problemas del cliente (bad request), no tiene sentido retry
    return this.statusCode >= 500 || this.statusCode === 429;
  }
}

// Tipo auxiliar que representa los posibles códigos de estado HTTP que Amadeus puede retornar
// Útil para validación y type safety cuando trabajamos con respuestas de Amadeus
export type AmadeusHttpStatus =
  | 400 // Bad Request - Request mal formada o parámetros inválidos
  | 401 // Unauthorized - Token inválido o expirado
  | 403 // Forbidden - No tienes permisos para este endpoint
  | 404 // Not Found - Recurso no encontrado
  | 429 // Too Many Requests - Rate limit excedido
  | 500 // Internal Server Error - Error interno de Amadeus
  | 503; // Service Unavailable - Servicio temporalmente no disponible

// Tipo auxiliar que representa los códigos de error comunes de Amadeus
// Estos códigos son específicos de Amadeus y tienen significados particulares
// Nota: Usamos number directamente ya que los códigos específicos son solo documentación
export type AmadeusErrorCode = number; // Códigos comunes: 477 (Invalid date), 492 (Invalid IATA), 10001 (Invalid param), 10002 (Missing param), 38171-38173 (Date validation)

// Tipo auxiliar que representa los parámetros de query para el endpoint de búsqueda de vuelos
// Estos son los parámetros que se envían en la URL como query string
// Ejemplo: ?originLocationCode=JFK&destinationLocationCode=LAX&departureDate=2024-12-25&adults=2
export interface AmadeusFlightSearchParams {
  // Código IATA del aeropuerto de origen (3 letras, ej: "JFK", "LAX", "MAD")
  originLocationCode: string;
  // Código IATA del aeropuerto de destino (3 letras)
  destinationLocationCode: string;
  // Fecha de salida en formato ISO 8601 (YYYY-MM-DD)
  // Ejemplo: "2024-12-25"
  departureDate: string;
  // Fecha de retorno en formato ISO 8601 (opcional, solo para vuelos de ida y vuelta)
  // Debe ser posterior a departureDate
  returnDate?: string;
  // Número de adultos (mínimo 1, máximo varía según el plan de Amadeus)
  adults: number;
  // Número de niños (opcional, 0 o más)
  children?: number;
  // Número de infantes (opcional, 0 o más)
  infants?: number;
  // Número máximo de resultados a retornar (opcional, default varía, máximo típicamente 250)
  max?: number;
  // Clase de viaje (opcional: "ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST")
  travelClass?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  // Códigos de aerolíneas a incluir (opcional, array de códigos IATA de 2 letras)
  // Ejemplo: ["AA", "DL"] para solo American Airlines y Delta
  includedAirlineCodes?: string[];
  // Códigos de aerolíneas a excluir (opcional)
  excludedAirlineCodes?: string[];
  // Moneda para los precios (opcional, código ISO 4217 de 3 letras, ej: "USD", "EUR")
  // Si no se especifica, Amadeus usa una moneda por defecto según el origen
  currencyCode?: string;
}
