import Redis from 'ioredis';
import { CACHE_CLIENT } from './cache.types';
import { cacheConfigFactory } from './cache.config';
import { LoggerService } from '../logging/logger.service';
import { AppConfigService } from '../../config/config';

export const cacheProvider = {
  provide: CACHE_CLIENT,
  inject: [LoggerService, AppConfigService],
  useFactory: (logger: LoggerService, appConfigService: AppConfigService) => {
    // construye el cliente de Redis dinámicamente
    const config = cacheConfigFactory(appConfigService); // Usa configuación centralizada
    const client = new Redis({
      // crea el cliente de Redis
      host: config.host,
      port: config.port,
      password: config.password,
      lazyConnect: true, // No se conecta hasta que se use; evita que la app caiga si Redis no esta listo durante el Bootstrap
      retryStrategy: (times) => {
        // Evita que Redis quiera reconectar infinitas veces, se quede colgado, haga demasiadas reconexiones sin delay
        const delay = Math.min(times * 50, 2000);
        logger.debug(`[Cache] Retry #${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: () => {
        // si hay un error grave, se fuerza la reconexión
        logger.warn('[Cache] Connection error, attempting reconnect...');
        return true;
      },
      keyPrefix: `flightsearch:${appConfigService.nodeEnv}:`, // cada key almacenada será flightsearch:dev:KEY
      // evita: colisiones entre ambientes, borrar datos de otro entorno, mezclar datos en produccion
    });
    // log minimo - saber si Redis esta conectado o falló
    client.on('connect', () => {
      logger.info('[Cache] Redis connected');
    });
    client.on('error', (error) => {
      logger.error('[Cache] Redis error', undefined, undefined, { error });
    });
    return client;
  },
};
