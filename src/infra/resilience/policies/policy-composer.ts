import { wrap } from 'cockatiel';
import type { ResilienceOptions, CircuitBreakerPolicyConfig } from '../resilience.types';
import { createRetryPolicy } from './retry.policy';
import { createCircuitBreakerPolicy } from './circuit-breaker.policy';
import { createTimeoutPolicy } from './timeout.policy';
import type { LoggerService } from '../../logging/logger.service';

/**
 * Devuelve una política compuesta (wrap) a partir de opciones.
 * Orden (práctico): retry -> circuit-breaker -> timeout
 *
 * Nota: el orden de wrap(...) determina el orden en el que las políticas se aplican.
 * - Primero intentamos reintentar (retry) que internamente llamará al circuit-breaker,
 *   y el timeout se aplica a la ejecución interna.
 */
export function composePolicy(
  options?: ResilienceOptions,
  logger?: LoggerService,
): ReturnType<typeof wrap> {
  const timeoutPolicy =
    options?.enableTimeout === false
      ? null
      : createTimeoutPolicy(options?.timeoutMs ?? 1000, logger);

  const retryPolicy =
    options?.enableRetry === false
      ? null
      : createRetryPolicy(
          {
            maxAttempts: options?.retryAttempts ?? 2,
            baseDelayMs: options?.retryBaseDelayMs ?? 200,
            maxDelayMs: 2000, // Valor por defecto razonable (2 segundos)
            multiplier: 2, // Valor por defecto razonable (doble cada vez)
          },
          logger,
        );

  // Configuración por defecto del circuit breaker
  const defaultCircuitBreakerConfig: CircuitBreakerPolicyConfig = {
    failureThreshold: 3,
    halfOpenAfterMs: 10_000,
    successThreshold: 1,
  };

  // Determinar la configuración del circuit breaker a usar
  // Usamos aserción de tipo para evitar problemas de inferencia con el operador ??
  const circuitBreakerConfig: CircuitBreakerPolicyConfig =
    (options?.circuitBreaker as CircuitBreakerPolicyConfig | undefined) ??
    defaultCircuitBreakerConfig;

  const cbPolicy =
    options?.enableCircuitBreaker === false
      ? null
      : createCircuitBreakerPolicy(circuitBreakerConfig, logger);

  // Build array of policies to wrap; respect nulls
  const policies = [retryPolicy, cbPolicy, timeoutPolicy].filter(Boolean);

  if (policies.length === 0) {
    // No policy -> create a passthrough wrapper
    return {
      execute: <T>(fn: () => Promise<T>): Promise<T> => fn(),
    } as unknown as ReturnType<typeof wrap>;
  }

  return wrap(...(policies as Parameters<typeof wrap>));
}
