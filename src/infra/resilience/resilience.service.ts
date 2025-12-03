import { Injectable } from '@nestjs/common';
import type {
  ResilientFunction,
  ResilienceOptions,
  ResilienceResult,
  ResilienceMetrics,
  ResilienceException,
} from './resilience.types';
import { composePolicy } from './policies/policy-composer';
import { LoggerService } from '../logging/logger.service';

// Tipo de política compuesta de Cockatiel (retry + circuit-breaker + timeout)
// composePolicy usa internamente wrap() de cockatiel para combinar políticas
type ComposedPolicy = ReturnType<typeof composePolicy>;

/**
 * ResilienceService: expone execute / executeOrFallback para usar en providers externos.
 * - Crea y memoiza políticas por "policyKey" (ej: 'amadeus.search').
 * - Ejecuta la función dentro de la política compuesta.
 * - Captura metrics básicas y, en caso de fallo, lanza ResilienceException con métricas.
 */
@Injectable()
export class ResilienceService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(ResilienceService.name);
  }

  // Pool simple de políticas de Cockatiel por llave para reusar y no crear en cada llamada
  private policies = new Map<string, ComposedPolicy>();

  // Crea / obtiene policy compuesta de Cockatiel (a través de composePolicy)
  private getPolicy(policyKey: string, options?: ResilienceOptions): ComposedPolicy {
    if (!this.policies.has(policyKey)) {
      const policy = composePolicy(options);
      this.policies.set(policyKey, policy);
    }
    const policy = this.policies.get(policyKey);
    if (!policy) {
      throw new Error(`Failed to create policy for key: ${policyKey}`);
    }
    return policy;
  }

  /**
   * Ejecuta fn dentro de una política de resiliencia.
   * - policyKey: nombre lógico de la política (ej: 'amadeus.search')
   * - fn: función a ejecutar (sin parámetros)
   * - options: overrides por invocación
   */
  async execute<T = any>(
    policyKey: string,
    fn: ResilientFunction<T>,
    options?: ResilienceOptions,
  ): Promise<ResilienceResult<T>> {
    const policy = this.getPolicy(policyKey, options);

    const start = Date.now();
    try {
      // Ejecuta la función usando la política compuesta de Cockatiel
      // Las políticas de Cockatiel implementan execute(fn) que aplica retry, circuit-breaker y timeout
      const result = await policy.execute(fn);
      const duration = Date.now() - start;

      // Optionally log success
      this.logger.debug(`[resilience:${policyKey}] success (${duration}ms)`);

      return result as T;
    } catch (err: unknown) {
      const duration = Date.now() - start;
      const error = err instanceof Error ? err : new Error(String(err));
      const errorMessage = error.message || String(err);

      // Build a ResilienceException-like payload
      const exception: ResilienceException = {
        name: error.name || 'ResilienceError',
        message: errorMessage,
        originalError: error,
        metrics: {
          totalDurationMs: duration,
          success: false,
        } as ResilienceMetrics,
        policy: (error && 'policy' in error && typeof error.policy === 'string'
          ? error.policy
          : 'unknown') as ResilienceException['policy'],
      } as ResilienceException;

      this.logger.warn(`[resilience:${policyKey}] failure after ${duration}ms: ${errorMessage}`);

      throw exception;
    }
  }

  /**
   * Ejecuta con fallback. Si la ejecución falla, ejecuta fallbackFn
   */
  async executeOrFallback<T = any>(
    policyKey: string,
    fn: ResilientFunction<T>,
    fallbackFn: () => Promise<T>,
    options?: ResilienceOptions,
  ): Promise<T> {
    try {
      return await this.execute(policyKey, fn, options);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[resilience:${policyKey}] using fallback due to error: ${errorMessage}`);
      try {
        return await fallbackFn();
      } catch (fallbackErr: unknown) {
        const fallbackErrorMessage =
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        this.logger.error(`[resilience:${policyKey}] fallback failed: ${fallbackErrorMessage}`);
        throw fallbackErr;
      }
    }
  }
}
