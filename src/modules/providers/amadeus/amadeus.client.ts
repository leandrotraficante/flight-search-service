import { Injectable, Inject } from '@nestjs/common';
// Importamos Axios para crear una instancia de cliente HTTP configurada
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { AmadeusTokenService } from './amadeus-token.service';
import { ResilienceService } from '../../../infra/resilience/resilience.service';
// Importamos el token de inyección para ResilienceService
import { RESILIENCE_SERVICE } from '../../../infra/resilience/resilience.types';
import { LoggerService } from '../../../infra/logging/logger.service';
import { AppConfigService } from '../../../config/config';
// Importamos tipos e interfaces de Amadeus para tipado fuerte
import { AmadeusApiError, AmadeusErrorResponse } from './amadeus.types';

@Injectable()
export class AmadeusClient {
  // Instancia de Axios configurada con baseURL y interceptores
  // Esta instancia se crea en el constructor y se usa para todas las peticiones HTTP
  private readonly axiosInstance: AxiosInstance;

  constructor(
    // Servicio de token para obtener tokens de acceso automáticamente
    // Se usa en el interceptor de request para agregar el token a cada petición
    private readonly tokenService: AmadeusTokenService,
    // Inyectamos ResilienceService usando el token RESILIENCE_SERVICE
    // Esto mantiene consistencia con el patrón de CACHE_CLIENT
    @Inject(RESILIENCE_SERVICE)
    private readonly resilience: ResilienceService,
    private readonly logger: LoggerService,
    private readonly config: AppConfigService,
  ) {
    // Establecemos el contexto del logger para que todos los logs de este servicio tengan el mismo contexto
    this.logger.setContext(AmadeusClient.name);

    this.axiosInstance = axios.create({
      // URL base de la API de Amadeus (test.api.amadeus.com o api.amadeus.com)
      // Todas las peticiones se harán a esta URL base + el endpoint específico
      baseURL: this.config.amadeus.baseUrl,
      // Headers por defecto que se envían en todas las peticiones
      headers: {
        // Content-Type por defecto: JSON (puede sobrescribirse en peticiones específicas)
        'Content-Type': 'application/json',
        // Accept: indicamos que esperamos JSON como respuesta
        Accept: 'application/json',
      },
      // Timeout por defecto de 10 segundos (backup, aunque ResilienceService también tiene timeout)
      // Si Amadeus no responde en 10 segundos, Axios lanza un error
      timeout: 10000,
    });

    // Configuramos los interceptores de Axios
    // Los interceptores permiten modificar requests y responses antes de que se procesen
    this.setupInterceptors();
  }

  // Configura los interceptores de Axios para agregar token, manejar errores y refrescar token en 401
  private setupInterceptors(): void {
    // Interceptor de request: se ejecuta ANTES de enviar cada petición HTTP
    // Aquí agregamos el token de acceso automáticamente a todas las peticiones
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Obtenemos el token de acceso usando AmadeusTokenService
        // Este método maneja cache automáticamente, así que no hace petición OAuth2 si el token está en cache
        const token = await this.tokenService.getAccessToken();

        // Agregamos el token al header Authorization en formato Bearer
        // Este header es requerido por Amadeus para autenticar todas las peticiones
        config.headers.Authorization = `Bearer ${token}`;

        this.logger.debug('Request a Amadeus', undefined, {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
        });

        // Retornamos la configuración modificada
        return config;
      },
      (error: unknown) => {
        // Si hay un error al configurar el request (muy raro), lo loggeamos y relanzamos
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error('Error al configurar request a Amadeus', errorStack, undefined, {
          error: errorMessage,
        });
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      },
    );

    // Interceptor de response: se ejecuta DESPUÉS de recibir una respuesta exitosa
    // Aquí podemos procesar o transformar la respuesta antes de que llegue al código que hizo la petición
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Si la respuesta fue exitosa (status 200-299), la retornamos tal cual
        this.logger.debug('Response exitosa de Amadeus', undefined, {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      async (error: AxiosError) => {
        // Si hay un error en la respuesta (status 4xx o 5xx), lo manejamos aquí
        // Este interceptor se ejecuta cuando Axios recibe un error HTTP

        // Si el error es 401 (Unauthorized), significa que el token expiró o es inválido
        // En este caso, invalidamos el token en cache y el siguiente request obtendrá uno nuevo
        if (error.response?.status === 401) {
          this.logger.warn('Token inválido o expirado (401), invalidando cache', undefined, {
            url: error.config?.url,
          });

          // Invalidamos el token en cache para forzar que se obtenga uno nuevo en la próxima petición
          // No hacemos retry automático aquí porque el interceptor de request ya obtendrá un nuevo token
          await this.tokenService.invalidateToken();

          // Convertimos el error a AmadeusApiError para unificar el manejo de errores
          throw this.handleAxiosError(error);
        }

        // Para otros errores (400, 429, 500, etc.), los convertimos a AmadeusApiError
        // Esto unifica el manejo de errores en toda la aplicación
        throw this.handleAxiosError(error);
      },
    );
  }

  // Realiza una petición GET a la API de Amadeus
  // Este método envuelve la petición con ResilienceService para aplicar retry, circuit breaker y timeout
  // Parámetro: url - Endpoint relativo a la baseURL (ej: '/v2/shopping/flight-offers')
  // Parámetro: config - Configuración opcional de Axios (headers, params, etc.)
  // Retorna: Promise<T> - La respuesta parseada de Amadeus
  // Lanza: AmadeusApiError - Si Amadeus retorna un error o hay problemas de red
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // Usamos ResilienceService para ejecutar la petición GET con políticas de resiliencia
    // policyKey: 'amadeus.api' identifica esta política para circuit breaker y métricas
    // La función anónima contiene la lógica de la petición HTTP
    // options: configuramos timeout de 10 segundos y habilitamos retry para errores de red/5xx
    return await this.resilience.execute<T>(
      'amadeus.api', // Key única para esta política de resiliencia
      async () => {
        // Esta función se ejecuta dentro de la política de resiliencia (retry, circuit breaker, timeout)
        // Hacemos la petición GET usando la instancia de Axios configurada
        const response = await this.axiosInstance.get<T>(url, config);
        // Retornamos solo los datos de la respuesta (response.data), no toda la respuesta de Axios
        return response.data;
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
  }

  // Realiza una petición POST a la API de Amadeus
  // Este método envuelve la petición con ResilienceService para aplicar retry, circuit breaker y timeout
  // Parámetro: url - Endpoint relativo a la baseURL
  // Parámetro: data - Datos a enviar en el body de la petición
  // Parámetro: config - Configuración opcional de Axios (headers, etc.)
  // Retorna: Promise<T> - La respuesta parseada de Amadeus
  // Lanza: AmadeusApiError - Si Amadeus retorna un error o hay problemas de red
  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    // Usamos ResilienceService para ejecutar la petición POST con políticas de resiliencia
    // policyKey: 'amadeus.api' identifica esta política para circuit breaker y métricas
    // La función anónima contiene la lógica de la petición HTTP
    // options: configuramos timeout de 10 segundos y habilitamos retry para errores de red/5xx
    return await this.resilience.execute<T>(
      'amadeus.api', // Key única para esta política de resiliencia
      async () => {
        // Esta función se ejecuta dentro de la política de resiliencia (retry, circuit breaker, timeout)
        // Hacemos la petición POST usando la instancia de Axios configurada
        const response = await this.axiosInstance.post<T>(url, data, config);
        // Retornamos solo los datos de la respuesta (response.data), no toda la respuesta de Axios
        return response.data;
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
  }

  // Convierte un AxiosError a AmadeusApiError
  // Útil para unificar el manejo de errores cuando Axios falla
  // Parámetro: error - El AxiosError a convertir
  // Retorna: AmadeusApiError con la información del error de Axios
  private handleAxiosError(error: AxiosError): AmadeusApiError {
    // Si el error tiene una respuesta HTTP (ej: 400, 401, 429, 500), intentamos extraer el error de Amadeus
    if (error.response) {
      // Amadeus retorna errores en formato JSON con estructura AmadeusErrorResponse
      const amadeusError = error.response.data as AmadeusErrorResponse;

      // Si la respuesta tiene la estructura de error de Amadeus, creamos AmadeusApiError
      if (amadeusError && amadeusError.errors && Array.isArray(amadeusError.errors)) {
        // Logging de error con detalles para debugging
        this.logger.error('Error de Amadeus API', error.stack, undefined, {
          status: error.response.status,
          url: error.config?.url,
          errors: amadeusError.errors,
        });
        return new AmadeusApiError(amadeusError, error.response.status);
      }
    }

    // Si no hay respuesta o no es un error estructurado de Amadeus,
    // creamos un AmadeusApiError genérico con información del error de red
    this.logger.error('Error de red al conectar con Amadeus', error.stack, undefined, {
      message: error.message,
      code: error.code,
      url: error.config?.url,
    });

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
}
