import { retry, handleAll, handleWhen, ExponentialBackoff } from 'cockatiel';
import type { RetryPolicyConfig, RetryCondition } from '../resilience.types';
import type { LoggerService } from '../../logging/logger.service';

// handleAll: maneja cualquier error como retryable por defecto (podés pasar condition personalizada).
// ExponentialBackoff: backoff exponencial configurable.
export function createRetryPolicy(config?: RetryPolicyConfig, logger?: LoggerService) {
  const maxAttempts = config?.maxAttempts ?? 3;
  const baseDelayMs = config?.baseDelayMs ?? 200;
  const maxDelayMs = config?.maxDelayMs ?? 2000;
  const exponent = config?.multiplier ?? 2; // multiplier se mapea a exponent en cockatiel
  const condition: RetryCondition | undefined = config?.condition;

  // ExponentialBackoff con opciones personalizadas
  // initialDelay: delay inicial en ms (baseDelayMs)
  // maxDelay: delay máximo en ms (maxDelayMs)
  // exponent: exponente para el backoff exponencial (multiplier)
  const backoff = new ExponentialBackoff({
    initialDelay: baseDelayMs,
    maxDelay: maxDelayMs,
    exponent: exponent,
  });

  // Usamos la condición personalizada si está definida, sino handleAll
  // handleWhen crea un Policy desde una función predicado
  // handleAll acepta cualquier error como retryable
  const retryPolicy = condition
    ? handleWhen((err: Error) => {
        // La condición personalizada recibe un Error y retorna boolean
        return condition(err);
      })
    : handleAll;

  const policy = retry(retryPolicy, {
    maxAttempts,
    backoff,
  });

  // Suscribirse a eventos de retry para logging
  if (logger) {
    // Evento que se dispara cuando se hace un retry (antes del backoff)
    // Event<T> es una función que recibe un listener y retorna un IDisposable
    // FailureReason puede ser { error: Error } o { value: ReturnType }
    policy.onRetry((event) => {
      const errorMessage =
        'error' in event && event.error instanceof Error
          ? event.error.message
          : 'value' in event
            ? String(event.value)
            : 'Unknown error';

      logger.debug(
        `Retry attempt ${event.attempt}/${maxAttempts} after ${event.delay}ms delay`,
        undefined,
        {
          attempt: event.attempt,
          maxAttempts,
          delayMs: event.delay,
          error: errorMessage,
        },
      );
    });

    // Evento que se dispara cuando se da por vencido (todos los retries fallaron)
    policy.onGiveUp((event) => {
      const errorMessage =
        'error' in event && event.error instanceof Error
          ? event.error.message
          : 'value' in event
            ? String(event.value)
            : 'Unknown error';
      const errorStack =
        'error' in event && event.error instanceof Error ? event.error.stack : undefined;
      const errorType =
        'error' in event && event.error instanceof Error
          ? event.error.constructor.name
          : 'Unknown';

      logger.warn(`Retry policy gave up after ${maxAttempts} attempts`, errorStack, {
        maxAttempts,
        finalError: errorMessage,
        errorType,
      });
    });
  }

  return policy;
}
