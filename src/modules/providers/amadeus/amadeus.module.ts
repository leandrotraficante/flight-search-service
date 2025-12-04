import { Module } from '@nestjs/common';
// Importamos CacheModule para tener acceso a CACHE_CLIENT (token de Redis)
// AmadeusTokenService necesita CacheService para cachear tokens
import { CacheModule } from '../../../infra/cache/cache.module';
// Importamos CacheService directamente ya que se usa en AmadeusTokenService
import { CacheService } from '../../../infra/cache/cache.service';
// Importamos ResilienceModule para tener acceso a ResilienceService
// AmadeusTokenService y AmadeusClient necesitan ResilienceService para retry, circuit breaker, timeout
import { ResilienceModule } from '../../../infra/resilience/resilience.module';
// Importamos LoggerModule (aunque es global, lo importamos explícitamente para claridad)
// Todos los servicios de Amadeus necesitan LoggerService para logging
import { LoggerModule } from '../../../infra/logging/logger.module';
// Importamos AppConfigModule (aunque es global, lo importamos explícitamente para claridad)
// AmadeusTokenService, AmadeusClient y la configuración necesitan AppConfigService
import { AppConfigModule } from '../../../config/config.module';
// Importamos los servicios de Amadeus que se registran como providers
import { AmadeusTokenService } from './amadeus-token.service';
import { AmadeusClient } from './amadeus.client';
import { AmadeusService } from './amadeus.service';

@Module({
  // Módulos que este módulo necesita para funcionar
  imports: [CacheModule, ResilienceModule, LoggerModule, AppConfigModule],
  // Providers: servicios que este módulo crea y registra en el contenedor de dependencias
  providers: [
    CacheService, // CacheService se necesita explícitamente porque AmadeusTokenService lo inyecta directamente
    // Aunque CacheModule exporta CACHE_CLIENT, CacheService también se usa como servicio
    AmadeusTokenService, // AmadeusTokenService: gestiona tokens OAuth2 de Amadeus con cache y resiliencia
    AmadeusClient, // AmadeusClient: cliente HTTP configurado con interceptores para autenticación automática
    AmadeusService, // AmadeusService: servicio principal que orquesta búsqueda de vuelos
  ],
  exports: [
    // Este es el servicio principal que otros módulos necesitarán para buscar vuelos
    AmadeusService,
  ],
})
export class AmadeusModule {}
