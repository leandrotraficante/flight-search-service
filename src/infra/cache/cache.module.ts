import { Module } from '@nestjs/common';
import { CACHE_CLIENT } from './cache.types';
import { cacheProvider } from './cache.provider';

@Module({
  providers: [cacheProvider],
  exports: [CACHE_CLIENT], // Permite que otros módulos puedan usar el cliente de Redis
})
export class CacheModule {}
