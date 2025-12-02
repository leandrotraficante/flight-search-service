import { Controller, Get, Query } from '@nestjs/common';
import { CacheService } from '../infra/cache/cache.service';

// Decorador que define la ruta base del controlador: todas las rutas empezarán con /debug/cache
@Controller('debug/cache')
// Clase del controlador que maneja las peticiones de debug del cache
export class CacheDebugController {
  constructor(private readonly cache: CacheService) {}

  // GET /debug/cache/set?key=foo&value=bar
  // Decorador que mapea peticiones GET a la ruta /debug/cache/set
  @Get('set')
  // Método asíncrono que recibe 'key' y 'value' desde los query params de la URL
  async set(@Query('key') key: string, @Query('value') value: string) {
    // Guarda el valor en cache con TTL de 60 segundos (await espera a que termine la operación)
    await this.cache.set(key, value, 60);
    // Retorna un objeto JSON confirmando que se guardó correctamente
    return { ok: true, key, value };
  }

  // GET /debug/cache/get?key=foo
  // Decorador que mapea peticiones GET a la ruta /debug/cache/get
  @Get('get')
  // Método asíncrono que recibe 'key' desde los query params de la URL
  async get(@Query('key') key: string) {
    // Obtiene el valor del cache usando la key (unknown es tipo seguro, requiere verificación antes de usar)
    const value: unknown = await this.cache.get(key);
    // Retorna un objeto JSON con la key y el valor encontrado (o null si no existe)
    return { key, value };
  }

  // GET /debug/cache/wrap?key=foo
  // Decorador que mapea peticiones GET a la ruta /debug/cache/wrap
  @Get('wrap')
  // Método asíncrono que recibe 'key' desde los query params de la URL
  async wrap(@Query('key') key: string) {
    // Usa el patrón cache-aside: busca en cache, si no existe ejecuta la función y guarda el resultado
    const result = await this.cache.wrap(key, 60, () => {
      // Función que genera un objeto con timestamp actual (Promise.resolve convierte el valor en Promise)
      return Promise.resolve({ generatedAt: new Date().toISOString() });
    });

    // Retorna un objeto JSON con la key y el resultado (desde cache o recién generado)
    return { key, result };
  }

  // GET /debug/cache/stats
  // Decorador que mapea peticiones GET a la ruta /debug/cache/stats
  @Get('stats')
  // Método síncrono que obtiene estadísticas del cache
  stats() {
    // Retorna un objeto con métricas: hits (aciertos) y misses (fallos) del cache
    return this.cache.getStats();
  }
}
