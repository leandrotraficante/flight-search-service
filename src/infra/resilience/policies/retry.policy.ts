import { retry, handleAll, ExponentialBackoff } from 'cockatiel';
import type { RetryPolicyConfig } from '../resilience.types';

// handleAll: maneja cualquier error como retryable por defecto (podés pasar condition personalizada).
// ExponentialBackoff: backoff exponencial por defecto.
export function createRetryPolicy(config?: RetryPolicyConfig) {
  const cfg = {
    maxAttempts: config?.maxAttempts ?? 3,
    // ExponentialBackoff sin opciones es suficiente para la mayoría de casos.
    backoff: new ExponentialBackoff(),
  };

  return retry(handleAll, {
    maxAttempts: cfg.maxAttempts,
    backoff: cfg.backoff,
  });
}
