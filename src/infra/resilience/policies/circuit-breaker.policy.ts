import { circuitBreaker, CircuitBreakerPolicy, ConsecutiveBreaker, handleAll } from 'cockatiel';
import type { CircuitBreakerPolicyConfig } from '../resilience.types';

// ConsecutiveBreaker: abre el circuito después de N fallos consecutivos.
// halfOpenAfter: período en ms tras el cuál se hace el intento en half-open.
export function createCircuitBreakerPolicy(config?: CircuitBreakerPolicyConfig) {
  const failureThreshold = config?.failureThreshold ?? 5;
  const halfOpenAfter = config?.halfOpenAfterMs ?? 10_000; // 10s por defecto

  const breaker = new ConsecutiveBreaker(failureThreshold);

  const policy = circuitBreaker(handleAll, {
    halfOpenAfter,
    breaker,
  });

  // Hook opcional para onStateChange
  if (config?.onStateChange) {
    // El objeto `policy` tiene eventos; conectate a onFailure/onSuccess/onHalfOpen/onBreak/onReset
    (policy as unknown as CircuitBreakerPolicy).onBreak?.(() => {
      config.onStateChange?.({
        from: 'CLOSED',
        to: 'OPEN',
        timestamp: new Date(),
        reason: 'failure threshold exceeded',
      });
    });

    (policy as unknown as CircuitBreakerPolicy).onHalfOpen?.(() => {
      config.onStateChange?.({
        from: 'OPEN',
        to: 'HALF_OPEN',
        timestamp: new Date(),
        reason: 'half-open check',
      });
    });

    (policy as unknown as CircuitBreakerPolicy).onReset?.(() => {
      config.onStateChange?.({
        from: 'HALF_OPEN',
        to: 'CLOSED',
        timestamp: new Date(),
        reason: 'success threshold reached',
      });
    });
  }

  return policy;
}
