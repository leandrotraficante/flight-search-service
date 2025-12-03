import { Module, Global } from '@nestjs/common';
import { AppConfigService } from './config';

/**
 * Módulo de configuración global
 * Exporta AppConfigService para uso en toda la aplicación
 *
 * NOTA: ConfigModule ya está configurado como global en app.module.ts,
 * por lo que no es necesario importarlo aquí nuevamente.
 */
@Global()
@Module({
  // No importamos ConfigModule aquí porque ya está global en app.module.ts
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
