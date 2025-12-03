import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './infra/cache/cache.module';
import { CacheDebugController } from './controllers/cache-debug.controller';
import { CacheService } from './infra/cache/cache.service';
import { LoggerModule } from './infra/logging/logger.module';
import { AppConfigModule } from './config/config.module';
import { ResilienceModule } from './infra/resilience/resilience.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AppConfigModule,
    CacheModule,
    LoggerModule,
    ResilienceModule,
  ],
  controllers: [CacheDebugController],
  providers: [CacheService],
})
export class AppModule {}
