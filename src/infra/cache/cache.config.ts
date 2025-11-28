// Define la forma de la configuracion, lo usamos en Dependency Injection

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  ttlSeconds: number;
}

//Funcion que lee las variables de entorno y devuelve la configuracion; en caso de no tener .env levanta los defaults
// es Function y no const porque el nombre debe comunicar "esto es una factory, no un valor".
// Las funciones nombradas son más fáciles de debuggear.
export function cacheConfigFactory(): CacheConfig {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    ttlSeconds: Number(process.env.REDIS_TTL_SECONDS ?? 3600),
  };
}
