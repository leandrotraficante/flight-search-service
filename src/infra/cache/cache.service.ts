// Importamos los decoradores de NestJS para inyección de dependencias
import { Inject, Injectable } from '@nestjs/common';
// Importamos el token de inyección (un string constante que identifica el provider)
import { CACHE_CLIENT } from './cache.types';
// Importamos el tipo de la interfaz (usamos 'import type' porque solo se usa como tipo, no como valor)
import type { CacheClient } from './cache.types';

// @Injectable() marca esta clase como un servicio que puede ser inyectado en otros componentes
// NestJS creará una instancia singleton de este servicio automáticamente
@Injectable()
export class CacheService {
  // Constructor con inyección de dependencias
  constructor(
    // @Inject(CACHE_CLIENT) le dice a NestJS que inyecte el provider identificado por el token CACHE_CLIENT
    // Esto permite desacoplar la implementación concreta (ioredis) de esta clase
    @Inject(CACHE_CLIENT)
    // private readonly: solo accesible dentro de la clase y no se puede reasignar después de la construcción
    // CacheClient es la interfaz que define el contrato que debe cumplir el cliente de cache
    private readonly client: CacheClient,
  ) {}

  // Método helper para crear keys consistentes y evitar errores de formato
  // Usa rest parameters (...parts) para aceptar cualquier cantidad de strings
  composeKey(...parts: string[]): string {
    // filter(Boolean) elimina valores falsy (null, undefined, '', etc.) para evitar keys inválidas
    // join(':') une las partes con ':' que es el separador estándar en Redis para crear jerarquías
    // Ejemplo: composeKey('user', '123', 'profile') -> 'user:123:profile'
    return parts.filter(Boolean).join(':');
  }

  // Método genérico para obtener valores desde Redis
  // <T = any> permite especificar el tipo de dato esperado, con 'any' como default
  async get<T = any>(key: string): Promise<T | null> {
    // Llama al método get del cliente Redis que devuelve el valor como string o null si no existe
    const raw = await this.client.get(key);
    // Si no hay valor, retornamos null inmediatamente (early return pattern)
    if (!raw) return null;
    try {
      // Intentamos parsear el JSON porque guardamos los valores serializados como JSON
      // as T hace un type assertion al tipo genérico especificado
      return JSON.parse(raw) as T;
    } catch {
      // Si falla el parseo (por ejemplo, si el valor no es JSON válido), retornamos el valor raw
      // Esto permite flexibilidad para guardar strings simples sin JSON
      return raw as T;
    }
  }

  // Método para guardar valores en Redis con TTL (Time To Live)
  // TTL define cuánto tiempo (en segundos) el valor permanecerá en cache antes de expirar
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    // Serializamos el valor a JSON string porque Redis solo almacena strings
    // Esto permite guardar objetos, arrays, etc. de forma estructurada
    const payload = JSON.stringify(value);
    // Llamamos al método set del cliente Redis con 4 argumentos:
    // 1. key: la clave donde se guardará el valor
    // 2. payload: el valor serializado como string
    // 3. 'EX': comando de Redis que significa "expire" (expiración en segundos)
    // 4. ttlSeconds: el tiempo en segundos hasta que expire el valor
    // Redis automáticamente eliminará la key después de ttlSeconds segundos
    await this.client.set(key, payload, 'EX', ttlSeconds);
  }

  // Método para eliminar manualmente una key del cache
  // Útil cuando necesitamos invalidar cache antes de que expire naturalmente
  async delete(key: string): Promise<void> {
    // Llama al método del del cliente Redis que elimina la key especificada
    // Retorna el número de keys eliminadas (0 si no existía, 1 si existía)
    await this.client.del(key);
  }

  // Patrón Cache-Aside: primero busca en cache, si no existe ejecuta la función y guarda el resultado
  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    // Primero intentamos obtener el valor desde cache usando la key proporcionada
    const cached = await this.get<T>(key);
    // Si encontramos un valor en cache (no es null), lo retornamos inmediatamente
    // Esto evita ejecutar la función costosa y mejora el rendimiento
    if (cached !== null) {
      return cached;
    }
    // Si no hay valor en cache, ejecutamos la función proporcionada (fn)
    // Esta función típicamente hace una consulta a BD, API externa, etc.
    const result = await fn();
    // Guardamos el resultado en cache para futuras consultas
    // Usamos el mismo ttlSeconds para que expire después del tiempo especificado
    await this.set(key, result, ttlSeconds);
    // Retornamos el resultado obtenido
    return result;
  }
}
