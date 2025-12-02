# Flights Search Service - Guía Completa del Proyecto

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## 📑 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Proyecto](#2-arquitectura-del-proyecto)
3. [Decisiones Arquitectónicas](#3-decisiones-arquitectónicas)
4. [Estructura de Carpetas](#4-estructura-de-carpetas)
5. [Archivos del Proyecto](#5-archivos-del-proyecto)
6. [Dependencias](#6-dependencias)
7. [Configuración](#7-configuración)
8. [Guía de Uso](#8-guía-de-uso)

---

## 1. Visión General

### 1.1 ¿Qué es este proyecto?

**Flights Search Service** es un servicio backend diseñado para buscar y gestionar información de vuelos. Está construido con **NestJS**, un framework de Node.js que utiliza TypeScript y sigue principios de arquitectura orientada a objetos y programación funcional.

### 1.2 Propósito

Este servicio está diseñado para:
- Proporcionar una API REST para búsqueda de vuelos
- Implementar un sistema de caché eficiente usando Redis
- Preparar la infraestructura para integrar múltiples proveedores de vuelos (como Amadeus)
- Ser escalable, mantenible y fácil de extender

### 1.3 Estado Actual

**Implementado:**
- ✅ Sistema de caché Redis completo
- ✅ Endpoints de debug para probar el caché
- ✅ Configuración de Docker Compose
- ✅ Estructura base del proyecto
- ✅ Configuración base del sistema de logging con Winston

**En desarrollo:**
- 🔄 Sistema de logging (`infra/logging`) - Configuración lista, servicio/interceptor/filter pendientes
- 🔄 Patrones de resiliencia (`infra/resilience`) - Dependencias instaladas (Cockatiel)

**Preparado para implementación futura:**
- 🔄 Módulo de búsqueda de vuelos (`modules/search`)
- 🔄 Integración con Amadeus (`modules/providers/amadeus`)

---

## 2. Arquitectura del Proyecto

### 2.1 Arquitectura General

El proyecto sigue una **arquitectura en capas** (Layered Architecture) con separación clara de responsabilidades:

```
┌─────────────────────────────────────────┐
│         Capa de Presentación            │
│      (Controllers - REST API)           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Capa de Lógica de Negocio       │
│      (Modules - Business Logic)         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Capa de Infraestructura         │
│  (Cache, Logging, Resilience, External) │
└─────────────────────────────────────────┘
```

### 2.2 Patrones de Diseño Utilizados

1. **Dependency Injection (DI)**: NestJS utiliza inyección de dependencias para desacoplar componentes
2. **Module Pattern**: Cada funcionalidad está encapsulada en un módulo
3. **Provider Pattern**: Los servicios y recursos se proveen mediante providers
4. **Factory Pattern**: Se usa para crear configuraciones dinámicas
5. **Cache-Aside Pattern**: Implementado en el servicio de caché

### 2.3 Flujo de Datos

```
Cliente HTTP
    ↓
Controller (Recibe petición)
    ↓
Service (Lógica de negocio)
    ↓
CacheService (Verifica caché)
    ↓
Redis (Almacenamiento) o
Proveedor Externo (API, BD, etc.)
```

---

## 3. Decisiones Arquitectónicas

### 3.1 ¿Por qué NestJS?

**NestJS** fue elegido porque:

1. **TypeScript nativo**: Proporciona tipado estático, reduciendo errores en tiempo de ejecución
2. **Arquitectura modular**: Facilita la organización y escalabilidad del código
3. **Dependency Injection**: Permite desacoplar componentes y facilitar testing
4. **Decoradores**: Simplifica la definición de rutas, validaciones y middleware
5. **Ecosistema maduro**: Gran comunidad y muchas librerías compatibles
6. **Inspirado en Angular**: Si conoces Angular, NestJS será familiar

### 3.2 Separación de Carpetas

#### `src/infra/` - Infraestructura

**Decisión**: Separar toda la infraestructura técnica (caché, logging, conexiones externas) de la lógica de negocio.

**Razones**:
- **Desacoplamiento**: La lógica de negocio no depende de implementaciones específicas
- **Testabilidad**: Fácil mockear servicios de infraestructura en tests
- **Reutilización**: Los servicios de infraestructura pueden ser usados por múltiples módulos
- **Mantenibilidad**: Cambios en infraestructura no afectan la lógica de negocio

#### `src/modules/` - Módulos de Negocio

**Decisión**: Organizar la lógica de negocio por dominio funcional.

**Razones**:
- **Domain-Driven Design (DDD)**: Cada módulo representa un dominio del negocio
- **Escalabilidad**: Fácil agregar nuevos módulos sin afectar existentes
- **Claridad**: Cada desarrollador sabe dónde encontrar código relacionado
- **Independencia**: Los módulos pueden evolucionar independientemente

#### `src/controllers/` - Controladores

**Decisión**: Separar controladores de los módulos.

**Razones**:
- **Separación de responsabilidades**: Los controladores solo manejan HTTP, no lógica
- **Reutilización**: Un módulo puede tener múltiples controladores (REST, GraphQL, WebSocket)
- **Claridad**: Fácil identificar todos los endpoints de la aplicación

### 3.3 ¿Por qué Redis para el Caché?

**Redis** fue elegido porque:

1. **Rendimiento**: Almacenamiento en memoria, extremadamente rápido
2. **TTL nativo**: Expiración automática de claves sin código adicional
3. **Estructuras de datos**: Soporta strings, hashes, lists, sets, etc.
4. **Persistencia opcional**: Puede persistir datos en disco si es necesario
5. **Replicación y clustering**: Escalabilidad horizontal
6. **Ecosistema**: Ampliamente usado y bien documentado

### 3.4 Estrategia de Caché: Cache-Aside

**Patrón elegido**: Cache-Aside (también llamado Lazy Loading)

**Cómo funciona**:
1. La aplicación busca primero en el caché
2. Si no encuentra (cache miss), obtiene datos de la fuente original
3. Guarda el resultado en el caché para próximas peticiones
4. Retorna los datos

**Ventajas**:
- Simple de implementar
- El caché puede fallar sin afectar la aplicación
- Control total sobre qué se cachea y cuándo
- Fácil invalidar caché cuando los datos cambian

**Desventajas**:
- Dos llamadas en caso de cache miss (una al caché, otra a la fuente)
- Posible inconsistencia si múltiples instancias actualizan datos

---

## 4. Estructura de Carpetas

### 4.1 Estructura Completa

```
SearchFlightsService/
├── dist/                    # Código compilado (generado automáticamente)
├── node_modules/            # Dependencias (generado por pnpm)
├── src/                     # Código fuente
│   ├── infra/              # Infraestructura técnica
│   │   ├── cache/         # Módulo de caché Redis
│   │   ├── logging/       # Sistema de logging (futuro)
│   │   └── resilience/    # Patrones de resiliencia (futuro)
│   ├── modules/           # Módulos de negocio
│   │   ├── search/        # Lógica de búsqueda (futuro)
│   │   └── providers/     # Proveedores externos
│   │       └── amadeus/   # Integración Amadeus (futuro)
│   ├── controllers/       # Controladores REST
│   ├── common/            # Utilidades compartidas (futuro)
│   ├── config/            # Configuraciones (futuro)
│   ├── app.module.ts      # Módulo raíz de la aplicación
│   └── main.ts           # Punto de entrada de la aplicación
├── test/                  # Tests end-to-end
├── .gitignore            # Archivos ignorados por Git
├── docker-compose.yml    # Configuración Docker para Redis
├── eslint.config.mjs     # Configuración ESLint
├── nest-cli.json         # Configuración NestJS CLI
├── package.json          # Dependencias y scripts
├── pnpm-lock.yaml        # Lock file de pnpm
├── tsconfig.json         # Configuración TypeScript
├── tsconfig.build.json   # Configuración TypeScript para build
└── README.md             # Este archivo
```

### 4.2 Descripción de Carpetas

#### `src/` - Código Fuente Principal

Contiene todo el código TypeScript de la aplicación. Esta es la carpeta que desarrollas y mantienes.

#### `src/infra/` - Infraestructura

**Propósito**: Contiene toda la infraestructura técnica que soporta la aplicación.

**Subcarpetas**:
- `cache/`: Implementación del sistema de caché Redis
- `logging/`: Sistema de logging con Winston (configuración implementada, servicio/interceptor/filter en desarrollo)
- `resilience/`: Patrones de resiliencia como circuit breakers, retries (dependencias instaladas, implementación pendiente)

**Decisión**: Separar infraestructura permite cambiar implementaciones sin afectar la lógica de negocio.

#### `src/modules/` - Módulos de Negocio

**Propósito**: Contiene la lógica de negocio organizada por dominio.

**Subcarpetas**:
- `search/`: Lógica de búsqueda de vuelos (preparado para implementación futura)
- `providers/`: Integraciones con proveedores externos
  - `amadeus/`: Integración con la API de Amadeus (preparado para implementación futura)

**Decisión**: Organización por dominio facilita el mantenimiento y la escalabilidad.

#### `src/controllers/` - Controladores HTTP

**Propósito**: Maneja las peticiones HTTP entrantes y las respuestas.

**Contenido actual**:
- `cache-debug.controller.ts`: Endpoints para probar y debuggear el caché

**Decisión**: Separar controladores permite tener múltiples interfaces (REST, GraphQL, WebSocket) para la misma lógica.

#### `src/common/` - Utilidades Compartidas

**Propósito**: Funciones, tipos y utilidades compartidas entre módulos.

**Estado**: Preparado para implementación futura.

**Ejemplos de uso futuro**:
- DTOs (Data Transfer Objects) compartidos
- Validadores personalizados
- Helpers y utilidades
- Excepciones personalizadas

#### `src/config/` - Configuraciones

**Propósito**: Configuraciones centralizadas de la aplicación.

**Estado**: Preparado para implementación futura.

**Ejemplos de uso futuro**:
- Configuraciones de proveedores externos
- Configuraciones de rate limiting
- Configuraciones de seguridad

#### `dist/` - Código Compilado

**Propósito**: Contiene el código JavaScript compilado desde TypeScript.

**Importante**: Esta carpeta se genera automáticamente y **no debe editarse manualmente**. Se regenera cada vez que ejecutas `pnpm run build`.

#### `test/` - Tests

**Propósito**: Contiene los tests end-to-end de la aplicación.

**Contenido actual**:
- `app.e2e-spec.ts`: Test básico de la aplicación
- `jest-e2e.json`: Configuración de Jest para tests e2e

---

## 5. Archivos del Proyecto

### 5.1 Archivos de Configuración

#### `package.json`

**Propósito**: Define las dependencias del proyecto, scripts y metadatos.

**Secciones importantes**:

```json
{
  "name": "flights-search-service",  // Nombre del proyecto
  "version": "0.0.1",                 // Versión semántica
  "scripts": {                        // Comandos ejecutables
    "start:dev": "nest start --watch" // Modo desarrollo con hot-reload
  },
  "dependencies": {                   // Dependencias de producción
    "@nestjs/common": "^11.0.1"       // Framework NestJS
  },
  "devDependencies": {                // Dependencias de desarrollo
    "typescript": "^5.7.3"            // Compilador TypeScript
  }
}
```

**Decisiones**:
- **pnpm**: Gestor de paquetes más eficiente que npm en espacio y velocidad
- **Versiones con `^`**: Permite actualizaciones menores automáticas (11.0.1 → 11.1.0, pero no 12.0.0)

#### `tsconfig.json`

**Propósito**: Configuración del compilador TypeScript.

**Opciones clave explicadas**:

```json
{
  "compilerOptions": {
    "target": "ES2023",             // Versión de JavaScript a generar
    "module": "nodenext",           // Sistema de módulos (ESM para Node.js)
    "moduleResolution": "nodenext", // Cómo resolver imports
    "experimentalDecorators": true, // Habilita decoradores (@Injectable, @Controller)
    "emitDecoratorMetadata": true,  // Emite metadatos para DI de NestJS
    "strict": true,                 // Habilita todas las verificaciones estrictas
    "strictNullChecks": true,       // Verifica null/undefined explícitamente
    "noImplicitAny": false,         // Permite 'any' implícito (más flexible)
    "sourceMap": true,              // Genera source maps para debugging
    "outDir": "./dist",             // Carpeta de salida del código compilado
    "baseUrl": "./"                 // Base para imports absolutos
  }
}
```

**Decisiones**:
- **ES2023**: Usa características modernas de JavaScript
- **nodenext**: Compatible con módulos ESM de Node.js moderno
- **strict: true**: Mayor seguridad de tipos, previene errores comunes
- **noImplicitAny: false**: Más flexible durante desarrollo, puede cambiarse a true después

#### `tsconfig.build.json`

**Propósito**: Configuración específica para el proceso de build.

**Diferencia con `tsconfig.json`**:
- Excluye archivos de test (`**/*spec.ts`)
- Se usa solo durante la compilación para producción

#### `nest-cli.json`

**Propósito**: Configuración del CLI de NestJS.

```json
{
  "sourceRoot": "src",              // Carpeta raíz del código fuente
  "compilerOptions": {
    "deleteOutDir": true            // Borra dist/ antes de compilar
  }
}
```

**Decisión**: `deleteOutDir: true` asegura que no queden archivos obsoletos después de compilar.

#### `eslint.config.mjs`

**Propósito**: Configuración de ESLint para mantener calidad de código.

**Configuración explicada**:

```javascript
export default tseslint.config(
  eslint.configs.recommended,                    // Reglas recomendadas de ESLint
  ...tseslint.configs.recommendedTypeChecked,    // Reglas de TypeScript
  eslintPluginPrettierRecommended,               // Integración con Prettier
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',        // Permite usar 'any'
      '@typescript-eslint/no-floating-promises': 'warn',   // Advierte promesas no manejadas
    }
  }
);
```

**Decisiones**:
- **Prettier integrado**: Formatea código automáticamente
- **no-explicit-any: off**: Permite flexibilidad durante desarrollo
- **no-floating-promises: warn**: Advierte pero no bloquea promesas sin await

#### `docker-compose.yml`

**Propósito**: Define servicios Docker para desarrollo local.

**Servicios definidos**:

```yaml
services:
  redis:                    # Servidor Redis
    image: redis:7          # Versión 7 de Redis
    ports:
      - "6379:6379"         # Puerto estándar de Redis
    volumes:
      - redis:/data         # Persistencia de datos

  redis-insight:            # Interfaz gráfica para Redis
    image: redis/redisinsight:latest
    ports:
      - "8001:8001"         # Puerto web de Redis Insight
    depends_on:
      - redis               # Espera a que Redis esté listo
```

**Decisiones**:
- **Redis 7**: Última versión estable
- **Redis Insight**: Herramienta visual para inspeccionar datos en Redis
- **Volúmenes**: Persistencia de datos entre reinicios del contenedor

### 5.2 Archivos de Código Fuente

#### `src/main.ts` - Punto de Entrada

**Propósito**: Archivo que se ejecuta cuando inicias la aplicación. Es el punto de entrada principal.

**Código completo**:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

**Explicación línea por línea**:

1. **`import { NestFactory }`**: Importa la clase que crea la aplicación NestJS
2. **`import { AppModule }`**: Importa el módulo raíz de la aplicación
3. **`async function bootstrap()`**: Función asíncrona que inicializa la app
   - **`async`**: Permite usar `await` dentro de la función
4. **`NestFactory.create(AppModule)`**: Crea una instancia de la aplicación usando el módulo raíz
   - **`AppModule`**: Define qué módulos, controladores y servicios tiene la app
5. **`app.listen(process.env.PORT ?? 3000)`**: Inicia el servidor HTTP
   - **`process.env.PORT`**: Lee el puerto de variables de entorno
   - **`?? 3000`**: Si no existe, usa el puerto 3000 por defecto
   - **`await`**: Espera a que el servidor esté listo
6. **`bootstrap()`**: Ejecuta la función de inicialización

**Decisiones**:
- **Puerto configurable**: Permite cambiar el puerto sin modificar código
- **3000 por defecto**: Puerto estándar para desarrollo
- **Función separada**: Facilita testing y permite agregar configuración adicional (CORS, validación, etc.)

#### `src/app.module.ts` - Módulo Raíz

**Propósito**: Define la estructura completa de la aplicación. Es el "corazón" que conecta todos los módulos.

**Código completo**:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './infra/cache/cache.module';
import { CacheDebugController } from './controllers/cache-debug.controller';
import { CacheService } from './infra/cache/cache.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule,
  ],
  controllers: [CacheDebugController],
  providers: [CacheService],
})
export class AppModule {}
```

**Explicación línea por línea**:

1. **`@Module({ ... })`**: Decorador que marca la clase como un módulo de NestJS
   - **Decorador**: Función especial que modifica la clase en tiempo de ejecución
2. **`imports: [...]`**: Lista de módulos que este módulo necesita
   - **`ConfigModule.forRoot({ isGlobal: true })`**: 
     - Carga variables de entorno desde `.env`
     - `isGlobal: true` hace que esté disponible en todos los módulos sin importarlo
   - **`CacheModule`**: Módulo que provee el cliente de Redis
3. **`controllers: [CacheDebugController]`**: Controladores que manejan peticiones HTTP
   - **`CacheDebugController`**: Define las rutas `/debug/cache/*`
4. **`providers: [CacheService]`**: Servicios disponibles en este módulo
   - **`CacheService`**: Servicio que encapsula la lógica del caché
5. **`export class AppModule {}`**: Clase vacía porque toda la configuración está en el decorador

**Decisiones**:
- **ConfigModule global**: Evita importarlo en cada módulo
- **CacheService como provider**: Permite inyectarlo en controladores
- **Separación de módulos**: `CacheModule` maneja la infraestructura, `AppModule` orquesta todo

### 5.3 Módulo de Logging (`src/infra/logging/`)

#### `logger.config.ts` - Configuración de Winston

**Propósito**: Configura el logger de Winston con formatos y transports según el entorno.

**Características principales**:

1. **Formato por entorno**:
   - **Desarrollo**: Formato legible con colores y timestamps
   - **Producción**: Formato JSON estructurado para sistemas de agregación

2. **Transports**:
   - **Consola**: Siempre activo, nivel `debug` en dev, `info` en prod
   - **Archivos** (solo producción):
     - `logs/error.log`: Solo errores
     - `logs/combined.log`: Todos los logs

3. **Funciones helper**:
   - `determineLogLevel()`: Define el nivel según el entorno
   - `safeString()`: Convierte valores a string de forma segura
   - `buildLoggerFormat()`: Construye el formato según el entorno

**Decisiones**:
- **JSON en producción**: Facilita parsing por herramientas como ELK, CloudWatch
- **Colores en desarrollo**: Mejor experiencia de desarrollo
- **Archivos separados**: Errores en archivo dedicado para fácil acceso
- **Nivel debug en dev**: Más información durante desarrollo

**Estado**: ✅ Configuración completa. Pendiente: servicio, interceptor y filter de excepciones.

#### `logger.module.ts` - Módulo de Logging

**Propósito**: Define el módulo de logging de NestJS.

**Estado**: Estructura creada, pendiente de implementación completa con providers y exports.

#### `logger.service.ts`, `logger.interceptor.ts`, `global-exception.filter.ts`

**Estado**: Archivos creados, pendientes de implementación.

### 5.4 Módulo de Caché (`src/infra/cache/`)

#### `cache.types.ts` - Tipos y Tokens

**Propósito**: Define los tipos TypeScript y tokens de inyección para el sistema de caché.

**Código completo**:

```typescript
export const CACHE_CLIENT = 'CACHE_CLIENT';

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<'OK' | null>;
  del(key: string): Promise<number>;
}
```

**Explicación**:

1. **`export const CACHE_CLIENT = 'CACHE_CLIENT'`**: 
   - **Token de inyección**: String que identifica qué instancia inyectar
   - **Por qué un string**: NestJS usa tokens para identificar dependencias. Puede ser una clase, string, o símbolo
   - **Decisión de usar string**: Permite desacoplar la interfaz de la implementación

2. **`interface CacheClient`**:
   - **Interfaz**: Define el "contrato" que debe cumplir el cliente de caché
   - **`get(key: string)`**: Obtiene un valor del caché
     - Retorna `Promise<string | null>`: Asíncrono, puede retornar null si no existe
   - **`set(key, value, ...args)`**: Guarda un valor
     - `...args`: Permite argumentos adicionales como TTL (Time To Live)
   - **`del(key)`**: Elimina una clave
     - Retorna `Promise<number>`: Número de claves eliminadas

**Decisiones**:
- **Interfaz en lugar de clase**: Permite múltiples implementaciones (Redis, Memcached, etc.)
- **Métodos asíncronos**: Redis es asíncrono, la interfaz debe reflejarlo
- **`...args` en set**: Flexibilidad para diferentes opciones de Redis (TTL, NX, XX, etc.)

#### `cache.config.ts` - Configuración

**Propósito**: Centraliza la configuración del caché leyendo variables de entorno.

**Código completo**:

```typescript
export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  ttlSeconds: number;
}

export function cacheConfigFactory(): CacheConfig {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    ttlSeconds: Number(process.env.REDIS_TTL_SECONDS ?? 3600),
  };
}
```

**Explicación**:

1. **`interface CacheConfig`**:
   - Define la estructura de la configuración
   - **`password?: string`**: El `?` significa opcional (puede ser undefined)

2. **`function cacheConfigFactory()`**:
   - **Factory function**: Patrón de diseño que crea objetos
   - **Por qué función y no constante**: Se ejecuta cada vez que se llama, leyendo valores actuales de `process.env`
   - **Valores por defecto**: Usa `??` (nullish coalescing) para valores por defecto
     - `'localhost'`: Redis local por defecto
     - `6379`: Puerto estándar de Redis
     - `3600`: 1 hora en segundos

**Decisiones**:
- **Factory function**: Permite lógica condicional futura (diferentes configs por ambiente)
- **Valores por defecto**: La app funciona sin `.env` para desarrollo local
- **Number() explícito**: Convierte strings de `process.env` a números

#### `cache.provider.ts` - Proveedor de Redis

**Propósito**: Crea y configura la instancia de Redis que se inyecta en el sistema.

**Código completo**:

```typescript
import Redis from 'ioredis';
import { CACHE_CLIENT } from './cache.types';
import { cacheConfigFactory } from './cache.config';

export const cacheProvider = {
  provide: CACHE_CLIENT,
  useFactory: () => {
    const config = cacheConfigFactory();
    const client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      lazyConnect: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`[Cache] Retry #${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: () => {
        console.warn('[Cache] Connection error, attempting reconnect...');
        return true;
      },
      keyPrefix: `flightseach:${process.env.NODE_ENV ?? 'dev'}:`,
    });
    
    client.on('connect', () => {
      console.log('[Cache] Redis connected');
    });
    client.on('error', (error) => {
      console.log('[Cache] Redis error', error);
    });
    return client;
  },
};
```

**Explicación detallada**:

1. **`export const cacheProvider`**:
   - **Provider**: Objeto que define cómo crear una dependencia en NestJS
   - **`provide: CACHE_CLIENT`**: Token que identifica este provider
   - **`useFactory`**: Función que se ejecuta para crear la instancia

2. **`const config = cacheConfigFactory()`**:
   - Obtiene la configuración desde variables de entorno

3. **`new Redis({ ... })`**: Crea instancia de cliente Redis con opciones:
   - **`host, port, password`**: Configuración de conexión
   - **`lazyConnect: true`**: **Decisión importante**
     - No se conecta inmediatamente
     - Se conecta cuando se usa por primera vez
     - **Por qué**: Evita que la app falle al iniciar si Redis no está disponible
   - **`retryStrategy: (times) => {...}`**: **Estrategia de reintento**
     - `times`: Número de intento actual
     - `Math.min(times * 50, 2000)`: Delay creciente (50ms, 100ms, 150ms...) hasta máximo 2000ms
     - **Por qué**: Evita saturar Redis con reintentos muy rápidos
   - **`reconnectOnError: () => true`**: Reintenta conexión automáticamente en errores
   - **`keyPrefix: 'flightseach:${NODE_ENV}:'`**: **Prefijo de claves**
     - Todas las claves empiezan con este prefijo
     - **Por qué**: Evita colisiones entre ambientes (dev, staging, prod)
     - Ejemplo: `flightseach:dev:user:123` vs `flightseach:prod:user:123`

4. **Event listeners**:
   - **`client.on('connect')`**: Se ejecuta cuando Redis se conecta
   - **`client.on('error')`**: Se ejecuta en errores de conexión
   - **Por qué**: Logging para debugging y monitoreo

**Decisiones clave**:
- **lazyConnect: true**: Aplicación resiliente, no falla si Redis está caído
- **Retry con backoff exponencial**: Evita saturar Redis
- **Key prefix por ambiente**: Aislamiento de datos entre ambientes
- **Event listeners**: Visibilidad del estado de conexión

#### `cache.module.ts` - Módulo de Caché

**Propósito**: Define el módulo que provee el cliente de Redis a toda la aplicación.

**Código completo**:

```typescript
import { Module } from '@nestjs/common';
import { CACHE_CLIENT } from './cache.types';
import { cacheProvider } from './cache.provider';

@Module({
  providers: [cacheProvider],
  exports: [CACHE_CLIENT],
})
export class CacheModule {}
```

**Explicación**:

1. **`@Module({ ... })`**: Decorador que define el módulo
2. **`providers: [cacheProvider]`**: Lista de providers que este módulo crea
   - `cacheProvider` crea la instancia de Redis
3. **`exports: [CACHE_CLIENT]`**: **Muy importante**
   - Exporta el token `CACHE_CLIENT`, no el provider
   - Permite que otros módulos inyecten el cliente Redis
   - **Sin esto**: Otros módulos no podrían usar Redis

**Decisiones**:
- **Exportar el token**: Permite inyección en otros módulos
- **Módulo separado**: Facilita testing (puedes mockear fácilmente)

#### `cache.service.ts` - Servicio de Caché

**Propósito**: Encapsula la lógica de caché, proporcionando una API simple y segura.

**Estructura del archivo**:

```typescript
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private hitCount = 0;
  private missCount = 0;

  constructor(
    @Inject(CACHE_CLIENT)
    private readonly client: CacheClient,
  ) {}

  composeKey(...parts: string[]): string { ... }
  async get<T = any>(key: string): Promise<T | null> { ... }
  async set(key: string, value: any, ttlSeconds: number): Promise<void> { ... }
  async delete(key: string): Promise<void> { ... }
  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> { ... }
  getStats() { ... }
}
```

**Explicación de la clase**:

1. **`@Injectable()`**: Decorador que marca la clase como inyectable
   - Permite que NestJS la inyecte en otros componentes

2. **`private readonly logger`**: Logger para registrar eventos
   - **`Logger(CacheService.name)`**: Crea logger con contexto "CacheService"
   - **Por qué**: Facilita filtrar logs por componente

3. **`private hitCount` y `missCount`**: Contadores de métricas
   - **hit**: Valor encontrado en caché
   - **miss**: Valor no encontrado en caché
   - **Por qué privados**: Encapsulación, solo esta clase los modifica

4. **`constructor(@Inject(CACHE_CLIENT) private readonly client)`**:
   - **`@Inject(CACHE_CLIENT)`**: Indica qué token inyectar
   - **`private readonly`**: Crea propiedad y la asigna automáticamente
   - **`CacheClient`**: Tipo de la interfaz (solo para TypeScript)

**Métodos explicados**:

##### `composeKey(...parts: string[]): string`

**Propósito**: Construye claves de caché de forma consistente.

```typescript
composeKey(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}
```

**Ejemplo de uso**:
```typescript
this.cache.composeKey('user', '123', 'profile') 
// → 'user:123:profile'
```

**Decisiones**:
- **`...parts`**: Permite cualquier número de argumentos
- **`filter(Boolean)`**: Elimina valores falsy (null, undefined, '')
- **`join(':')`**: Convención de Redis para claves jerárquicas

##### `async get<T = any>(key: string): Promise<T | null>`

**Propósito**: Obtiene un valor del caché, parseando JSON automáticamente.

```typescript
async get<T = any>(key: string): Promise<T | null> {
  try {
    const raw = await this.client.get(key);
    
    if (raw === null) {
      this.missCount++;
      this.logger.verbose(`MISS → ${key}`);
      return null;
    }

    this.hitCount++;
    this.logger.verbose(`HIT → ${key}`);

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  } catch (err) {
    this.logger.error(`Error al obtener key ${key}`, err);
    return null;
  }
}
```

**Explicación**:
1. **`try-catch` externo**: Captura errores de conexión
2. **`await this.client.get(key)`**: Obtiene valor de Redis
3. **Si `null`**: No existe en caché → incrementa miss, log, retorna null
4. **Si existe**: Incrementa hit, intenta parsear JSON
5. **`JSON.parse` con try-catch interno**: Si falla (no es JSON), retorna string crudo
6. **Error de conexión**: Log pero retorna null (fail-safe)

**Decisiones**:
- **Genérico `<T>`**: Permite tipado fuerte del valor retornado
- **Parseo JSON automático**: Conveniencia, no necesitas parsear manualmente
- **Fallback a string**: Si guardaste un string simple, lo retorna tal cual
- **Fail-safe**: La app continúa aunque Redis falle

##### `async set(key: string, value: any, ttlSeconds: number): Promise<void>`

**Propósito**: Guarda un valor en caché con TTL (Time To Live).

```typescript
async set(key: string, value: any, ttlSeconds: number): Promise<void> {
  try {
    const payload = JSON.stringify(value);
    await this.client.set(key, payload, 'EX', ttlSeconds);
    this.logger.debug(`SET → ${key} (TTL ${ttlSeconds}s)`);
  } catch (err) {
    this.logger.error(`Error al setear key ${key}`, err);
  }
}
```

**Explicación**:
1. **`JSON.stringify(value)`**: Convierte cualquier valor a JSON string
2. **`client.set(key, payload, 'EX', ttlSeconds)`**:
   - `'EX'`: Modo de expiración en segundos
   - `ttlSeconds`: Tiempo hasta expiración
3. **Logging**: Registra la operación para debugging

**Decisiones**:
- **JSON.stringify automático**: Puedes guardar objetos directamente
- **TTL obligatorio**: Fuerza a pensar en expiración de datos
- **Fail-safe**: No lanza error si falla

##### `async delete(key: string): Promise<void>`

**Propósito**: Elimina una clave del caché manualmente.

```typescript
async delete(key: string): Promise<void> {
  try {
    await this.client.del(key);
    this.logger.debug(`DEL → ${key}`);
  } catch (err) {
    this.logger.error(`Error al borrar key ${key}`, err);
  }
}
```

**Uso típico**: Invalidar caché cuando los datos cambian en la fuente original.

##### `async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T>`

**Propósito**: Implementa el patrón **Cache-Aside** de forma simple.

```typescript
async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const cached = await this.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const result = await fn();
  await this.set(key, result, ttlSeconds);
  return result;
}
```

**Cómo funciona**:
1. Busca en caché
2. Si existe, retorna inmediatamente (evita operación costosa)
3. Si no existe, ejecuta la función `fn()`
4. Guarda el resultado en caché
5. Retorna el resultado

**Ejemplo de uso**:
```typescript
// Sin wrap (manual)
let data = await cache.get('expensive-data');
if (!data) {
  data = await expensiveDatabaseQuery();
  await cache.set('expensive-data', data, 3600);
}

// Con wrap (automático)
const data = await cache.wrap('expensive-data', 3600, async () => {
  return await expensiveDatabaseQuery();
});
```

**Decisiones**:
- **Patrón común**: Cache-aside es el patrón más usado
- **Simplifica código**: Una línea en lugar de 4-5
- **Type-safe**: Mantiene el tipado de la función

##### `getStats(): { hits: number; misses: number }`

**Propósito**: Retorna métricas del caché para monitoreo.

```typescript
getStats() {
  return {
    hits: this.hitCount,
    misses: this.missCount,
  };
}
```

**Uso**: Calcular hit rate = `hits / (hits + misses)`. Un hit rate alto (>80%) indica buen uso del caché.

### 5.5 Controladores

#### `src/controllers/cache-debug.controller.ts`

**Propósito**: Endpoints HTTP para probar y debuggear el sistema de caché durante desarrollo.

**Código completo**:

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { CacheService } from '../infra/cache/cache.service';

@Controller('debug/cache')
export class CacheDebugController {
  constructor(private readonly cache: CacheService) {}

  @Get('set')
  async set(@Query('key') key: string, @Query('value') value: string) {
    await this.cache.set(key, value, 60);
    return { ok: true, key, value };
  }

  @Get('get')
  async get(@Query('key') key: string) {
    const value: unknown = await this.cache.get(key);
    return { key, value };
  }

  @Get('wrap')
  async wrap(@Query('key') key: string) {
    const result = await this.cache.wrap(key, 60, () => {
      return Promise.resolve({ generatedAt: new Date().toISOString() });
    });
    return { key, result };
  }

  @Get('stats')
  stats() {
    return this.cache.getStats();
  }
}
```

**Explicación**:

1. **`@Controller('debug/cache')`**: 
   - Define el prefijo de ruta: todas las rutas empiezan con `/debug/cache`
   - **Por qué 'debug'**: Indica que son endpoints de desarrollo, no producción

2. **`constructor(private readonly cache: CacheService)`**:
   - **Inyección de dependencias**: NestJS inyecta automáticamente `CacheService`
   - **`private readonly`**: Crea propiedad automáticamente

3. **`@Get('set')`**: Decorador que mapea peticiones GET a `/debug/cache/set`
   - **`@Query('key')`**: Extrae el parámetro `?key=valor` de la URL
   - **Ejemplo**: `GET /debug/cache/set?key=test&value=hello`

4. **`@Get('get')`**: Similar, pero solo necesita `key`

5. **`@Get('wrap')`**: Demuestra el patrón cache-aside
   - Genera un objeto con timestamp
   - Primera llamada: genera nuevo
   - Segunda llamada (mismo key): retorna del caché

6. **`@Get('stats')`**: Retorna métricas sin parámetros

**Decisiones**:
- **Solo GET**: Simple para probar desde navegador
- **Query parameters**: Fácil de usar sin herramientas especiales
- **Endpoints de debug**: No deberían estar en producción (agregar autenticación o deshabilitar)

### 5.6 Tests

#### `test/app.e2e-spec.ts`

**Propósito**: Test end-to-end básico de la aplicación.

**Código**:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
```

**Explicación**:
- **`beforeEach`**: Se ejecuta antes de cada test, crea una nueva instancia de la app
- **`Test.createTestingModule`**: Crea módulo de testing (puede mockear dependencias)
- **`supertest`**: Librería para hacer peticiones HTTP en tests
- **Test actual**: Verifica que `GET /` retorna 200 y "Hello World!"

**Nota**: Este test probablemente fallará porque no hay ruta `/` definida. Es un template que debes adaptar.

---

## 6. Dependencias

### 6.1 Dependencias de Producción

#### `@nestjs/common` (^11.0.1)

**Propósito**: Paquete core de NestJS con decoradores, clases base y utilidades.

**Contiene**:
- `@Injectable`, `@Controller`, `@Module`, `@Get`, etc.
- `Logger`, `HttpException`, validadores
- Utilidades para DI y metadatos

**Por qué se necesita**: Esencial para NestJS, sin esto no funciona el framework.

#### `@nestjs/core` (^11.0.1)

**Propósito**: Motor interno de NestJS (DI container, módulos, lifecycle).

**Diferencia con `@nestjs/common`**:
- `core`: Motor interno (no se usa directamente)
- `common`: API pública que usas en tu código

**Por qué se necesita**: NestJS lo usa internamente.

#### `@nestjs/platform-express` (^11.0.1)

**Propósito**: Adaptador HTTP que conecta NestJS con Express.js.

**Por qué Express**: NestJS es agnóstico de HTTP, necesita un adaptador. Express es el más común.

**Alternativas**: `@nestjs/platform-fastify` (más rápido pero menos middleware).

**Por qué se necesita**: Sin esto, NestJS no puede manejar peticiones HTTP.

#### `@nestjs/config` (^4.0.2)

**Propósito**: Módulo para gestionar variables de entorno y configuración.

**Funcionalidades**:
- Carga archivos `.env`
- Validación de variables requeridas
- Configuración tipada
- Módulo global

**Por qué se necesita**: Centraliza y valida configuración de forma segura.

#### `winston` (^3.18.3) y `nest-winston` (^1.10.2)

**Propósito**: Sistema de logging estructurado y flexible.

**Características**:
- Múltiples niveles de log (error, warn, info, debug)
- Formato JSON en producción, coloreado en desarrollo
- Transports configurables (consola, archivos)
- Integración nativa con NestJS

**Por qué se necesita**: Logging estructurado es esencial para debugging y monitoreo en producción.

#### `cockatiel` (^3.2.1)

**Propósito**: Librería para implementar patrones de resiliencia.

**Características**:
- Circuit breakers
- Retry policies
- Timeout policies
- Bulkhead isolation

**Por qué se necesita**: Mejora la resiliencia de la aplicación ante fallos de servicios externos.

#### `class-validator` (^0.14.3)

**Propósito**: Validación de DTOs y objetos usando decoradores.

**Características**:
- Validación declarativa con decoradores
- Integración con NestJS pipes
- Mensajes de error personalizables

**Por qué se necesita**: Validación robusta de datos de entrada en la API.

#### `axios` (^1.13.2)

**Propósito**: Cliente HTTP para realizar peticiones a APIs externas.

**Características**:
- Soporte para promesas
- Interceptores
- Transformación automática de datos
- Cancelación de peticiones

**Por qué se necesita**: Comunicación con APIs externas (ej: Amadeus).

#### `ioredis` (^5.8.2)

**Propósito**: Cliente Redis para Node.js.

**Características**:
- Soporte completo de comandos Redis
- Reconexión automática
- Clustering y sentinel
- Promesas nativas (async/await)

**Alternativas**: `redis` (oficial pero menos features), `node-redis` (versión antigua).

**Por qué ioredis**: Más features, mejor soporte de TypeScript, muy mantenido.

#### `reflect-metadata` (^0.2.2)

**Propósito**: Polyfill para metadatos de TypeScript (necesario para decoradores).

**Por qué se necesita**: TypeScript decorators requieren metadatos en runtime. NestJS los usa para DI.

#### `rxjs` (^7.8.1)

**Propósito**: Librería de programación reactiva (Observables, streams).

**Por qué se necesita**: NestJS usa RxJS internamente para:
- Interceptores
- Pipes
- Guards
- Eventos

**Nota**: Puedes usar async/await normalmente, RxJS es interno.

### 6.2 Dependencias de Desarrollo

#### `typescript` (^5.7.3)

**Propósito**: Compilador de TypeScript a JavaScript.

**Por qué se necesita**: El proyecto está en TypeScript, necesita compilarse.

#### `@nestjs/cli` (^11.0.0)

**Propósito**: CLI de NestJS para generar código, compilar, etc.

**Comandos**: `nest generate`, `nest build`, `nest start`.

**Por qué se necesita**: Facilita desarrollo y build.

#### `jest` (^30.0.0) y `ts-jest` (^29.2.5)

**Propósito**: Framework de testing.

- **jest**: Runner de tests
- **ts-jest**: Transforma TypeScript para Jest

**Por qué se necesita**: Testing es esencial para código de calidad.

#### `eslint` (^9.18.0) y `typescript-eslint` (^8.20.0)

**Propósito**: Linter para mantener calidad de código.

**Por qué se necesita**: Detecta errores, mantiene estilo consistente.

#### `prettier` (^3.4.2)

**Propósito**: Formateador de código automático.

**Por qué se necesita**: Mantiene formato consistente sin discusiones.

#### `supertest` (^7.0.0)

**Propósito**: Librería para testing HTTP en tests e2e.

**Por qué se necesita**: Permite testear endpoints sin servidor real.

---

## 7. Configuración

### 7.1 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Puerto del servidor HTTP
PORT=3000

# Configuración de Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=              # Opcional, dejar vacío si no hay password
REDIS_TTL_SECONDS=3600       # TTL por defecto (1 hora)

# Ambiente
NODE_ENV=development         # development | staging | production

# Logging (opcional, usa valores por defecto si no se especifica)
# LOG_LEVEL=debug            # debug | info | warn | error (solo si necesitas override)
```

### 7.2 Docker Compose

Para iniciar Redis localmente:

```bash
docker-compose up -d
```

Esto inicia:
- **Redis** en `localhost:6379`
- **Redis Insight** en `http://localhost:8001` (interfaz gráfica)

### 7.3 Scripts Disponibles

```bash
# Desarrollo
pnpm run start:dev      # Modo desarrollo con hot-reload
pnpm run start:debug    # Modo debug (permite debugging con breakpoints)

# Producción
pnpm run build         # Compila TypeScript a JavaScript
pnpm run start:prod    # Ejecuta la versión compilada

# Calidad
pnpm run lint          # Ejecuta ESLint y corrige errores automáticamente
pnpm run format        # Formatea código con Prettier

# Testing
pnpm run test          # Ejecuta tests unitarios
pnpm run test:watch    # Tests en modo watch (se re-ejecutan al cambiar código)
pnpm run test:cov      # Tests con reporte de cobertura
pnpm run test:e2e      # Tests end-to-end
```

---

## 8. Guía de Uso

### 8.1 Iniciar el Proyecto

1. **Instalar dependencias**:
```bash
pnpm install
```

2. **Iniciar Redis** (si usas Docker):
```bash
docker-compose up -d
```

3. **Crear archivo `.env`** con las variables necesarias

4. **Iniciar en desarrollo**:
```bash
pnpm run start:dev
```

La aplicación estará disponible en `http://localhost:3000`

### 8.2 Probar el Caché

#### Guardar un valor:
```bash
curl "http://localhost:3000/debug/cache/set?key=test&value=hello"
```

#### Obtener un valor:
```bash
curl "http://localhost:3000/debug/cache/get?key=test"
```

#### Probar cache-aside:
```bash
# Primera llamada: genera nuevo valor
curl "http://localhost:3000/debug/cache/wrap?key=generated"

# Segunda llamada (mismo key): retorna del caché (mismo timestamp)
curl "http://localhost:3000/debug/cache/wrap?key=generated"
```

#### Ver estadísticas:
```bash
curl "http://localhost:3000/debug/cache/stats"
```

### 8.3 Usar CacheService en tu Código

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from './infra/cache/cache.service';

@Injectable()
export class MyService {
  constructor(private readonly cache: CacheService) {}

  async getData(id: string) {
    // Patrón cache-aside automático
    return await this.cache.wrap(
      this.cache.composeKey('data', id),
      3600, // 1 hora
      async () => {
        // Operación costosa (API, BD, etc.)
        return await this.fetchFromDatabase(id);
      }
    );
  }

  async updateData(id: string, data: any) {
    // Actualizar en BD
    await this.updateDatabase(id, data);
    
    // Invalidar caché
    await this.cache.delete(
      this.cache.composeKey('data', id)
    );
  }
}
```

### 8.4 Estructura de Claves Recomendada

Usa el método `composeKey` para mantener consistencia:

```typescript
// ✅ Bueno
cache.composeKey('user', userId, 'profile')
// → 'flightseach:dev:user:123:profile'

// ❌ Malo (inconsistente)
`user:${userId}:profile`
`user_${userId}_profile`
```

**Convenciones**:
- Usa `:` como separador (convención Redis)
- Empieza con el tipo de entidad (`user`, `flight`, `search`)
- Sigue con identificadores
- Termina con el recurso específico (`profile`, `settings`)

### 8.5 Sistema de Logging

**Estado actual**: La configuración de Winston está implementada. El servicio, interceptor y filter están pendientes de implementación.

**Una vez implementado**, el sistema de logging proporcionará:

1. **Logging estructurado**:
   - Formato JSON en producción (fácil parsing)
   - Formato legible con colores en desarrollo

2. **Múltiples niveles**:
   - `error`: Errores críticos
   - `warn`: Advertencias
   - `info`: Información general
   - `debug`: Información detallada (solo en desarrollo)

3. **Transports**:
   - Consola: Siempre activo
   - Archivos (solo producción):
     - `logs/error.log`: Solo errores
     - `logs/combined.log`: Todos los logs

4. **Uso futuro** (cuando esté implementado):
```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  async doSomething() {
    this.logger.log('Operación iniciada');
    this.logger.debug('Detalles de la operación', { data: 'value' });
    this.logger.warn('Advertencia');
    this.logger.error('Error ocurrido', error.stack);
  }
}
```

**Nota**: Los archivos de log se crean automáticamente en la carpeta `logs/` en producción. Asegúrate de que esta carpeta tenga permisos de escritura.

---

## 9. Próximos Pasos

### 9.1 Estado de Implementación por Módulo

#### ✅ Completamente Implementado
- **`src/infra/cache/`**: Sistema de caché Redis completo y funcional

#### 🔄 Parcialmente Implementado
- **`src/infra/logging/`**: 
  - ✅ Configuración de Winston (`logger.config.ts`)
  - ⏳ Servicio de logging (`logger.service.ts`)
  - ⏳ Interceptor de logging (`logger.interceptor.ts`)
  - ⏳ Filter de excepciones globales (`global-exception.filter.ts`)

#### 📦 Dependencias Instaladas, Pendiente Implementación
- **`src/infra/resilience/`**: Dependencia Cockatiel instalada, módulo pendiente

#### 🔄 Preparado para Implementación
- **`src/modules/search/`**: Lógica de búsqueda de vuelos
- **`src/modules/providers/amadeus/`**: Integración con API de Amadeus

### 9.2 Mejoras Futuras Sugeridas

- [x] Implementar logging estructurado (configuración lista, servicio pendiente)
- [ ] Completar implementación del sistema de logging (servicio, interceptor, filter)
- [ ] Implementar patrones de resiliencia con Cockatiel
- [ ] Agregar autenticación/autorización
- [ ] Implementar rate limiting
- [ ] Agregar validación de DTOs con `class-validator` (dependencia instalada)
- [ ] Agregar health checks
- [ ] Documentación con Swagger/OpenAPI
- [ ] Tests unitarios para CacheService
- [ ] Tests unitarios para LoggerService
- [ ] Deshabilitar endpoints de debug en producción

---

## 10. Recursos Adicionales

- [Documentación oficial de NestJS](https://docs.nestjs.com)
- [Documentación de ioredis](https://github.com/redis/ioredis)
- [Documentación de Redis](https://redis.io/docs/)
- [Documentación de Winston](https://github.com/winstonjs/winston)
- [Documentación de nest-winston](https://github.com/gremo/nest-winston)
- [Documentación de Cockatiel](https://github.com/connor4312/cockatiel)
- [Documentación de class-validator](https://github.com/typestack/class-validator)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## Licencia

Este proyecto es de código privado (UNLICENSED).
