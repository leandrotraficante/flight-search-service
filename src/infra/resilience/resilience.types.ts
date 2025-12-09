// Token de inyección para identificar la instancia de ResilienceService en NestJS
// Similar a CACHE_CLIENT en cache.types.ts, permite inyectar el servicio usando @Inject()
export const RESILIENCE_SERVICE = 'RESILIENCE_SERVICE'; // Token string que identifica el servicio en el contenedor de DI

// Tipo que representa el resultado exitoso de una operación con resiliencia
// T es el tipo genérico del valor que retorna la función ejecutada
export type ResilienceResult<T> = T; // Alias simple: el resultado es del mismo tipo que la función original

// Tipo que representa un error que puede ocurrir durante la ejecución con resiliencia
// Puede ser cualquier tipo de error: Error nativo, HttpException, errores de red, etc.
export type ResilienceError = Error; // Acepta cualquier tipo de error para máxima flexibilidad

// Interfaz que define la forma de las opciones de configuración para ejecutar una operación con resiliencia
// Permite personalizar el comportamiento de timeout, retry y circuit breaker por operación
export interface ResilienceOptions {
  timeoutMs?: number; // Tiempo máximo en milisegundos antes de cancelar la operación (opcional, usa default si no se especifica)
  retryAttempts?: number; // Número de intentos de reintento en caso de fallo (opcional, usa default si no se especifica)
  retryBaseDelayMs?: number; // Delay base en milisegundos entre reintentos para backoff exponencial (opcional)
  enableCircuitBreaker?: boolean; // Flag para habilitar/deshabilitar circuit breaker para esta operación específica (opcional, default true)
  enableRetry?: boolean; // Flag para habilitar/deshabilitar retry para esta operación específica (opcional, default true)
  enableTimeout?: boolean; // Flag para habilitar/deshabilitar timeout para esta operación específica (opcional, default true)
  circuitBreaker?: CircuitBreakerPolicyConfig; // Configuración del circuit breaker (opcional, usa default si no se especifica)
}

// Interfaz que define la forma de las métricas de circuit breaker
// Permite monitorear el estado y comportamiento del circuit breaker
export interface CircuitBreakerMetrics {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'; // Estado actual del circuit breaker: CLOSED (normal), OPEN (bloqueado), HALF_OPEN (probando recuperación)
  failureCount: number; // Número acumulado de fallos desde la última apertura del circuito
  successCount: number; // Número acumulado de éxitos desde la última apertura del circuito
  lastFailureTime?: Date; // Timestamp del último fallo registrado (opcional, puede no existir si nunca falló)
  lastSuccessTime?: Date; // Timestamp del último éxito registrado (opcional, puede no existir si nunca tuvo éxito)
  openedAt?: Date; // Timestamp de cuándo se abrió el circuito (opcional, solo existe si el estado es OPEN o HALF_OPEN)
}

// Interfaz que define la forma de las métricas de retry
// Permite monitorear cuántos reintentos se realizaron y por qué
export interface RetryMetrics {
  attempts: number; // Número total de intentos realizados (incluye el intento inicial + reintentos)
  lastAttemptTime?: Date; // Timestamp del último intento (opcional, puede no existir si nunca se intentó)
  errors: ResilienceError[]; // Array de errores capturados en cada intento fallido (útil para debugging)
}

// Interfaz que define la forma de las métricas de timeout
// Permite monitorear si las operaciones se completaron a tiempo o fueron canceladas
export interface TimeoutMetrics {
  timedOut: boolean; // Indica si la operación excedió el timeout y fue cancelada
  durationMs?: number; // Duración real de la operación en milisegundos (opcional, solo si no hubo timeout)
  timeoutMs: number; // Tiempo máximo configurado para esta operación
}

// Interfaz que agrupa todas las métricas de resiliencia
// Proporciona una vista completa del comportamiento de las políticas aplicadas
export interface ResilienceMetrics {
  circuitBreaker?: CircuitBreakerMetrics; // Métricas del circuit breaker (opcional, solo si está habilitado)
  retry?: RetryMetrics; // Métricas de retry (opcional, solo si está habilitado)
  timeout?: TimeoutMetrics; // Métricas de timeout (opcional, solo si está habilitado)
  totalDurationMs: number; // Duración total de la ejecución incluyendo todos los reintentos y esperas
  success: boolean; // Indica si la operación finalizó exitosamente después de aplicar todas las políticas
}

// Tipo que representa una función que puede ser ejecutada con políticas de resiliencia
// T es el tipo de retorno de la función
// La función debe ser asíncrona (retorna Promise) para poder aplicar timeout y retry
export type ResilientFunction<T> = () => Promise<T>; // Función sin parámetros que retorna una Promise del tipo T

// Interfaz que define la forma de un error personalizado de resiliencia
// Extiende Error nativo para mantener compatibilidad pero agrega información adicional
export interface ResilienceException extends Error {
  originalError: ResilienceError; // El error original que causó el fallo (útil para debugging y logging)
  metrics: ResilienceMetrics; // Métricas completas de la ejecución que falló (permite analizar qué política falló)
  policy: 'timeout' | 'retry' | 'circuit-breaker' | 'unknown'; // Identifica qué política causó el fallo final
}

// Tipo que representa el estado de un circuit breaker
// Usado internamente por las políticas pero también exportado para uso externo (monitoreo, health checks)
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'; // Estados posibles del circuit breaker según el patrón estándar

// Interfaz que define la forma de un evento de cambio de estado del circuit breaker
// Útil para logging y monitoreo cuando el circuit breaker cambia de estado
export interface CircuitBreakerStateChange {
  from: CircuitBreakerState; // Estado anterior del circuit breaker
  to: CircuitBreakerState; // Nuevo estado del circuit breaker
  timestamp: Date; // Momento exacto en que ocurrió el cambio de estado
  reason?: string; // Razón del cambio (opcional, ej: "failure threshold exceeded", "success threshold reached")
}

// Tipo que representa una condición para decidir si se debe hacer retry de un error
// Función que recibe el error y retorna true si se debe reintentar, false si no
// Permite personalizar qué tipos de errores son "retryables" (ej: solo errores 5xx, no 4xx)
export type RetryCondition = (error: ResilienceError) => boolean; // Función predicado que determina si un error es retryable

// Interfaz que define la forma de configuración para una política de retry específica
// Permite personalizar el comportamiento de retry más allá de los valores por defecto
export interface RetryPolicyConfig {
  maxAttempts: number; // Número máximo de intentos (incluye el intento inicial)
  baseDelayMs: number; // Delay base en milisegundos para el primer reintento
  maxDelayMs: number; // Delay máximo en milisegundos (limita el crecimiento exponencial)
  multiplier: number; // Multiplicador para backoff exponencial (ej: 2 = dobla el delay en cada intento)
  condition?: RetryCondition; // Condición personalizada para decidir si hacer retry (opcional, usa default si no se especifica)
}

// Interfaz que define la forma de configuración para una política de timeout específica
// Permite personalizar el comportamiento de timeout más allá de los valores por defecto
export interface TimeoutPolicyConfig {
  timeoutMs: number; // Tiempo máximo en milisegundos antes de cancelar la operación
  abortSignal?: AbortSignal; // Signal opcional para cancelación manual (compatible con fetch API y otras APIs modernas)
}

// Interfaz que define la forma de configuración para una política de circuit breaker específica
// Permite personalizar el comportamiento de circuit breaker más allá de los valores por defecto
export interface CircuitBreakerPolicyConfig {
  failureThreshold: number; // Número de fallos consecutivos necesarios para abrir el circuito
  halfOpenAfterMs: number; // Tiempo en milisegundos que permanece abierto antes de intentar recuperación (estado HALF_OPEN)
  successThreshold: number; // Número de éxitos necesarios en HALF_OPEN para cerrar el circuito completamente
  onStateChange?: (change: CircuitBreakerStateChange) => void; // Callback opcional que se ejecuta cuando cambia el estado (útil para logging)
}
