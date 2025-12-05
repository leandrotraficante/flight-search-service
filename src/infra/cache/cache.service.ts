// Importamos decoradores y utilidades de NestJS para inyección de dependencias y logging
import { Inject, Injectable } from '@nestjs/common';
// Importamos el token de inyección (valor constante) que identifica al cliente de cache
import { CACHE_CLIENT } from './cache.types';
// Importamos el tipo/interfaz del cliente (solo para tipado, no se incluye en el código compilado)
import type { CacheClient } from './cache.types';
import { LoggerService } from '../logging/logger.service';
// Importamos Redis de ioredis para type assertion cuando necesitamos métodos avanzados
import type Redis from 'ioredis';

// Decorador que marca esta clase como un servicio inyectable en NestJS
@Injectable()
export class CacheService {
  // Contador de hits: cada vez que encontramos un valor en cache, incrementamos esto
  // Es privado para que solo esta clase pueda modificarlo
  private hitCount = 0;
  // Contador de misses: cada vez que NO encontramos un valor en cache, incrementamos esto
  // Nos ayuda a medir la efectividad del cache
  private missCount = 0;

  // Constructor con inyección de dependencias: NestJS inyecta automáticamente el cliente de cache
  constructor(
    // @Inject indica qué token usar para buscar la dependencia en el contenedor de NestJS
    // CACHE_CLIENT es el token que identifica la instancia de Redis/cache que queremos
    @Inject(CACHE_CLIENT)
    // readonly previene modificaciones accidentales después de la inicialización
    // CacheClient es la interfaz que define los métodos disponibles (get, set, del)
    private readonly client: CacheClient,
    private readonly logger: LoggerService,
  ) {}

  // Crear keys consistentes para evitar errores humanos. --> Este método ayuda a construir keys de forma uniforme usando el patrón de separación por ':'
  composeKey(...parts: string[]): string {
    // filter(Boolean) elimina valores falsy (null, undefined, '', 0, false)
    // Esto previene keys malformadas como "user::123" si alguna parte está vacía
    // join(':') une las partes con ':' como separador, estilo Redis (ej: "user:profile:123")
    return parts.filter(Boolean).join(':');
  }

  // Obtener valor desde Redis --> Método genérico que intenta parsear JSON automáticamente, pero fallback a string si falla
  // T = unknown por defecto para mayor seguridad de tipos (requiere type assertion explícito si se espera un tipo específico)
  async get<T = unknown>(key: string): Promise<T | null> {
    // try-catch externo: captura errores de conexión o problemas con Redis
    try {
      // Obtenemos el valor crudo desde Redis (siempre es string o null)
      const raw = await this.client.get(key);

      // Si Redis devuelve null, significa que la key no existe en cache
      if (raw === null) {
        // Incrementamos el contador de misses para métricas
        this.missCount++;
        // Logging verbose para debugging: nos dice cuándo no encontramos algo
        this.logger.debug(`MISS → ${key}`);
        // Retornamos null para indicar que no hay valor cacheado
        return null;
      }

      // Si llegamos aquí, encontramos el valor (HIT)
      // Incrementamos el contador de hits para métricas
      this.hitCount++;
      // Logging para saber que encontramos el valor en cache
      this.logger.debug(`HIT → ${key}`);

      // try-catch interno: intenta parsear como JSON, pero si falla devuelve el string crudo
      try {
        // JSON.parse convierte el string a objeto/array/valor JavaScript
        // as T le dice a TypeScript que trate el resultado como el tipo genérico T
        return JSON.parse(raw) as T;
      } catch {
        // Si JSON.parse falla (no era JSON válido), devolvemos el string tal cual
        // Esto permite cachear strings simples sin necesidad de JSON.stringify
        // as T mantiene la compatibilidad de tipos
        return raw as T;
      }
    } catch (err) {
      // Si hay error de conexión o cualquier otro problema con Redis
      // Loggeamos el error para debugging pero no lanzamos excepción
      this.logger.error(
        `Error al obtener key ${key}`,
        err instanceof Error ? err.stack : undefined,
        undefined,
        {
          error: err instanceof Error ? err.message : String(err),
          errorType: err instanceof Error ? err.constructor.name : typeof err,
        },
      ); // La aplicación puede continuar funcionando aunque el cache falle
      return null;
    }
  }

  // Guardar valor con TTL (segundos) --> Convierte cualquier valor a JSON y lo guarda en Redis con expiración automática
  // T = unknown por defecto para mayor seguridad de tipos (requiere type assertion explícito si se espera un tipo específico)
  async set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void> {
    // try-catch para manejar errores de conexión o escritura
    try {
      if (value === undefined) {
        throw new Error('Cannot cache undefined value');
      }

      // JSON.stringify convierte cualquier objeto/array/valor a string JSON
      // Esto permite guardar estructuras complejas en Redis (que solo acepta strings)
      const payload = JSON.stringify(value);

      // Guardamos en Redis con el comando SET
      // 'EX' indica que el siguiente parámetro es el TTL en segundos
      // ttlSeconds define cuántos segundos hasta que expire automáticamente
      await this.client.set(key, payload, 'EX', ttlSeconds);

      // Logging en nivel debug para rastrear qué se guarda (menos verboso que verbose)
      this.logger.debug(`SET → ${key} (TTL ${ttlSeconds}s)`);
    } catch (err) {
      // Si falla la escritura, loggeamos pero no lanzamos excepción, Esto permite que la app continúe aunque el cache falle
      this.logger.error(
        `Error al setear key ${key}`,
        err instanceof Error ? err.stack : undefined,
        undefined,
        { err: err instanceof Error ? err.message : String(err) },
      );
    }
  }

  // Eliminar manualmente keys --> Útil para invalidar cache cuando los datos cambian en la fuente original
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key); // del() elimina la key de Redis, retorna el número de keys eliminadas
      this.logger.debug(`DEL → ${key}`); // Logging para confirmar la eliminación
    } catch (err) {
      // Si falla la eliminación, logueamos pero no lanzamos excepción, Esto permite que la app continúe aunque el cache falle
      this.logger.error(
        `Error al eliminar key ${key}`,
        err instanceof Error ? err.stack : undefined,
        undefined,
        { err: err instanceof Error ? err.message : String(err) },
      );
    }
  }

  // Eliminar múltiples keys que coincidan con un patrón
  // Útil para invalidar cache de búsquedas relacionadas (ej: todas las búsquedas de un origen específico)
  // Parámetro: pattern - Patrón de búsqueda (ej: "search:flights:JFK:*" o "search:flights:*")
  // Retorna: Promise<number> - Número de keys eliminadas
  // Nota: Usa SCAN en lugar de KEYS para evitar bloquear Redis con muchas keys
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      // ioredis tiene acceso a métodos de Redis directamente
      // Necesitamos hacer un cast para acceder a métodos que no están en la interfaz CacheClient
      // El cliente real es una instancia de Redis de ioredis, pero está tipado como CacheClient
      const redisClient = this.client as unknown as Redis;

      // Usamos SCAN para buscar keys que coincidan con el patrón
      // SCAN es más seguro que KEYS porque no bloquea Redis
      const stream = redisClient.scanStream({
        match: pattern, // Patrón de búsqueda (ej: "search:flights:JFK:*")
        count: 100, // Procesa 100 keys por iteración
      });

      const keysToDelete: string[] = [];

      // Esperamos a que termine el stream y recopilamos todas las keys
      return new Promise<number>((resolve, reject) => {
        // Recopilamos todas las keys que coinciden con el patrón
        stream.on('data', (keys: string[]) => {
          keysToDelete.push(...keys);
        });

        // Cuando terminamos de escanear, eliminamos todas las keys encontradas
        stream.on('end', () => {
          // Usamos una función async inmediatamente invocada (IIFE) para manejar async/await
          // void indica que intencionalmente no esperamos este Promise (el callback debe ser síncrono)
          void (async () => {
            try {
              if (keysToDelete.length > 0) {
                // Límite máximo de keys a eliminar para evitar sobrecargar Redis
                // Si hay demasiadas keys, limitamos y logueamos una advertencia
                const MAX_KEYS_TO_DELETE = 10000;
                let keysToProcess = keysToDelete;

                if (keysToDelete.length > MAX_KEYS_TO_DELETE) {
                  this.logger.warn(
                    `Pattern matches ${keysToDelete.length} keys, limiting to ${MAX_KEYS_TO_DELETE}`,
                    undefined,
                    { pattern, totalKeys: keysToDelete.length, maxKeys: MAX_KEYS_TO_DELETE },
                  );
                  keysToProcess = keysToDelete.slice(0, MAX_KEYS_TO_DELETE);
                }

                let deletedCount = 0;
                // Eliminamos todas las keys de una vez usando DEL con múltiples keys
                // Si hay muchas keys, las eliminamos en lotes para evitar sobrecargar Redis
                const batchSize = 100;
                for (let i = 0; i < keysToProcess.length; i += batchSize) {
                  const batch = keysToProcess.slice(i, i + batchSize);
                  // del() de ioredis acepta múltiples keys como argumentos separados
                  const deleted = await redisClient.del(...batch);
                  deletedCount += deleted;
                }

                this.logger.info(
                  `DEL PATTERN → ${pattern} (${deletedCount} keys eliminadas)`,
                  undefined,
                  {
                    pattern,
                    keysDeleted: deletedCount,
                  },
                );
                resolve(deletedCount);
              } else {
                this.logger.debug(`DEL PATTERN → ${pattern} (0 keys encontradas)`, undefined, {
                  pattern,
                });
                resolve(0);
              }
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          })();
        });

        stream.on('error', (error: Error) => {
          this.logger.error(
            `Error al eliminar keys por patrón: ${pattern}`,
            error.stack,
            undefined,
            { pattern },
          );
          reject(error);
        });
      });
    } catch (err) {
      // Si hay error, lo logueamos pero no lanzamos excepción (fail-safe)
      this.logger.error(
        `Error al eliminar keys por patrón: ${pattern}`,
        err instanceof Error ? err.stack : undefined,
        undefined,
        { pattern, err },
      );
      return 0;
    }
  }

  // Cache-aside: si existe, devuelve; si no, ejecuta la función.
  // Patrón común: primero busca en cache, si no está, ejecuta la función y guarda el resultado
  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    // Primero intentamos obtener el valor desde cache, <T> indica que esperamos el mismo tipo que retorna la función
    const cached = await this.get<T>(key);
    // Si encontramos algo en cache (no es null), lo devolvemos inmediatamente, Esto evita ejecutar la función costosa (consultas a BD, APIs externas, etc.)
    if (cached !== null) {
      return cached;
    }

    // Si no está en cache, ejecutamos la función que obtiene los datos frescos
    // Esta función puede ser costosa (consulta a BD, llamada a API, cálculo pesado)
    const result = await fn();

    // Guardamos el resultado en cache de forma asíncrona y no bloqueante
    // Si falla el guardado, no afecta la respuesta ya que el resultado ya fue obtenido
    // Usamos .catch() para asegurar que cualquier error no se propague
    this.set(key, result, ttlSeconds).catch((err) => {
      // Si hay un error al guardar en cache, lo logueamos pero no afecta la respuesta
      // Esto es importante porque el resultado ya fue retornado y la respuesta HTTP ya fue enviada
      this.logger.error(
        `Error al guardar en cache después de wrap (no crítico)`,
        err instanceof Error ? err.stack : undefined,
        undefined,
        { key, ttlSeconds },
      );
    });

    return result; // Retornamos el resultado fresco (tanto para uso inmediato como para cache futuro)
  }

  //Obtener métricas internas --> Útil para monitorear la efectividad del cache (ratio de hits vs misses)
  getStats() {
    // Retornamos un objeto con las métricas acumuladas
    return {
      hits: this.hitCount, // Número de veces que encontramos valores en cache (éxito)
      misses: this.missCount, // Número de veces que NO encontramos valores en cache (fallo)
    };
    // Con estas métricas puedes calcular: hitRate = hits / (hits + misses)
    // Un hitRate alto (>80%) indica que el cache está funcionando bien
  }
}
