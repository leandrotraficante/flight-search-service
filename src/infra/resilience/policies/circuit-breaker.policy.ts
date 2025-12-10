import { circuitBreaker, CircuitBreakerPolicy, ConsecutiveBreaker, handleAll } from 'cockatiel';
import type { CircuitBreakerPolicyConfig, CircuitBreakerStateChange } from '../resilience.types';
import type { LoggerService } from '../../logging/logger.service';

// ConsecutiveBreaker: abre el circuito después de N fallos consecutivos.
// halfOpenAfter: período en ms tras el cuál se hace el intento en half-open.
export function createCircuitBreakerPolicy(
  config?: CircuitBreakerPolicyConfig,
  logger?: LoggerService,
) {
  const failureThreshold = config?.failureThreshold ?? 3; // Alineado con config.ts default
  const halfOpenAfter = config?.halfOpenAfterMs ?? 10_000; // 10s por defecto

  const breaker = new ConsecutiveBreaker(failureThreshold);

  const policy = circuitBreaker(handleAll, {
    halfOpenAfter,
    breaker,
  });

  // Función helper para loguear cambios de estado
  const logStateChange = (change: CircuitBreakerStateChange) => {
    if (!logger) return;

    const { from, to, reason } = change;
    const message = `Circuit breaker state changed: ${from} → ${to}`;

    // Logging según el estado: OPEN es crítico (warn), HALF_OPEN es importante (info), CLOSED es informativo (info)
    if (to === 'OPEN') {
      logger.warn(message, undefined, {
        reason,
        timestamp: change.timestamp.toISOString(),
        failureThreshold,
      });
    } else if (to === 'HALF_OPEN') {
      logger.info(message, undefined, {
        reason,
        timestamp: change.timestamp.toISOString(),
      });
    } else if (to === 'CLOSED') {
      logger.info(message, undefined, {
        reason,
        timestamp: change.timestamp.toISOString(),
      });
    }
  };

  // Hook para onStateChange: combina callback personalizado con logging
  const combinedOnStateChange = (change: CircuitBreakerStateChange) => {
    // Loguear el cambio de estado
    logStateChange(change);
    // Llamar al callback personalizado si existe
    config?.onStateChange?.(change);
  };

  // El objeto `policy` tiene eventos; conectate a onBreak/onHalfOpen/onReset
  // Event<T> es una función que recibe un listener y retorna un IDisposable
  const cbPolicy = policy as unknown as CircuitBreakerPolicy;

  // onBreak recibe FailureReason<unknown> | { isolated: true } como parámetro
  cbPolicy.onBreak((reason) => {
    const reasonText =
      'isolated' in reason
        ? 'manually isolated'
        : 'error' in reason && reason.error instanceof Error
          ? reason.error.message
          : 'failure threshold exceeded';

    combinedOnStateChange({
      from: 'CLOSED',
      to: 'OPEN',
      timestamp: new Date(),
      reason: reasonText,
    });
  });

  // onHalfOpen no recibe parámetros
  cbPolicy.onHalfOpen(() => {
    combinedOnStateChange({
      from: 'OPEN',
      to: 'HALF_OPEN',
      timestamp: new Date(),
      reason: 'half-open check',
    });
  });

  // onReset no recibe parámetros
  cbPolicy.onReset(() => {
    combinedOnStateChange({
      from: 'HALF_OPEN',
      to: 'CLOSED',
      timestamp: new Date(),
      reason: 'success threshold reached',
    });
  });

  return policy;
}
