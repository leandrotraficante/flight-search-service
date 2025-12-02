import {
  ExceptionFilter, // Interfaz base que define cómo funciona un filtro de excepciones
  Catch, // Decorador para indicar qué tipos de errores captura este filtro
  ArgumentsHost, // Permite acceder al contexto HTTP (request/response)
  HttpException, // Clase base de errores HTTP de Nest
  HttpStatus, // Enum con códigos HTTP (500, 404, etc)
} from '@nestjs/common';
import { Request, Response } from 'express'; // Tipos de Express para request y response
import { LoggerService } from '../../infra/logging/logger.service';

// Filtro global:
// Captura **toda excepción no manejada** (similar a Try/Catch global).
// Evita que el servidor explote con errores sin formatear.
// Garantiza que SIEMPRE se logueen los errores críticos.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  // Inyectamos nuestro logger custom para registrar los errores
  constructor(private readonly logger: LoggerService) {}

  // Método principal del filtro --> Se ejecuta automáticamente cuando ocurre una excepción en cualquier endpoint
  // `exception` → lo que falló
  // `host` → acceso al contexto (HTTP, RPC, WebSockets, etc)
  catch(exception: unknown, host: ArgumentsHost) {
    // Convertimos a contexto HTTP
    const ctx = host.switchToHttp();

    // Obtenemos los objetos Response y Request para devolver una respuesta y extraer info
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determinar el status HTTP
    // Si es HttpException → usamos su código real (404, 400, 403, etc)
    // Si es un error no esperado → 500 (Internal Server Error)
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Obtener un mensaje legible
    // HttpException → trae su mensaje
    // Otros errores → mensaje genérico
    const errorMessage =
      exception instanceof HttpException ? exception.message : 'Unexpected error';

    // HttpException.getResponse() devuelve:
    // message: string | string[]
    // error: string
    // statusCode: number
    // Para errores no HttpException será null.
    const errorResponse = exception instanceof HttpException ? exception.getResponse() : null;

    // Obtener stacktrace si existe.
    // Ojo: a veces llegan errores que no son instancia de Error.
    const trace = exception instanceof Error ? exception.stack : undefined;

    // Registrar el error en Winston de manera estructurada.
    // Este es el LOG MÁS IMPORTANTE DEL SISTEMA.
    // Incluye:
    // método (GET, POST, etc)
    // url
    // ip
    // status code
    // mensaje de error
    // response (si viene de HttpException)
    // stacktrace
    this.logger.error(
      `Unhandled Exception`, // Mensaje principal
      trace, // Stack (puede ser undefined)
      `${request.method} ${request.url}`, // Contexto dinámico (ej: "GET /users")
      {
        method: request.method,
        url: request.originalUrl || request.url,
        statusCode: status,
        errorMessage,
        errorResponse,
        ip: request.ip,
      },
    );

    // Respuesta final al cliente.
    // Siempre enviamos un formato uniforme de error:
    // {
    //   statusCode,
    //   timestamp,
    //   path,
    //   error
    // }
    // Esto evita exponer detalles internos del servidor.
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: errorMessage,
    });
  }
}
