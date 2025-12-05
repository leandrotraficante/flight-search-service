import { Module, Global } from '@nestjs/common';
import { AppConfigService } from './config';

// Módulo de configuración global
// Exporta AppConfigService para uso en toda la aplicación
// ConfigModule ya está configurado como global en app.module.ts, por lo que no es necesario importarlo aquí nuevamente.

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
