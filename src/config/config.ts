import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // Servicio de NestJS que lee variables de entorno del archivo .env,
// proporciona métodos get() para acceder a las variables

// Interfaces para tipado de las configuraciones
// Las interfaces definen la estructura de datos esperada, proporcionando autocompletado y validación de tipos en TypeScript

export interface AppConfig {
  // Define la estructura de configuración de la aplicación principal
  nodeEnv: string; // Entorno de ejecución (development, production, test), usado para cambiar comportamientos según el ambiente
  port: number; // Puerto donde escuchará el servidor HTTP, necesario para que la aplicación reciba peticiones
}

export interface RedisConfig {
  // Define la estructura de configuración para la conexión a Redis (cache)
  host: string; // Dirección IP o hostname del servidor Redis, necesario para establecer la conexión
  port: number; // Puerto del servidor Redis (por defecto 6379), necesario para conectarse al servicio
  password?: string; // Contraseña opcional para autenticación en Redis, el ? indica que es opcional (puede ser undefined)
  ttlSeconds: number; // Tiempo de vida en segundos para las claves en cache, determina cuánto tiempo se mantienen los datos cacheados
}

export interface AmadeusConfig {
  // Define la estructura de configuración para la API de Amadeus (servicio de vuelos)
  apiKey: string; // Clave de API pública de Amadeus, necesaria para autenticarse en sus endpoints
  apiSecret: string; // Secreto de API privado de Amadeus, usado junto con apiKey para obtener tokens de acceso
  baseUrl: string; // URL base de la API de Amadeus (sandbox o producción), determina a qué servidor se hacen las peticiones
  tokenCacheTtl: number; // Tiempo de vida del token de acceso en cache (segundos), evita solicitar tokens nuevos en cada petición
}

export interface CircuitBreakerConfig {
  // Define la estructura de configuración para el circuit breaker (patrón de resiliencia)
  failureThreshold: number; // Número de fallos consecutivos necesarios para abrir el circuito, protege contra servicios que fallan repetidamente
  halfOpenAfterMs: number; // Tiempo en milisegundos que permanece abierto antes de probar si el servicio se recuperó, permite reintentos controlados
  successThreshold: number; // Número de éxitos necesarios para cerrar el circuito, confirma que el servicio está funcionando correctamente
}

export interface ResilienceConfig {
  // Define la estructura de configuración para políticas de resiliencia (timeout, retry, circuit breaker)
  timeoutMs: number; // Tiempo máximo en milisegundos para que una operación se complete, evita esperas indefinidas
  retryAttempts: number; // Número de intentos de reintento en caso de fallo, mejora la probabilidad de éxito en fallos transitorios
  retryBaseDelayMs: number; // Tiempo base en milisegundos entre reintentos, controla el delay inicial antes de reintentar
  circuitBreaker: CircuitBreakerConfig; // Configuración del circuit breaker, agrupa todas las opciones relacionadas con este patrón
}

// Servicio de configuración centralizado
//Proporciona acceso tipado a todas las variables de entorno
//Encapsula la lógica de lectura de variables de entorno y proporciona valores por defecto

@Injectable() // Marca la clase como un servicio inyectable, permite que NestJS la registre en el contenedor de dependencias
export class AppConfigService {
  // Clase que centraliza el acceso a todas las configuraciones de la aplicación
  constructor(private readonly configService: ConfigService) {} // Inyección de dependencia: NestJS proporciona automáticamente una instancia de ConfigService, readonly evita modificaciones accidentales

  /**
   * Configuración de la aplicación
   * Getter que retorna un objeto con la configuración de la app, se accede como this.config.app
   */
  get app(): AppConfig {
    // Getter: propiedad calculada que se accede como propiedad pero ejecuta código, permite acceso tipo this.config.app.nodeEnv
    return {
      // Retorna un objeto literal con la configuración de la aplicación
      nodeEnv: this.configService.get<string>('NODE_ENV', 'development'), // Lee NODE_ENV del .env, si no existe usa 'development', <string> especifica el tipo de retorno
      port: this.configService.get<number>('PORT', 3000), // Lee PORT del .env, si no existe usa 3000, <number> convierte automáticamente el string a número
    };
  }

  /**
   * Configuración de Redis
   * Getter que retorna un objeto con la configuración de Redis, se accede como this.config.redis
   */
  get redis(): RedisConfig {
    // Getter para configuración de Redis, agrupa todas las variables relacionadas con Redis en un solo objeto
    return {
      // Retorna un objeto literal con la configuración de Redis
      host: this.configService.get<string>('REDIS_HOST', 'localhost'), // Lee REDIS_HOST del .env, si no existe usa 'localhost' (valor por defecto para desarrollo local)
      port: this.configService.get<number>('REDIS_PORT', 6379), // Lee REDIS_PORT del .env, si no existe usa 6379 (puerto estándar de Redis), Number() convierte string a número
      password: this.configService.get<string>('REDIS_PASSWORD'), // Lee REDIS_PASSWORD del .env, si no existe retorna undefined (opcional, no todos los Redis tienen contraseña)
      ttlSeconds: this.configService.get<number>('REDIS_TTL_SECONDS', 3600), // Lee REDIS_TTL_SECONDS del .env, si no existe usa 3600 (1 hora en segundos), tiempo de vida por defecto del cache
    };
  }

  /**
   * Configuración de Amadeus API
   * Getter que retorna un objeto con la configuración de Amadeus, se accede como this.config.amadeus
   */
  get amadeus(): AmadeusConfig {
    // Getter para configuración de Amadeus, agrupa todas las variables relacionadas con la API de Amadeus
    return {
      // Retorna un objeto literal con la configuración de Amadeus
      apiKey: this.configService.get<string>('AMADEUS_API_KEY', ''), // Lee AMADEUS_API_KEY del .env, si no existe usa string vacío (requiere configuración explícita)
      apiSecret: this.configService.get<string>('AMADEUS_API_SECRET', ''), // Lee AMADEUS_API_SECRET del .env, si no existe usa string vacío (requiere configuración explícita)
      baseUrl: this.configService.get<string>('AMADEUS_BASE_URL', 'https://test.api.amadeus.com'), // Lee AMADEUS_BASE_URL del .env, si no existe usa la URL de sandbox (entorno de pruebas)
      tokenCacheTtl: this.configService.get<number>('AMADEUS_TOKEN_CACHE_TTL', 3300), // Lee AMADEUS_TOKEN_CACHE_TTL del .env, si no existe usa 3300 (55 minutos, tokens expiran en 60 min)
    };
  }

  /**
   * Configuración de Resiliencia
   * Getter que retorna un objeto con la configuración de políticas de resiliencia, se accede como this.config.resilience
   * Nota: Esta configuración está en AppConfigService para mantener consistencia con otras configuraciones,
   * aunque la implementación específica del módulo de resiliencia puede estar en resilience.config.ts
   */
  get resilience(): ResilienceConfig {
    // Getter para configuración de resiliencia, agrupa todas las variables relacionadas con timeout, retry y circuit breaker
    return {
      // Retorna un objeto literal con la configuración de resiliencia
      timeoutMs: this.configService.get<number>('RES_TIMEOUT_MS', 1000), // Lee RES_TIMEOUT_MS del .env, si no existe usa 1000ms (1 segundo), tiempo máximo de espera por defecto
      retryAttempts: this.configService.get<number>('RES_RETRY_ATTEMPTS', 2), // Lee RES_RETRY_ATTEMPTS del .env, si no existe usa 2, número de reintentos por defecto
      retryBaseDelayMs: this.configService.get<number>('RES_RETRY_BASE_MS', 200), // Lee RES_RETRY_BASE_MS del .env, si no existe usa 200ms, delay base entre reintentos
      circuitBreaker: {
        // Configuración anidada del circuit breaker, agrupa las opciones específicas de este patrón
        failureThreshold: this.configService.get<number>('RES_CB_FAILURE_THRESHOLD', 3), // Lee RES_CB_FAILURE_THRESHOLD del .env, si no existe usa 3, fallos necesarios para abrir el circuito
        halfOpenAfterMs: this.configService.get<number>('RES_CB_HALFOPEN_MS', 10000), // Lee RES_CB_HALFOPEN_MS del .env, si no existe usa 10000ms (10 segundos), tiempo antes de probar recuperación
        successThreshold: this.configService.get<number>('RES_CB_SUCCESS_THRESHOLD', 1), // Lee RES_CB_SUCCESS_THRESHOLD del .env, si no existe usa 1, éxitos necesarios para cerrar el circuito
      },
    };
  }

  /**
   * Helpers para acceso directo a variables comunes
   * Getters que proporcionan acceso directo a valores frecuentemente usados, evitan escribir this.config.app.nodeEnv
   */
  get nodeEnv(): string {
    // Getter que retorna directamente el entorno, acceso directo sin pasar por this.app.nodeEnv
    return this.app.nodeEnv; // Reutiliza el getter app para obtener nodeEnv, evita duplicación de código
  }

  get port(): number {
    // Getter que retorna directamente el puerto, acceso directo sin pasar por this.app.port
    return this.app.port; // Reutiliza el getter app para obtener port, simplifica el acceso a esta configuración común
  }

  get isProduction(): boolean {
    // Getter que retorna true si estamos en producción, útil para condicionales que cambian comportamiento según el entorno
    return this.nodeEnv === 'production'; // Compara nodeEnv con 'production', retorna boolean para usar en if/ternarios
  }

  get isDevelopment(): boolean {
    // Getter que retorna true si estamos en desarrollo, útil para habilitar características de debug o logging detallado
    return this.nodeEnv === 'development'; // Compara nodeEnv con 'development', retorna boolean para usar en condicionales
  }
}
