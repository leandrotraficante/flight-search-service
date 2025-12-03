// Importamos AppConfigService para acceder a la configuración centralizada de Amadeus
// AppConfigService ya tiene un getter amadeus que lee las variables de entorno
import { AppConfigService } from '../../../config/config';

// Define la forma de la configuración de Amadeus, lo usamos en Dependency Injection
// Esta interface debe coincidir con la definida en AppConfigService para mantener consistencia
export interface AmadeusConfig {
  // Clave de API pública de Amadeus (AMADEUS_API_KEY del .env)
  // Se usa junto con apiSecret para obtener tokens de acceso OAuth2
  apiKey: string;
  // Secreto de API privado de Amadeus (AMADEUS_API_SECRET del .env)
  apiSecret: string;
  // URL base de la API de Amadeus (AMADEUS_BASE_URL del .env)

  baseUrl: string;
  // Tiempo de vida del token en cache en segundos (AMADEUS_TOKEN_CACHE_TTL del .env)
  // Típicamente 3300 segundos (55 minutos) para tokens que expiran en 1 hora (3600 segundos)
  // Cacheamos el token por menos tiempo que su expiración real para evitar usar tokens expirados
  tokenCacheTtl: number;
}

// Función factory que lee las variables de entorno y devuelve la configuración de Amadeus
// Esta función se usa como factory en providers de NestJS para crear la configuración dinámicamente
export function amadeusConfigFactory(appConfigService: AppConfigService): AmadeusConfig {
  // Retornamos la configuración de Amadeus desde AppConfigService
  // AppConfigService ya tiene un getter amadeus que lee las variables de entorno:
  // - AMADEUS_API_KEY
  // - AMADEUS_API_SECRET
  // - AMADEUS_BASE_URL
  // - AMADEUS_TOKEN_CACHE_TTL
  // Si alguna variable no está definida, AppConfigService usa valores por defecto
  return appConfigService.amadeus;
}
