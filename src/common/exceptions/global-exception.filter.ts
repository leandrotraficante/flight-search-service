import {
  ExceptionFilter, // Interfaz base que define cómo funciona un filtro de excepciones
  Catch, // Decorador para indicar qué tipos de errores captura este filtro
  ArgumentsHost, // Permite acceder al contexto HTTP (request/response)
  HttpException, // Clase base de errores HTTP de Nest
  HttpStatus, // Enum con códigos HTTP (500, 404, etc)
} from '@nestjs/common';
import { Request, Response } from 'express'; // Tipos de Express para request y response
import { LoggerService } from '../../infra/logging/logger.service';
// Importamos AmadeusApiError para manejar errores específicos de Amadeus
import { AmadeusApiError } from '../../modules/providers/amadeus/amadeus.types';

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

    // Si es un request OPTIONS (preflight de CORS), no logueamos errores
    // Los requests OPTIONS son automáticos del navegador y no necesitan manejo de errores
    if (request.method === 'OPTIONS') {
      return;
    }

    // Verificamos si es un NotFoundException y si la respuesta ya fue enviada
    // NotFoundException después de respuesta enviada generalmente es inofensivo (favicon, etc.)
    const isNotFoundException = exception instanceof HttpException && exception.getStatus() === 404;
    const isResponseSent = response.headersSent;
    const requestUrl = request.originalUrl || request.url;

    // Rutas comunes que los navegadores solicitan automáticamente y no tienen handlers
    // Estas peticiones causan NotFoundException pero son completamente inofensivas
    const ignoredPaths = ['/favicon.ico', '/robots.txt', '/.well-known'];
    const isIgnoredPath = ignoredPaths.some((path) => requestUrl.startsWith(path));

    // Si es un NotFoundException para una ruta ignorada, lo ignoramos completamente
    // No logueamos nada porque son peticiones automáticas del navegador
    if (isNotFoundException && isIgnoredPath) {
      // Retornamos sin loguear nada - estas peticiones son completamente inofensivas
      return;
    }

    // Si la respuesta ya fue enviada Y es un NotFoundException, lo ignoramos completamente
    // Esto es común cuando Firefox u otros navegadores hacen peticiones automáticas (favicon, etc.)
    // después de que la respuesta principal ya fue enviada
    if (isResponseSent && isNotFoundException) {
      // No logueamos nada, simplemente ignoramos el error
      return;
    }

    // Si la respuesta ya fue enviada pero NO es NotFoundException, logueamos como warning
    if (isResponseSent) {
      this.logger.warn(
        `Exception after response sent [${exception instanceof Error ? exception.constructor.name : typeof exception}]`,
        undefined,
        {
          method: request.method,
          url: request.originalUrl || request.url,
          errorType: exception instanceof Error ? exception.constructor.name : typeof exception,
          errorMessage: exception instanceof Error ? exception.message : String(exception),
          stack: exception instanceof Error ? exception.stack : undefined,
        },
      );
      // No intentamos enviar otra respuesta
      return;
    }

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

    // Información adicional sobre el tipo de error
    const errorType = exception instanceof Error ? exception.constructor.name : typeof exception;
    const errorName = exception instanceof Error ? exception.name : 'Unknown';

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
    // tipo de error y si la respuesta ya fue enviada
    this.logger.error(
      `Unhandled Exception [${errorType}]`, // Mensaje principal con tipo de error
      trace, // Stack (puede ser undefined)
      `${request.method} ${request.url}`, // Contexto dinámico (ej: "GET /users")
      {
        method: request.method,
        url: request.originalUrl || request.url,
        statusCode: status,
        errorMessage,
        errorType,
        errorName,
        isResponseSent, // Indica si la respuesta HTTP ya fue enviada
        errorResponse,
        ip: request.ip,
        userAgent: request.get('user-agent'), // User agent del navegador
        headers: {
          origin: request.get('origin'),
          referer: request.get('referer'),
        },
        // Si el error es un objeto, intentamos serializarlo
        errorDetails:
          exception && typeof exception === 'object'
            ? JSON.stringify(exception, Object.getOwnPropertyNames(exception))
            : String(exception),
      },
    );

    // Respuesta final al cliente.
    // Verificamos si la respuesta ya fue enviada para evitar errores de "Cannot set headers after they are sent"
    // Esto puede pasar si hay múltiples errores o si la respuesta ya se envió en otro lugar
    if (response.headersSent) {
      // Si la respuesta ya fue enviada, solo logueamos el error pero no intentamos enviar otra respuesta
      this.logger.warn('Response already sent, skipping error response', undefined, {
        url: request.url,
        method: request.method,
      });
      return;
    }

    // Si es un AmadeusApiError, usamos su formato estructurado que ya incluye los errores de Amadeus
    // Si es otro HttpException, usamos su respuesta si tiene estructura, sino formato básico
    // Esto evita exponer detalles internos del servidor pero mantiene información útil para el cliente
    try {
      if (exception instanceof AmadeusApiError) {
        // AmadeusApiError ya tiene un formato estructurado con errores detallados
        // Usamos directamente su respuesta que ya está formateada
        const amadeusResponse = exception.getResponse() as {
          message: string;
          errors: any[];
          statusCode: number;
        };
        response.status(status).json({
          ...amadeusResponse,
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      } else if (
        errorResponse &&
        typeof errorResponse === 'object' &&
        !Array.isArray(errorResponse)
      ) {
        // Si es otro HttpException con respuesta estructurada, la usamos
        // Verificamos que no sea un array para evitar problemas con el spread operator
        response.status(status).json({
          ...(errorResponse as Record<string, any>),
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      } else {
        // Formato básico para errores no estructurados
        response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          error: errorMessage,
        });
      }
    } catch (responseError) {
      // Si hay un error al enviar la respuesta (ej: ya fue enviada), lo logueamos pero no lanzamos otra excepción
      this.logger.error(
        'Error al enviar respuesta de error',
        responseError instanceof Error ? responseError.stack : undefined,
        undefined,
        {
          originalError: errorMessage,
          url: request.url,
        },
      );
    }
  }
}
