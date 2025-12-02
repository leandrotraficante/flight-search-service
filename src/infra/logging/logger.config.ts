import * as winston from 'winston'; // Importamos winston, permite registrar eventos de la aplicación

// format: contiene funciones para formatear los mensajes de log (timestamp, colorize, json, etc.)
// transports: contiene los destinos donde se escribirán los logs (Console, File, etc.)
const { format, transports } = winston;

//  En producción usamos 'info' para evitar logs excesivos y mejorar rendimiento
//  En desarrollo usamos 'debug' para tener información detallada durante el desarrollo

function determineLogLevel(env: string): string {
  return env === 'production' ? 'info' : 'debug';
}

//  Esta función es necesaria porque TypeScript infiere 'unknown' para los valores del objeto info
//  en format.printf, y necesitamos asegurarnos de que todos los valores sean strings antes
//  de usarlos en template literals para evitar errores de tipo.
function safeString(value: unknown): string {
  // Si ya es string, lo retornamos directamente sin conversión
  if (typeof value === 'string') {
    return value;
  }
  // Si es null o undefined, retornamos string vacío para evitar errores
  // Esto previene que aparezca 'null' o 'undefined' en los logs
  if (value === null || value === undefined) {
    return '';
  }
  // Si es un objeto (incluyendo arrays), lo convertimos a JSON string
  // Esto permite loguear objetos complejos de forma legible
  if (typeof value === 'object') {
    return JSON.stringify(value); // JSON.stringify convierte objetos a su representación JSON
  }
  // En este punto, value es un primitivo (number, boolean, bigint, symbol, etc.)
  // Hacemos type assertion para que TypeScript entienda que no es un objeto
  const primitiveValue = value as string | number | boolean | bigint | symbol;
  // String() convierte cualquier primitivo a su representación en string
  // Ejemplo: String(123) -> "123", String(true) -> "true"
  return String(primitiveValue);
}

//  Esta función configura cómo se formatean los mensajes de log dependiendo del entorno.
function buildLoggerFormat(env: string) {
  // format.combine() permite combinar múltiples formatos en uno solo
  // Los formatos se aplican en el orden en que se pasan
  const baseFormat = format.combine(
    // Por defecto usa formato ISO 8601 (ej: "2024-01-15T10:30:00.000Z")
    format.timestamp(),
    // { stack: true } asegura que el stack trace completo se incluya en el log
    format.errors({ stack: true }),
    // format.splat() permite usar placeholders estilo printf en los mensajes
    // Ejemplo: logger.info('User %s logged in', username) -> "User john logged in"
    format.splat(),
  );

  // En producción, usamos formato JSON para facilitar el parsing por herramientas de log
  // Los logs en JSON son más fáciles de procesar por sistemas como ELK, CloudWatch, etc.
  if (env === 'production') {
    return format.combine(
      baseFormat, // Aplicamos los formatos base primero
      // format.json() convierte cada log a formato JSON
      // Esto es útil para sistemas de agregación de logs que esperan JSON estructurado
      format.json(), // logs en JSON para producción
    );
  }

  // En desarrollo, usamos formato legible con colores para mejor experiencia de desarrollo
  return format.combine(
    baseFormat, // Aplicamos los formatos base primero
    // format.colorize() agrega colores ANSI a los niveles de log en la consola
    // Diferentes niveles tienen diferentes colores (error=rojo, warn=amarillo, info=verde, etc.)
    format.colorize(), // mejor lectura en dev
    // format.printf() permite definir un formato personalizado usando una función
    // La función recibe un objeto 'info' con todas las propiedades del log
    format.printf((info) => {
      // Convertimos cada propiedad a string de forma segura usando nuestra función helper
      // info.level: el nivel del log (error, warn, info, debug, etc.)
      const level: string = safeString(info.level);
      // info.message: el mensaje principal del log
      const message: string = safeString(info.message);
      // info.timestamp: la fecha/hora cuando se generó el log (agregado por format.timestamp())
      const timestamp: string = safeString(info.timestamp);
      // info.stack: el stack trace del error (solo presente si hay un error)
      // Usamos operador ternario: si existe stack, lo convertimos, sino undefined
      const stack: string | undefined = info.stack ? safeString(info.stack) : undefined;

      // Template literal: si hay stack trace, lo incluimos en una nueva línea
      // Si no hay stack, solo mostramos el mensaje básico
      // El formato es: [timestamp] level: message\nstack (si existe)
      return stack
        ? `[${timestamp}] ${level}: ${message}\n${stack}` // \n crea una nueva línea para el stack
        : `[${timestamp}] ${level}: ${message}`; // Formato simple sin stack trace
    }),
  );
}

//  Esta es la función principal que configura el logger de winston para toda la aplicación.
//  Exporta la configuración para que pueda ser usada en otros módulos (ej: logger.module.ts)
export function buildLoggerConfig() {
  // Si no está definida, asumimos 'development' como valor por defecto
  const env = process.env.NODE_ENV || 'development';

  // Usamos el tipo winston.transport[] para evitar conflictos de tipo
  // Un transport es un destino donde se escriben los logs (consola, archivo, base de datos, etc.)
  // Inicializamos el array con el transport de consola que siempre usamos
  const loggerTransports: winston.transport[] = [
    // transports.Console escribe los logs en la consola/terminal
    // Es el transport más común y siempre está disponible
    new transports.Console({
      // level: determina qué nivel de logs y superiores se mostrarán
      // Si es 'info', mostrará info, warn y error, pero no debug
      level: determineLogLevel(env),
      // handleExceptions: captura excepciones no manejadas y las loguea automáticamente
      // Útil para no perder información de errores críticos
      handleExceptions: true,
    }),
  ];

  // Agregar file transports sólo en producción
  // En desarrollo solo usamos consola para no llenar el disco con logs
  if (env === 'production') {
    // Agregamos un transport para archivo de errores
    loggerTransports.push(
      // transports.File escribe los logs en un archivo del sistema
      new transports.File({
        // filename: ruta relativa donde se guardará el archivo de log
        // Los archivos se crean automáticamente si no existen
        filename: 'logs/error.log',
        // level: 'error' significa que solo se escribirán logs de nivel error
        // Esto separa los errores críticos en un archivo dedicado para fácil acceso
        level: 'error',
      }),
    );

    // Agregamos un transport para archivo de todos los logs
    loggerTransports.push(
      new transports.File({
        // Este archivo contiene todos los logs (no solo errores)
        // Útil para tener un historial completo de la aplicación
        filename: 'logs/combined.log',
        // Sin especificar level, usa el nivel por defecto del logger (definido abajo)
      }),
    );
  }

  // Retornamos el objeto de configuración que winston espera
  return {
    // level: nivel global del logger (aplica a todos los transports que no tengan level propio)
    // Los logs con nivel inferior a este no se procesarán
    level: determineLogLevel(env),
    // format: define cómo se formatean los mensajes antes de escribirlos
    // Usamos la función buildLoggerFormat que crea el formato según el entorno
    format: buildLoggerFormat(env),
    // transports: array de destinos donde se escribirán los logs
    // Puede incluir Console, File, HTTP, Database, etc.
    transports: loggerTransports,
  };
}
