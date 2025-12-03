// Importamos la interfaz LoggerService de Nest para cumplir su contrato (debug, log, warn, error, etc)
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { buildLoggerConfig } from './logger.config'; // Importamos nuestra configuración personalizada de Winston (niveles, formatos, transports)
import { AppConfigService } from '../../config/config';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger; // Instancia interna de Winston que hace el trabajo real
  private context?: string; // Contexto opcional que se adjunta automáticamente a los logs

  constructor(private readonly appConfigService: AppConfigService) {
    // Creamos una instancia de Winston usando nuestra configuración según el entorno
    // Esto genera un logger configurable con formatos JSON, colores en dev, transports, etc.
    this.logger = winston.createLogger(buildLoggerConfig(appConfigService));
  }

  // Permite adjuntar un contexto fijo a todos los logs.
  // Ejemplo: en un servicio UsersService, setContext("UsersService")
  // Esto ayuda a rastrear de dónde viene cada log.
  setContext(context: string) {
    this.context = context;
  }

  // Crea un logger hijo con metadata fija.
  // Esto es útil cuando diferentes módulos necesitan logs con contexto diferente, sin tener que pasar manualmente el nombre cada vez.
  // Nota: Crea una nueva instancia de LoggerService, pero reutiliza el logger de Winston padre para eficiencia.
  childLogger(context: string): LoggerService {
    const child = new LoggerService(this.appConfigService); // Creamos una nueva instancia del servicio

    child.context = context; // Guardamos el contexto para que esta instancia lo use siempre

    // Winston tiene su propio sistema de child loggers, permitiendo heredar configuraciones
    // y agregar metadata fija que se incluirá en cada log.
    // Reutilizamos el logger padre en lugar de crear uno nuevo desde cero.
    child.logger = this.logger.child({
      context, // Metadata fija que aparece en todos los logs del hijo
    });

    return child; // Retornamos el logger hijo
  }

  // Normalizamos los mensajes para que Winston siempre reciba una string en `message`, y el resto de la info quede como metadata.
  // Winston acepta metadata, pero necesita un mensaje principal que sea string.
  private formatMessage(message: unknown, context?: string) {
    return {
      // Si es string, lo usamos tal cual. Si no, lo serializamos a JSON. Esto evita errores al loggear objetos, errores, arrays, etc.
      message: typeof message === 'string' ? message : JSON.stringify(message),
      // Incluimos el contexto proporcionado (tiene prioridad) o el contexto fijo del logger.
      // Nota: Si se proporciona un contexto explícito, sobrescribe el contexto fijo (setContext).
      context: context || this.context,
    };
  }

  // Método de debug — nivel más bajo. Se usa típicamente para información detallada que solo se ve en desarrollo.
  debug(message: unknown, context?: string, meta?: Record<string, any>) {
    const payload = this.formatMessage(message, context); // Normalizamos el mensaje
    this.logger.debug(payload.message, { ...payload, ...meta }); // Pasamos metadata estructurada
  }

  // Método log estándar de Nest. Por convención en NestJS equivale a un "info".
  // Nota: log() e info() son idénticos por diseño (convención NestJS).
  log(message: unknown, context?: string, meta?: Record<string, any>) {
    const payload = this.formatMessage(message, context);
    this.logger.info(payload.message, { ...payload, ...meta });
  }

  // Alias explícito de log() pero respetando la API de Winston.
  // Nota: Este método es idéntico a log() por diseño (convención NestJS).
  info(message: unknown, context?: string, meta?: Record<string, any>) {
    const payload = this.formatMessage(message, context);
    this.logger.info(payload.message, { ...payload, ...meta });
  }

  // Método para warnings — útil para advertencias, pero no errores.
  warn(message: unknown, context?: string, meta?: Record<string, any>) {
    const payload = this.formatMessage(message, context);
    this.logger.warn(payload.message, { ...payload, ...meta });
  }

  // Método para errores. Aquí permitimos adjuntar `trace` (stack trace) además de metadata.
  // Nota: La firma extiende la de NestJS LoggerService agregando el parámetro `meta` opcional.
  // Orden de parámetros: message, trace, context, meta (compatible con NestJS pero con extensión).
  error(message: unknown, trace?: string, context?: string, meta?: Record<string, any>) {
    const payload = this.formatMessage(message, context);

    // Los errores deben incluir el trace si está disponible.
    this.logger.error(payload.message, {
      ...payload,
      trace, // El stack trace del error
      ...meta, // Cualquier metadata adicional
    });
  }
}
