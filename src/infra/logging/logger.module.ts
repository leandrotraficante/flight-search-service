import { Module, Global } from '@nestjs/common'; // GLobal hace que el modulo quede disponible en toda la app sin tener que importarlo cada vez.
import { LoggerService } from './logger.service'; // Nuestro servicio custom basado en Winston
import { LoggingInterceptor } from './logger.interceptor'; // Interceptor que captura todos los requests para loguear entrada/salida
import { GlobalExceptionFilter } from '../../common/exceptions/global-exception.fliter'; // Filtro global de errores que captura excepciones no manejadas
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core'; // Tokens especiales para registrar interceptores y filtros como GLOBALS

@Global()
@Module({
  providers: [
    LoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  exports: [LoggerService],
})
export class LoggerModule {}
