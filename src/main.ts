// src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
// Importamos ValidationPipe y BadRequestException para validación global de DTOs
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config';
// Importamos LoggerService para logging de errores asíncronos
import { LoggerService } from './infra/logging/logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Servir archivos estáticos desde la carpeta public/
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/', // Los archivos estarán en la raíz: /index.html, /styles.css, /script.js
  });

  // Obtener LoggerService antes de configurar handlers globales
  const logger = app.get(LoggerService);

  // Configuramos handlers para errores asíncronos no capturados
  // Estos errores pueden ocurrir después de que una respuesta HTTP ya fue enviada
  // Por ejemplo: promesas rechazadas que no fueron capturadas, errores en callbacks asíncronos, etc.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
    // Capturamos promesas rechazadas que no fueron manejadas con .catch()
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : undefined;
    const errorType = reason instanceof Error ? reason.constructor.name : typeof reason;
    const errorName = reason instanceof Error ? reason.name : 'Unknown';

    logger.error(`Unhandled Promise Rejection [${errorType}]`, errorStack, 'process', {
      reason: errorMessage,
      errorType,
      errorName,
      // Intentamos serializar el reason completo si es un objeto
      reasonDetails:
        reason && typeof reason === 'object'
          ? JSON.stringify(reason, Object.getOwnPropertyNames(reason))
          : String(reason),
    });
  });

  process.on('uncaughtException', (error: Error) => {
    // Capturamos excepciones síncronas que no fueron capturadas por try-catch
    logger.error('Uncaught Exception', error.stack, 'process', {
      message: error.message,
      name: error.name,
    });
    // En producción, podrías querer cerrar la aplicación aquí
    // process.exit(1);
  });

  // Configuramos CORS para permitir peticiones desde navegadores
  // Esto es necesario porque los navegadores bloquean peticiones cross-origin por defecto
  // Firefox especialmente hace preflight requests (OPTIONS) antes de las peticiones reales
  // En desarrollo, permitimos todos los orígenes. En producción, deberías especificar dominios específicos
  app.enableCors({
    origin: true, // Permite todos los orígenes (en producción, usa un array con dominios específicos)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Type'],
    credentials: true, // Permite enviar cookies y headers de autenticación
    maxAge: 86400, // Cache del preflight por 24 horas (reduce peticiones OPTIONS)
    preflightContinue: false, // NestJS maneja el preflight automáticamente
    optionsSuccessStatus: 204, // Retorna 204 No Content para OPTIONS exitosos
  });

  // Configuramos ValidationPipe globalmente para toda la aplicación
  // Esto asegura que todos los endpoints validen automáticamente los DTOs
  // transform: true - Convierte automáticamente los tipos (ej: string a number)
  // whitelist: true - Elimina propiedades que no están en el DTO (seguridad)
  // forbidNonWhitelisted: true - Rechaza peticiones con propiedades no permitidas
  // exceptionFactory: Personaliza el formato de los errores de validación para que sean más informativos
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Transforma automáticamente los tipos según el DTO
      whitelist: true, // Elimina propiedades que no están definidas en el DTO
      forbidNonWhitelisted: true, // Rechaza la petición si hay propiedades no permitidas
      transformOptions: {
        enableImplicitConversion: true, // Permite conversión implícita de tipos (string a number, etc.)
      },
      // Skip validation para requests OPTIONS (preflight de CORS)
      // Firefox y otros navegadores envían OPTIONS antes de la petición real
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
      exceptionFactory: (errors) => {
        // Personalizamos el formato de los errores de validación
        // Esto hace que los mensajes sean más claros y útiles para el cliente
        const messages = errors.map((error) => {
          // Para cada error, extraemos el campo y los mensajes de validación
          const constraints = error.constraints
            ? Object.values(error.constraints)
            : [`${error.property} tiene un valor inválido`];
          return {
            field: error.property,
            messages: constraints,
          };
        });

        // Retornamos un BadRequestException con el formato personalizado
        return new BadRequestException({
          statusCode: 400,
          message: 'Error de validación',
          errors: messages,
        });
      },
    }),
  );

  // Nota: GlobalExceptionFilter está registrado en LoggerModule usando APP_FILTER
  // No es necesario registrarlo aquí también para evitar duplicación

  // Obtener AppConfigService del contenedor de NestJS
  const configService = app.get(AppConfigService);

  await app.listen(configService.port);
}
// Iniciamos la aplicación - void indica que intencionalmente no esperamos esta promesa
void bootstrap();
