import { Injectable, Inject } from '@nestjs/common';
// Importamos Axios para hacer peticiones HTTP al endpoint OAuth2 de Amadeus
import axios, { AxiosError } from 'axios';
// Importamos el servicio de cache para guardar tokens y evitar solicitar nuevos en cada petición
import { CacheService } from '../../../infra/cache/cache.service';
// Importamos el servicio de resiliencia para aplicar retry, circuit breaker y timeout
import { ResilienceService } from '../../../infra/resilience/resilience.service';
// Importamos el token de inyección para ResilienceService
import { RESILIENCE_SERVICE } from '../../../infra/resilience/resilience.types';
// Importamos el servicio de logging para registrar eventos y errores
import { LoggerService } from '../../../infra/logging/logger.service';
// Importamos el servicio de configuración para acceder a las credenciales y URLs de Amadeus
import { AppConfigService } from '../../../config/config';
// Importamos tipos e interfaces de Amadeus para tipado fuerte
import {
  AmadeusTokenResponse,
  AmadeusErrorResponse,
  AmadeusApiError,
  AMADEUS_ENDPOINTS,
} from './amadeus.types';

@Injectable()
export class AmadeusTokenService {
  // Clave de cache donde guardamos el token de acceso
  // Usamos el patrón "auth:amadeus:token" para mantener consistencia con otras claves de cache
  // Esta key se usa en Redis para almacenar el token con TTL
  private readonly CACHE_KEY = 'auth:amadeus:token';

  constructor(
    private readonly cache: CacheService,
    // Inyectamos ResilienceService usando el token RESILIENCE_SERVICE
    // Esto mantiene consistencia con el patrón de CACHE_CLIENT
    @Inject(RESILIENCE_SERVICE)
    private readonly resilience: ResilienceService,
    private readonly logger: LoggerService,
    private readonly config: AppConfigService,
  ) {
    // Establecemos el contexto del logger para que todos los logs de este servicio tengan el mismo contexto
    // Esto facilita filtrar logs por servicio en sistemas de agregación de logs
    this.logger.setContext(AmadeusTokenService.name);

    // Validar credenciales al inicializar el servicio - Si no están configuradas, lanzar un error
    const amadeusConfig = this.config.amadeus;
    if (!amadeusConfig.apiKey || amadeusConfig.apiKey.trim() === '') {
      throw new Error(
        'AMADEUS_API_KEY no está configurada. Por favor, configura AMADEUS_API_KEY en tu archivo .env',
      );
    }

    if (!amadeusConfig.apiSecret || amadeusConfig.apiSecret.trim() === '') {
      throw new Error(
        'AMADEUS_API_SECRET no está configurada. Por favor, configura AMADEUS_API_SECRET en tu archivo .env',
      );
    }
  }

  // 1. Busca token en cache
  // 2. Si existe y es válido, lo retorna
  // 3. Si no existe o expiró, hace petición OAuth2 a Amadeus
  // 4. Guarda el nuevo token en cache con TTL
  // 5. Retorna el token
  async getAccessToken(): Promise<string> {
    const cachedToken = await this.cache.get<string>(this.CACHE_KEY);

    if (cachedToken) {
      this.logger.debug('Token obtenido desde cache', undefined, {
        cacheKey: this.CACHE_KEY,
      });
      return cachedToken;
    }

    // Si no hay token en cache, necesitamos obtener uno nuevo de Amadeus
    this.logger.info('Token no encontrado en cache, solicitando nuevo token a Amadeus');

    try {
      // Usamos ResilienceService para ejecutar la petición OAuth2 con políticas de resiliencia
      // policyKey: 'amadeus.token' identifica esta política para circuit breaker y métricas
      // La función anónima contiene la lógica de la petición HTTP
      // options: configuramos timeout de 10 segundos y habilitamos retry para errores de red/5xx
      const tokenResponse = await this.resilience.execute<AmadeusTokenResponse>(
        'amadeus.token', // Key única para esta política de resiliencia
        async () => {
          // Esta función se ejecuta dentro de la política de resiliencia (retry, circuit breaker, timeout)
          return await this.fetchTokenFromAmadeus();
        },
        {
          // Timeout de 10 segundos: si Amadeus no responde en este tiempo, se cancela la petición
          timeoutMs: 10000,
          // Habilitamos retry: si falla por error de red o 5xx, se reintenta automáticamente
          enableRetry: true,
          // Habilitamos circuit breaker: si hay muchos fallos, se abre el circuito para proteger el sistema
          enableCircuitBreaker: true,
        },
      );

      // Extraemos el access_token de la respuesta de Amadeus
      const accessToken = tokenResponse.access_token;
      if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
        this.logger.error('Token inválido o vacío', undefined, undefined, {
          accessToken,
        });
        throw new AmadeusApiError(
          {
            errors: [
              { code: 0, title: 'Invalid Token', detail: 'Token vacío o inválido', status: 500 },
            ],
          },
          500,
        );
      }

      // Validamos que expires_in sea un número válido
      // expires_in indica cuántos segundos hasta que expire el token (típicamente 3600 = 1 hora)
      if (
        !tokenResponse.expires_in ||
        typeof tokenResponse.expires_in !== 'number' ||
        tokenResponse.expires_in <= 0
      ) {
        this.logger.warn('Token response sin expires_in válido', undefined, {
          expiresIn: tokenResponse.expires_in,
          tokenResponse,
        });
      }

      // Guardamos el token en cache con el TTL configurado (típicamente 55 minutos = 3300 segundos)
      // El TTL es menor que expires_in para evitar usar tokens que están a punto de expirar
      await this.cache.set(
        this.CACHE_KEY, // Key donde guardamos el token
        accessToken, // Valor: el token de acceso
        this.config.amadeus.tokenCacheTtl, // TTL en segundos desde la configuración
      );

      // Logging info para registrar que obtuvimos un nuevo token
      this.logger.info('Token obtenido exitosamente de Amadeus y guardado en cache', undefined, {
        expiresIn: tokenResponse.expires_in,
        cacheTtl: this.config.amadeus.tokenCacheTtl,
      });

      // Retornamos el token de acceso
      return accessToken;
    } catch (error) {
      // Si hay un error al obtener el token, lo manejamos aquí
      // El error puede venir de:
      // - ResilienceService (timeout, circuit breaker abierto, todos los retries fallaron)
      // - Axios (error de red, error HTTP)
      // - AmadeusApiError (error de la API de Amadeus)

      // Logging de error con detalles para debugging
      this.logger.error(
        'Error al obtener token de Amadeus',
        error instanceof Error ? error.stack : undefined,
        undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          cacheKey: this.CACHE_KEY,
        },
      );

      // Si el error es un AmadeusApiError (error estructurado de Amadeus), lo relanzamos tal cual
      // Esto permite que el código que llama a este método pueda manejar errores específicos de Amadeus
      if (error instanceof AmadeusApiError) {
        throw error;
      }

      // Si es un error de Axios (error de red o HTTP), lo convertimos a AmadeusApiError
      // Esto unifica el manejo de errores en toda la aplicación
      if (this.isAxiosError(error)) {
        throw this.handleAxiosError(error);
      }

      // Si es cualquier otro error, lo envolvemos en un AmadeusApiError genérico
      // Esto asegura que siempre retornamos un tipo de error conocido
      throw new AmadeusApiError(
        {
          errors: [
            {
              code: 0, // Código 0 indica error desconocido
              title: 'Unknown Error',
              detail: error instanceof Error ? error.message : String(error),
              status: 500, // Internal Server Error por defecto
            },
          ],
        },
        500,
      );
    }
  }

  // Hace la petición HTTP real al endpoint OAuth2 de Amadeus
  // Este método es privado y solo se llama desde getAccessToken()
  // Usa Axios para hacer un POST con las credenciales en formato application/x-www-form-urlencoded
  // Retorna: Promise<AmadeusTokenResponse> - La respuesta completa de Amadeus con el token
  // Lanza: AmadeusApiError - Si Amadeus retorna un error (401, 400, etc.)
  // Lanza: Error - Si hay un error de red o Axios
  private async fetchTokenFromAmadeus(): Promise<AmadeusTokenResponse> {
    // Construimos la URL completa del endpoint OAuth2
    // baseUrl viene de la configuración (test.api.amadeus.com o api.amadeus.com)
    // AMADEUS_ENDPOINTS.OAUTH_TOKEN es '/v1/security/oauth2/token'
    const url = `${this.config.amadeus.baseUrl}${AMADEUS_ENDPOINTS.OAUTH_TOKEN}`;

    // Logging debug para saber qué URL estamos llamando (sin credenciales por seguridad)
    this.logger.debug('Solicitando token OAuth2 a Amadeus', undefined, {
      url,
      method: 'POST',
    });

    try {
      // Hacemos la petición POST a Amadeus usando Axios
      // Amadeus requiere que las credenciales se envíen como form-urlencoded (no JSON)
      const response = await axios.post<AmadeusTokenResponse>(
        url, // URL completa del endpoint
        // Body de la petición en formato application/x-www-form-urlencoded
        // Amadeus requiere este formato específico para OAuth2 client credentials flow
        new URLSearchParams({
          grant_type: 'client_credentials', // Tipo de grant OAuth2 (client credentials = app se autentica a sí misma)
          client_id: this.config.amadeus.apiKey, // API Key pública de Amadeus
          client_secret: this.config.amadeus.apiSecret, // API Secret privada de Amadeus
        }).toString(), // URLSearchParams.toString() convierte a formato "grant_type=client_credentials&client_id=...&client_secret=..."
        {
          // Headers de la petición
          headers: {
            // Content-Type indica que el body es form-urlencoded
            'Content-Type': 'application/x-www-form-urlencoded',
            // Accept indica que esperamos JSON como respuesta
            Accept: 'application/json',
          },
          // Timeout de 10 segundos (backup, aunque ResilienceService también tiene timeout)
          // Si Amadeus no responde en 10 segundos, Axios lanza un error
          timeout: 10000,
        },
      );

      // Si la petición fue exitosa (status 200), retornamos la respuesta
      // Axios automáticamente parsea el JSON de la respuesta a AmadeusTokenResponse
      return response.data;
    } catch (error) {
      // Si hay un error, verificamos si es un error de Axios con respuesta HTTP
      // Verificamos explícitamente que error.response existe antes de acceder a sus propiedades
      if (this.isAxiosError(error) && error.response && error.response.data) {
        // Amadeus retorna errores en formato JSON con estructura AmadeusErrorResponse
        // Intentamos parsear el error como AmadeusErrorResponse
        const amadeusError = error.response.data as AmadeusErrorResponse;

        // Si la respuesta tiene la estructura de error de Amadeus, lanzamos AmadeusApiError
        // Ahora podemos acceder a error.response.status de forma segura porque ya verificamos que existe
        if (amadeusError && amadeusError.errors && Array.isArray(amadeusError.errors)) {
          throw new AmadeusApiError(amadeusError, error.response.status);
        }
      }
      // Si no es un error estructurado de Amadeus, relanzamos el error original
      // ResilienceService o el código que llama manejará este error
      throw error;
    }
  }

  // Helper para verificar si un error es un AxiosError
  // Type guard de TypeScript que permite hacer type narrowing
  // Parámetro: error - El error a verificar
  // Retorna: true si el error es un AxiosError
  private isAxiosError(error: unknown): error is AxiosError {
    // AxiosError tiene una propiedad isAxiosError que siempre es true
    // Esto permite identificar errores de Axios de forma segura
    return (
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error &&
      (error as AxiosError).isAxiosError === true
    );
  }

  // Convierte un AxiosError a AmadeusApiError
  // Útil para unificar el manejo de errores cuando Axios falla
  // Parámetro: error - El AxiosError a convertir
  // Retorna: AmadeusApiError con la información del error de Axios
  private handleAxiosError(error: AxiosError): AmadeusApiError {
    // Si el error tiene una respuesta HTTP (ej: 401, 500), intentamos extraer el error de Amadeus
    if (error.response) {
      const amadeusError = error.response.data as AmadeusErrorResponse;

      // Si la respuesta tiene la estructura de error de Amadeus, creamos AmadeusApiError
      if (amadeusError && amadeusError.errors && Array.isArray(amadeusError.errors)) {
        return new AmadeusApiError(amadeusError, error.response.status);
      }
    }

    // Si no hay respuesta o no es un error estructurado de Amadeus,
    // creamos un AmadeusApiError genérico con información del error de red
    return new AmadeusApiError(
      {
        errors: [
          {
            code: 0, // Código 0 indica error desconocido
            title: 'Network Error',
            detail:
              error.message ||
              'Error de red al conectar con Amadeus. Verifica tu conexión a internet.',
            status: error.response?.status || 500, // Usamos el status de la respuesta si existe, sino 500
          },
        ],
      },
      error.response?.status || 500,
    );
  }

  // Invalida el token en cache, forzando que se obtenga uno nuevo en la próxima petición
  // Útil para testing o si necesitas refrescar el token manualmente
  // Retorna: Promise<void>
  async invalidateToken(): Promise<void> {
    // Eliminamos el token del cache usando CacheService
    await this.cache.delete(this.CACHE_KEY);

    // Logging info para registrar que invalidamos el token
    this.logger.info('Token invalidado en cache', undefined, {
      cacheKey: this.CACHE_KEY,
    });
  }
}
