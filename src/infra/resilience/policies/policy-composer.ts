import { wrap } from 'cockatiel';
import type { ResilienceOptions } from '../resilience.types';
import { createRetryPolicy } from './retry.policy';
import { createCircuitBreakerPolicy } from './circuit-breaker.policy';
import { createTimeoutPolicy } from './timeout.policy';

/**
 * Devuelve una política compuesta (wrap) a partir de opciones.
 * Orden (práctico): retry -> circuit-breaker -> timeout
 *
 * Nota: el orden de wrap(...) determina el orden en el que las políticas se aplican.
 * - Primero intentamos reintentar (retry) que internamente llamará al circuit-breaker,
 *   y el timeout se aplica a la ejecución interna.
 */
export function composePolicy(options?: ResilienceOptions): ReturnType<typeof wrap> {
  const timeoutPolicy =
    options?.enableTimeout === false ? null : createTimeoutPolicy(options?.timeoutMs ?? 1000);

  const retryPolicy =
    options?.enableRetry === false
      ? null
      : createRetryPolicy({
          maxAttempts: options?.retryAttempts ?? 2,
          baseDelayMs: options?.retryBaseDelayMs ?? 200,
          maxDelayMs: 2000,
          multiplier: 2,
        });

  const cbPolicy =
    options?.enableCircuitBreaker === false
      ? null
      : createCircuitBreakerPolicy({
          failureThreshold: 5,
          halfOpenAfterMs: 10_000,
          successThreshold: 1,
        });

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
