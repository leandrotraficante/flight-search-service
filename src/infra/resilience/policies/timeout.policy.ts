import { TimeoutPolicy, TimeoutStrategy } from 'cockatiel';
import type { LoggerService } from '../../logging/logger.service';

export function createTimeoutPolicy(
  timeoutMs: number = 1000,
  logger?: LoggerService,
): TimeoutPolicy {
  const policy = new TimeoutPolicy(timeoutMs, {
    strategy: TimeoutStrategy.Cooperative,
  });

  // Suscribirse a eventos de timeout para logging
  if (logger) {
    // Event<T> es una función que recibe un listener y retorna un IDisposable
    policy.onTimeout(() => {
      logger.warn(`Operation timed out after ${timeoutMs}ms`, undefined, {
        timeoutMs,
      });
    });
  }

  return policy;
}
