import { Module } from '@nestjs/common';
import { ResilienceService } from './resilience.service';
import { RESILIENCE_SERVICE } from './resilience.types';

@Module({
  // Registramos ResilienceService usando el token RESILIENCE_SERVICE
  // Esto permite inyectarlo usando @Inject(RESILIENCE_SERVICE) en lugar de por tipo
  // Mantiene consistencia con el patrón de CACHE_CLIENT
  providers: [
    {
      provide: RESILIENCE_SERVICE,
      useClass: ResilienceService,
    },
  ],
  // Exportamos el token para que otros módulos puedan usarlo
  exports: [RESILIENCE_SERVICE],
})
export class ResilienceModule {}
