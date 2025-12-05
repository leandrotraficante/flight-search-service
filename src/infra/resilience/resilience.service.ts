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
  // Límite máximo para prevenir memory leaks
  private policies = new Map<string, ComposedPolicy>();
  private readonly MAX_POLICIES = 100;

  // Crea / obtiene policy compuesta de Cockatiel (a través de composePolicy)
  // Si hay options, no cacheamos la política (creamos una nueva cada vez)
  // Esto permite que diferentes llamadas con diferentes options usen políticas diferentes
  private getPolicy(policyKey: string, options?: ResilienceOptions): ComposedPolicy {
    // Si hay options, no cachear (crear nueva política cada vez)
    // Esto evita que políticas con diferentes options se reutilicen incorrectamente
    if (options) {
      return composePolicy(options);
    }

    // Solo cachear si no hay options
    // Si alcanzamos el límite y la key no existe, eliminar la más antigua (FIFO)
    if (this.policies.size >= this.MAX_POLICIES && !this.policies.has(policyKey)) {
      const firstKey = this.policies.keys().next().value;
      // Verificamos que firstKey no sea undefined (aunque no debería serlo si size >= MAX_POLICIES)
      if (firstKey !== undefined) {
        this.policies.delete(firstKey);
        this.logger.debug(`Policy cache limit reached, removed: ${firstKey}`, undefined, {
          removedKey: firstKey,
          currentSize: this.policies.size,
          maxSize: this.MAX_POLICIES,
        });
      }
    }

    if (!this.policies.has(policyKey)) {
      const policy = composePolicy();
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
  async execute<T = unknown>(
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
  async executeOrFallback<T = unknown>(
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
