import {
  Injectable,
  NestInterceptor, // Interface que define cómo funciona un interceptor en NestJS
  ExecutionContext, // Contiene información del handler/controller que está procesando la request
  CallHandler, // Permite continuar el flujo y ejecutar el controller
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs'; // RxJS permite interceptar el flujo de respuesta
import { tap, catchError } from 'rxjs/operators'; // Operadores que ejecutan lógica en éxito o error
import { Request } from 'express'; // Tipado concreto del request (Nest usa Express por defecto)
import { LoggerService } from './logger.service'; // Nuestro logger custom (basado en Winston)

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // Inyectamos nuestro logger para usar en cada request
  constructor(private readonly logger: LoggerService) {}

  // El método intercept se ejecuta:
  // - Antes de llamar al controller → Log "incoming request"
  // - Después de que el controller responde → Log "request completed"
  // - Si el controller lanza error → Log "request failed"
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Obtenemos el request HTTP usando el contexto
    // Nest abstrae varias plataformas, pero aquí asumimos Express
    const request = context.switchToHttp().getRequest<Request>();

    // Datos del request → estos se registran siempre porque sirven para depurar
    const method: string = request.method;
    const originalUrl: string = request.originalUrl || request.url;

    // "User-Agent" útil para debuggin de clientes (navegadores, Postman, apps, etc.)
    const userAgent: string = request.get('user-agent') || '';

    // La IP puede venir en distintos lugares según reverse proxies
    const ip: string = request.ip || request.socket.remoteAddress || 'unknown';

    // Identificamos controller y método que están ejecutando
    const controller = context.getClass().name;
    const handler = context.getHandler().name;

    // Guardamos el timestamp inicial para medir la duración total de la request
    const startTime = Date.now();

    // Log inicial — se ejecuta antes del controller
    this.logger.debug(
      `Incoming Request`, // mensaje visible
      `${controller}.${handler}`, // contexto (nombre del controller/método)
      {
        method,
        originalUrl,
        userAgent,
        ip,
      },
    );

    /**
     * next.handle() continúa la ejecución del controller.
     * El "pipe()" nos deja ejecutar lógica cuando la request:
     * - termina bien (tap)
     * - termina mal (catchError)
     */
    return next.handle().pipe(
      // Cuando la respuesta finaliza sin errores
      tap(() => {
        const duration = Date.now() - startTime;

        this.logger.info(
          `Request completed`, // mensaje claro y de nivel INFO
          `${controller}.${handler}`, // contexto fijo del handler
          {
            method,
            originalUrl,
            userAgent,
            ip,
            durationMs: duration, // métrica clave → performance
          },
        );
      }),

      // Cuando ocurre una excepción dentro del controller o pipe
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;

        // Procesamos el error de forma segura usando el tipo unknown
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        this.logger.error(
          `Request failed`, // mensaje base
          errorStack, // trace del error (si existe)
          `${controller}.${handler}`, // contexto del handler
          {
            method,
            originalUrl,
            userAgent,
            ip,
            durationMs: duration, // cuánto tardó antes de fallar
            errorName,
            errorMessage,
          },
        );

        // Re-lanzamos el error para que Nest lo maneje con sus filtros globales
        return throwError(() => error);
      }),
    );
  }
}
