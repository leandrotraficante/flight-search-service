import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { CACHE_CLIENT } from './cache.types';
import { cacheConfigFactory } from './cache.config';

@Module({
  providers: [
    {
      provide: CACHE_CLIENT,
      useFactory: () => {
        // construye el cliente de Redis dinámicamente
        const config = cacheConfigFactory(); // Usa configuación centralizada
        const client = new Redis({
          // crea el cliente de Redis
          host: config.host,
          port: config.port,
          password: config.password,
          lazyConnect: true, // No se conecta hasta que se use; evita que la app caiga si Redis no esta listo durante el Bootstrap
          retryStrategy: (times) => {
            // Evita que Redis quiera reconectar infinitas veces, se quede colgado, haga demasiadas reconexiones sin delay
            const delay = Math.min(times * 50, 2000);
            console.log(`[Cache] Retry #${times}, waiting ${delay}ms`);
            return delay;
          },
          reconnectOnError: () => {
            // si hay un error grave, se fuerza la reconexión
            console.warn('[Cache] Connection error, attempting reconnect...');
            return true;
          },
          keyPrefix: `flightseach:${process.env.NODE_ENV ?? 'dev'}:`, // cada key almacenada será flightsearch:dev:KEY
          // evita: colisiones entre ambientes, borrar datos de otro entorno, mezclar datos en produccion
        });
        // log minimo - saber si Redis esta conectado o falló
        client.on('connect', () => {
          console.log('[Cache] Redis connected');
        });
        client.on('error', (error) => {
          console.log('[Cache] Redis error', error);
        });
        return client;
      },
    },
  ],
  exports: [CACHE_CLIENT], // Permite que otros módulos puedan usar el cliente de Redis
})
export class CacheModule {}
