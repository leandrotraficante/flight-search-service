export const CACHE_CLIENT = 'CACHE_CLIENT';
/*
Un token de NestJS que representa la instancia de Redis.
En Nest, no inyectás clases directamente, sino tokens.
Esto permite desacoplar infraestructura de la lógica.
*/

// Define la forma de la interfaz de Redis, lo usamos en Dependency Injection
export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null>;
  del(key: string): Promise<number>;
}
