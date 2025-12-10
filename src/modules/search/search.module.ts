import { Module } from '@nestjs/common';
// Importamos AmadeusModule para tener acceso a AmadeusService
import { AmadeusModule } from '../providers/amadeus/amadeus.module';
import { AmadeusService } from '../providers/amadeus/amadeus.service';
// Importamos CacheModule para tener acceso a CacheService
// SearchService necesita CacheService para cachear resultados de búsqueda
import { CacheModule } from '../../infra/cache/cache.module';
import { CacheService } from '../../infra/cache/cache.service';
// Importamos LoggerModule (aunque es global, lo importamos explícitamente para claridad)
// SearchService necesita LoggerService para logging
import { LoggerModule } from '../../infra/logging/logger.module';
// Importamos SearchService que contiene la lógica de negocio
import { SearchService } from './search.service';
// Importamos el controller que expone el endpoint HTTP
import { SearchController } from './search.controller';

// Token de inyección para IFlightProvider
// Este token permite que NestJS inyecte AmadeusService como IFlightProvider
// Esto es necesario porque TypeScript elimina las interfaces en tiempo de compilación
// y NestJS necesita un token para identificar qué implementación inyectar
// Usamos un string como token, que es la práctica más común en NestJS
export const FLIGHT_PROVIDER_TOKEN = 'IFlightProvider';

@Module({
  // Módulos que este módulo necesita para funcionar
  imports: [AmadeusModule, CacheModule, LoggerModule],
  // Controllers: controladores HTTP que este módulo expone
  controllers: [
    // SearchController: expone el endpoint GET /search/flights para buscar vuelos
    SearchController,
  ],
  // Providers: servicios que este módulo crea y registra en el contenedor de dependencias
  providers: [
    // CacheService se necesita explícitamente porque SearchService lo inyecta directamente
    CacheService,
    // Registramos AmadeusService como implementación de IFlightProvider usando el token
    // Usamos useExisting para reutilizar la instancia de AmadeusService que ya creó AmadeusModule
    // Esto evita crear una nueva instancia y resuelve correctamente las dependencias (AmadeusClient, etc.)
    // Esto permite que SearchService reciba AmadeusService a través de la interfaz IFlightProvider
    {
      provide: FLIGHT_PROVIDER_TOKEN,
      useExisting: AmadeusService,
    },
    // SearchService: servicio principal que orquesta la búsqueda de vuelos
    // Usa FLIGHT_PROVIDER_TOKEN para recibir AmadeusService como IFlightProvider
    SearchService,
  ],
  // Exportamos SearchService para que otros módulos puedan usarlo
  exports: [SearchService],
})
export class SearchModule {}
