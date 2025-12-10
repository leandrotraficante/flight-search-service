import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './infra/cache/cache.module';
import { CacheDebugController } from './controllers/cache-debug.controller';
import { CacheService } from './infra/cache/cache.service';
import { LoggerModule } from './infra/logging/logger.module';
import { AppConfigModule } from './config/config.module';
import { ResilienceModule } from './infra/resilience/resilience.module';
import { AmadeusModule } from './modules/providers/amadeus/amadeus.module';
// Importamos SearchModule que contiene el endpoint principal de búsqueda de vuelos
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AppConfigModule,
    CacheModule,
    LoggerModule,
    ResilienceModule,
    AmadeusModule,
    // SearchModule: módulo principal que expone el endpoint /search/flights
    // Este módulo internamente usa AmadeusModule para buscar vuelos
    SearchModule,
  ],
  controllers: [CacheDebugController],
  providers: [CacheService],
})
export class AppModule {}
