import { AppConfigService, ResilienceConfig } from '../../config/config';
// Define la forma de la configuración, lo usamos en Dependency Injection

// Re-exportar interfaces desde config.ts para mantener compatibilidad
export type { CircuitBreakerConfig, ResilienceConfig } from '../../config/config';

// Función que lee las variables de entorno y devuelve la configuración; en caso de no tener .env levanta los defaults
// Es Function y no const porque el nombre debe comunicar "esto es una factory, no un valor".
// Las funciones nombradas son más fáciles de debuggear.
// Usa AppConfigService para mantener consistencia con cache.config.ts y pasar por la capa de configuración centralizada
export function resilienceConfigFactory(appConfigService: AppConfigService): ResilienceConfig {
  // Usa AppConfigService.resilience que lee las variables de entorno a través de ConfigService
  // Esto mantiene la consistencia: todas las configuraciones pasan por config.ts
  return {
    timeoutMs: appConfigService.resilience.timeoutMs,
    retryAttempts: appConfigService.resilience.retryAttempts,
    retryBaseDelayMs: appConfigService.resilience.retryBaseDelayMs,
    circuitBreaker: {
      failureThreshold: appConfigService.resilience.circuitBreaker.failureThreshold,
      halfOpenAfterMs: appConfigService.resilience.circuitBreaker.halfOpenAfterMs,
      successThreshold: appConfigService.resilience.circuitBreaker.successThreshold,
    },
  };
}
