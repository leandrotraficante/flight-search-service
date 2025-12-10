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

  // GET /debug/cache/del?key=foo
  // Decorador que mapea peticiones GET a la ruta /debug/cache/del
  @Get('del')
  // Método asíncrono que recibe 'key' desde los query params de la URL
  async del(@Query('key') key: string) {
    // Elimina la clave del cache
    await this.cache.delete(key);
    // Retorna un objeto JSON confirmando que se eliminó correctamente
    return { ok: true, key, message: 'Key eliminada del cache' };
  }

  // GET /debug/cache/del-search?origin=JFK&destination=LAX&departureDate=2024-12-25&adults=1
  // Endpoint helper para eliminar claves de búsqueda de vuelos construyendo la clave automáticamente
  @Get('del-search')
  async delSearch(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('departureDate') departureDate: string,
    @Query('returnDate') returnDate?: string,
    @Query('adults') adults?: string,
    @Query('children') children?: string,
    @Query('infants') infants?: string,
    @Query('travelClass') travelClass?: string,
    @Query('maxResults') maxResults?: string,
    @Query('currency') currency?: string,
    @Query('includedAirlines') includedAirlines?: string,
    @Query('excludedAirlines') excludedAirlines?: string,
  ) {
    // Construimos la clave igual que SearchService.buildCacheKey()
    const keyParts = [
      'search',
      'flights',
      origin?.toUpperCase() || '',
      destination?.toUpperCase() || '',
      departureDate || '',
      returnDate || 'oneway',
      adults || '1',
      children || '0',
      infants || '0',
      travelClass || 'all',
      maxResults || 'default',
      currency || 'default',
      includedAirlines ? includedAirlines.split(',').sort().join(',') : 'all',
      excludedAirlines ? excludedAirlines.split(',').sort().join(',') : 'none',
    ];
    const key = this.cache.composeKey(...keyParts);

    // Eliminamos la clave del cache
    await this.cache.delete(key);

    // Retornamos confirmación con la clave construida
    return { ok: true, key, message: 'Key de búsqueda eliminada del cache' };
  }

  // GET /debug/cache/del-pattern?pattern=search:flights:JFK:*
  // Endpoint para eliminar múltiples keys que coincidan con un patrón
  // Útil para eliminar todas las búsquedas de un origen, todas las búsquedas, etc.
  @Get('del-pattern')
  async delPattern(@Query('pattern') pattern: string) {
    // Eliminamos todas las keys que coincidan con el patrón
    const deletedCount = await this.cache.deleteByPattern(pattern);

    // Retornamos confirmación con el número de keys eliminadas
    return {
      ok: true,
      pattern,
      keysDeleted: deletedCount,
      message: `${deletedCount} keys eliminadas que coinciden con el patrón`,
    };
  }
}
