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
- Proporcionar una API REST para búsqueda de vuelos con integración completa con Amadeus
- Implementar un sistema de caché eficiente usando Redis con TTL dinámico
- Integrar patrones de resiliencia (Circuit Breaker, Retry, Timeout) para operaciones robustas
- Proporcionar logging estructurado y manejo centralizado de errores
- Ser escalable, mantenible y fácil de extender con múltiples proveedores de vuelos

### 1.3 Estado Actual

**Implementado:**
- ✅ Sistema de caché Redis completo con métodos avanzados (`deleteByPattern`)
- ✅ Endpoints de debug para probar el caché (`/debug/cache/*`)
- ✅ Configuración de Docker Compose
- ✅ Estructura base del proyecto
- ✅ Sistema de logging completo con Winston (`infra/logging`)
  - ✅ LoggerService con niveles (debug, info, warn, error)
  - ✅ LoggingInterceptor para requests/responses
  - ✅ GlobalExceptionFilter para manejo de errores
- ✅ Módulo de resiliencia (`infra/resilience`) - Circuit breaker, retry, timeout
- ✅ **Integración completa con Amadeus** (`modules/providers/amadeus`):
  - ✅ Autenticación OAuth2 con cache de tokens
  - ✅ Cliente HTTP con interceptores y manejo de errores
  - ✅ DTOs de request y response completos
  - ✅ Mappers para normalización de datos
  - ✅ Servicio principal de búsqueda de vuelos
  - ✅ Módulo completo y exportable
- ✅ **Módulo de búsqueda de vuelos** (`modules/search`) - COMPLETO:
  - ✅ Controller con endpoint `/search/flights`
  - ✅ Service con lógica de negocio y cache
  - ✅ DTOs normalizados (request y response)
  - ✅ Mappers para transformación de datos
  - ✅ Interfaz `IFlightProvider` para múltiples proveedores
  - ✅ Validación completa con `class-validator` y `class-transformer`
  - ✅ Soporte para arrays en query params (`includedAirlines`, `excludedAirlines`)
  - ✅ Cache inteligente con TTL dinámico según fecha del vuelo

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
│   │   ├── logging/       # Sistema de logging
│   │   └── resilience/    # Patrones de resiliencia
│   ├── modules/           # Módulos de negocio
│   │   ├── search/        # Lógica de búsqueda 
│   │   └── providers/     # Proveedores externos
│   │       └── amadeus/   # Integración Amadeus 
│   ├── controllers/       # Controladores REST
│   ├── common/            # Utilidades compartidas 
│   ├── config/            # Configuraciones
│   ├── app.module.ts      # Módulo raíz de la aplicación
│   └── main.ts           # Punto de entrada de la aplicación
├── public/                # Frontend estático (HTML, CSS, JS)
│   ├── index.html        # Página principal del frontend
│   ├── styles.css        # Estilos CSS
│   └── script.js         # JavaScript del frontend
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
- `cache/`: Sistema de caché Redis completo con métodos avanzados
- `logging/`: Sistema de logging completo con Winston (LoggerService, LoggingInterceptor, GlobalExceptionFilter)
- `resilience/`: Patrones de resiliencia completos (Circuit Breaker, Retry, Timeout) usando Cockatiel

**Decisión**: Separar infraestructura permite cambiar implementaciones sin afectar la lógica de negocio.

#### `src/modules/` - Módulos de Negocio

**Propósito**: Contiene la lógica de negocio organizada por dominio.

**Subcarpetas**:
- `search/`: Módulo completo de búsqueda de vuelos
  - `search.controller.ts`: Endpoint `/search/flights`
  - `search.service.ts`: Lógica de negocio con cache inteligente
  - `search.module.ts`: Configuración del módulo con inyección de dependencias
  - `dto/`: DTOs normalizados (request, response, flight, segment, price)
  - `mappers/`: Transformación de datos de proveedores a DTOs normalizados
    - `flight.mapper.ts`: Mapea `NormalizedFlightDto[]` → `FlightDto[]`
  - `interfaces/`: `IFlightProvider` para abstracción de proveedores
- `providers/`: Integraciones con proveedores externos
  - `amadeus/`: Integración completa con la API de Amadeus
    - `amadeus.service.ts`: Servicio principal que implementa `IFlightProvider`
    - `amadeus-token.service.ts`: Gestión de tokens OAuth2 con cache
    - `amadeus.client.ts`: Cliente HTTP con interceptores y resiliencia
    - `amadeus.config.ts`: Configuración desde variables de entorno
    - `amadeus.types.ts`: Tipos e interfaces específicas de Amadeus
    - `amadeus.module.ts`: Módulo exportable
    - `dto/`: DTOs específicos de Amadeus (request y response)
    - `mappers/`: Transformación de respuestas de Amadeus a formato normalizado
      - `amadeus-flight-offers.mappers.ts`: Mapea `AmadeusFlightOffersResponseDto` → `NormalizedFlightDto[]`

**Decisión**: Organización por dominio facilita el mantenimiento y la escalabilidad. Separación de mappers permite cambiar proveedores sin afectar la lógica de negocio.

#### `src/controllers/` - Controladores HTTP

**Propósito**: Maneja las peticiones HTTP entrantes y las respuestas.

**Contenido actual**:
- `cache-debug.controller.ts`: Endpoints para probar y debuggear el caché
  - `GET /debug/cache/set` - Guardar valor en cache
  - `GET /debug/cache/get` - Obtener valor del cache
  - `GET /debug/cache/wrap` - Probar patrón cache-aside
  - `GET /debug/cache/stats` - Ver estadísticas (hits/misses)
  - `GET /debug/cache/del` - Eliminar key específica
  - `GET /debug/cache/del-search` - Eliminar búsqueda específica
  - `GET /debug/cache/del-pattern` - Eliminar keys por patrón

**Nota**: Los controladores de módulos están dentro de sus respectivos módulos:
- `modules/search/search.controller.ts`: `GET /search/flights`

**Decisión**: Separar controladores permite tener múltiples interfaces (REST, GraphQL, WebSocket) para la misma lógica.

#### `src/common/` - Utilidades Compartidas

**Propósito**: Funciones, tipos y utilidades compartidas entre módulos.

**Contenido actual**:
- `exceptions/`: Filtros globales de excepciones
  - `global-exception.filter.ts`: Filtro global que captura y formatea todas las excepciones

**Decisión**: Centralizar utilidades compartidas facilita la reutilización y mantiene consistencia.

#### `src/config/` - Configuraciones

**Propósito**: Configuraciones centralizadas de la aplicación.

**Contenido actual**:
- `config.module.ts`: Módulo de configuración de NestJS
- `config.ts`: Servicio centralizado de configuración (`AppConfigService`) que lee todas las variables de entorno

**Decisión**: Centralizar configuración facilita el acceso a variables de entorno y permite validación centralizada.

#### `dist/` - Código Compilado

**Propósito**: Contiene el código JavaScript compilado desde TypeScript.

**Importante**: Esta carpeta se genera automáticamente y **no debe editarse manualmente**. Se regenera cada vez que ejecutas `pnpm run build`.

#### `test/` - Tests

**Propósito**: Contiene los tests end-to-end de la aplicación.

**Estado actual**: 
- Estructura de testing configurada (Jest, Supertest)
- Tests pendientes de implementación

**Nota**: Aunque la estructura de testing está lista, actualmente no hay tests implementados. Se recomienda agregar tests unitarios y e2e para mejorar la calidad del código.

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
    container_name: redis
    ports:
      - "6379:6379"         # Puerto estándar de Redis
    volumes:
      - redis:/data         # Persistencia de datos

  redis_insight:            # Interfaz gráfica para Redis
    image: redis/redisinsight:latest
    container_name: redis_insight
    ports:
      - "5540:5540"         # Puerto web de Redis Insight
    depends_on:
      - redis               # Espera a que Redis esté listo
    restart: always         # Reinicia automáticamente si falla
```

**Decisiones**:
- **Redis 7**: Última versión estable
- **Redis Insight**: Herramienta visual para inspeccionar datos en Redis (disponible en `http://localhost:5540`)
- **Volúmenes**: Persistencia de datos entre reinicios del contenedor
- **Container names**: Facilita identificar contenedores en `docker ps`

### 5.2 Archivos de Código Fuente

#### `src/main.ts` - Punto de Entrada

**Propósito**: Archivo que se ejecuta cuando inicias la aplicación. Es el punto de entrada principal y configura toda la aplicación.

**Funcionalidades implementadas**:

1. **Manejo de Errores Asíncronos**:
   - `unhandledRejection`: Captura promesas rechazadas no manejadas
   - `uncaughtException`: Captura excepciones síncronas no capturadas
   - Ambos registran errores usando `LoggerService` para debugging

2. **Configuración CORS**:
   - Habilita CORS para permitir peticiones desde navegadores
   - Configurado para desarrollo (permite todos los orígenes)
   - Soporta preflight requests (OPTIONS)
   - Cache de preflight por 24 horas

3. **Validación Global**:
   - `ValidationPipe` configurado globalmente
   - Transforma automáticamente tipos (string → number, etc.)
   - Valida DTOs automáticamente en todos los endpoints
   - Formatea errores de validación de forma clara y estructurada
   - Rechaza propiedades no permitidas en los DTOs (seguridad)

4. **Servir Archivos Estáticos**:
   - Configurado para servir archivos desde `public/` (frontend)
   - Los archivos están disponibles en la raíz: `/index.html`, `/styles.css`, `/script.js`
   - Permite acceder al frontend directamente desde `http://localhost:3000/`

5. **Inicialización del Servidor**:
   - Lee el puerto desde `AppConfigService` (no directamente de `process.env`)
   - Inicia el servidor HTTP en el puerto configurado

**Decisiones**:
- **Manejo de errores asíncronos**: Previene crashes silenciosos y facilita debugging
- **CORS habilitado**: Necesario para desarrollo frontend y pruebas desde navegador
- **Validación global**: Asegura que todos los endpoints validen automáticamente
- **Formato de errores personalizado**: Mejor experiencia para consumidores de la API
- **Configuración centralizada**: Usa `AppConfigService` en lugar de `process.env` directamente
- **Archivos estáticos integrados**: Frontend y backend en un solo servidor para simplicidad

#### `src/app.module.ts` - Módulo Raíz

**Propósito**: Define la estructura completa de la aplicación. Es el "corazón" que conecta todos los módulos.

**Módulos importados**:

1. **`ConfigModule.forRoot({ isGlobal: true })`**: 
   - Carga variables de entorno desde `.env`
   - `isGlobal: true` hace que esté disponible en todos los módulos sin importarlo

2. **`AppConfigModule`**: 
   - Módulo que provee `AppConfigService` para acceso centralizado a configuración

3. **`CacheModule`**: 
   - Módulo que provee el cliente de Redis y `CacheService`

4. **`LoggerModule`**: 
   - Módulo que provee `LoggerService`, `LoggingInterceptor` y `GlobalExceptionFilter`
   - Registra automáticamente el interceptor y el filtro globalmente

5. **`ResilienceModule`**: 
   - Módulo que provee `ResilienceService` para aplicar patrones de resiliencia

6. **`AmadeusModule`**: 
   - Módulo que provee la integración con la API de Amadeus
   - Exporta `AmadeusService` que implementa `IFlightProvider`

7. **`SearchModule`**: 
   - Módulo principal que expone el endpoint `/search/flights`
   - Internamente usa `AmadeusModule` para buscar vuelos

**Controladores**:
- `CacheDebugController`: Endpoints de debug del caché (`/debug/cache/*`)

**Providers**:
- `CacheService`: Redundante (ya está en `CacheModule`), puede removerse

**Decisiones**:
- **ConfigModule global**: Evita importarlo en cada módulo
- **Módulos separados**: Cada funcionalidad en su propio módulo facilita mantenimiento
- **LoggerModule global**: Interceptor y filtro se aplican automáticamente a toda la app
- **Separación de responsabilidades**: `SearchModule` orquesta, `AmadeusModule` provee datos

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

**Estado**: ✅ Configuración completa implementada.

#### `logger.module.ts` - Módulo de Logging

**Propósito**: Define el módulo de logging de NestJS.

**Funcionalidades**:
- Provee `LoggerService` como servicio inyectable
- Registra `LoggingInterceptor` globalmente (intercepta todas las requests/responses)
- Registra `GlobalExceptionFilter` globalmente (captura todas las excepciones)

**Estado**: ✅ Completamente implementado y funcional.

#### `logger.service.ts` - Servicio de Logging

**Propósito**: Servicio centralizado de logging que encapsula Winston.

**Características**:
- Métodos: `debug()`, `info()`, `warn()`, `error()`
- Soporte para contexto y metadatos estructurados
- Formato automático según entorno (legible en dev, JSON en prod)

**Estado**: ✅ Completamente implementado.

#### `logger.interceptor.ts` - Interceptor de Logging

**Propósito**: Intercepta todas las peticiones HTTP y registra información de requests y responses.

**Características**:
- Registra método, URL, query params, body, headers
- Registra tiempo de respuesta
- Registra status code y respuesta
- Maneja errores de forma segura

**Estado**: ✅ Completamente implementado y registrado globalmente.

#### `global-exception.filter.ts` - Filtro Global de Excepciones

**Propósito**: Captura todas las excepciones no manejadas y las formatea de forma consistente.

**Características**:
- Formatea errores de validación (400 Bad Request)
- Formatea errores de servidor (500 Internal Server Error)
- Registra errores usando `LoggerService`
- Retorna respuestas JSON estructuradas

**Estado**: ✅ Completamente implementado y registrado globalmente.

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
      keyPrefix: `flightsearch:${process.env.NODE_ENV ?? 'dev'}:`,
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
   - **`keyPrefix: 'flightsearch:${NODE_ENV}:'`**: **Prefijo de claves**
     - Todas las claves empiezan con este prefijo
     - **Por qué**: Evita colisiones entre ambientes (dev, staging, prod)
     - Ejemplo: `flightsearch:dev:user:123` vs `flightsearch:prod:user:123`

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

**Estado actual**: La estructura de testing está configurada (Jest, Supertest, ts-jest), pero actualmente no hay tests implementados.

**Configuración disponible**:
- Jest configurado en `package.json`
- Supertest para tests e2e
- `jest-e2e.json` para configuración de tests end-to-end
- Scripts disponibles: `test`, `test:watch`, `test:cov`, `test:e2e`

**Recomendaciones para implementar tests**:

1. **Tests unitarios** (`.spec.ts` junto a cada archivo):
   - `CacheService`: Probar métodos get, set, delete, wrap
   - `SearchService`: Probar lógica de búsqueda y cache
   - `AmadeusService`: Mockear cliente HTTP y probar transformaciones
   - `ResilienceService`: Probar creación y ejecución de políticas

2. **Tests e2e** (en `test/`):
   - `search.e2e-spec.ts`: Probar endpoint `/search/flights` con diferentes parámetros
   - `cache-debug.e2e-spec.ts`: Probar endpoints de debug del cache
   - Validación de DTOs, manejo de errores, integración con Redis

**Ejemplo de estructura de test unitario**:

```typescript
// cache.service.spec.ts
describe('CacheService', () => {
  let service: CacheService;
  let mockClient: jest.Mocked<CacheClient>;

  beforeEach(async () => {
    // Setup mocks y providers
  });

  it('should get value from cache', async () => {
    // Test implementation
  });
});
```

**Nota**: Los tests son importantes para mantener la calidad del código y facilitar refactorizaciones futuras
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

**⚠️ IMPORTANTE**: Antes de iniciar la aplicación, debes configurar las variables de entorno.

#### Opción 1: Usar el archivo `.env.example` (Recomendado)

1. Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. Edita el archivo `.env` y completa las variables necesarias (especialmente `AMADEUS_API_KEY` y `AMADEUS_API_SECRET`).

#### Opción 2: Crear manualmente el archivo `.env`

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
# ============================================
# Aplicación
# ============================================
NODE_ENV=development         # development | staging | production
PORT=3000                    # Puerto del servidor HTTP (por defecto: 3000)

# ============================================
# Redis
# ============================================
REDIS_HOST=localhost         # Host de Redis (por defecto: localhost)
REDIS_PORT=6379              # Puerto de Redis (por defecto: 6379)
REDIS_PASSWORD=              # Contraseña de Redis (opcional, dejar vacío si no hay password)
REDIS_TTL_SECONDS=3600       # TTL por defecto en segundos (por defecto: 3600 = 1 hora)

# ============================================
# Amadeus API (sandbox por defecto)
# ============================================
# ⚠️ OBLIGATORIO: Obtén tus credenciales en https://developers.amadeus.com/
AMADEUS_API_KEY=your_test_api_key          # Tu API Key de Amadeus (REQUERIDO)
AMADEUS_API_SECRET=your_test_api_secret    # Tu API Secret de Amadeus (REQUERIDO)
AMADEUS_BASE_URL=https://test.api.amadeus.com  # URL base de Amadeus (por defecto: sandbox)
AMADEUS_TOKEN_CACHE_TTL=3300               # TTL del token en cache en segundos (por defecto: 3300 = 55 minutos)

# ============================================
# Resilience (Patrones de Resiliencia)
# ============================================
# Configuración de timeout, retry y circuit breaker
# Si no se especifican, se usan los valores por defecto indicados
RES_TIMEOUT_MS=1000              # Timeout en milisegundos (por defecto: 1000ms = 1 segundo)
RES_RETRY_ATTEMPTS=2             # Número de reintentos (por defecto: 2)
RES_RETRY_BASE_MS=200            # Delay base para retry en ms (por defecto: 200ms)
RES_CB_FAILURE_THRESHOLD=3        # Umbral de fallos para circuit breaker (por defecto: 3)
RES_CB_HALFOPEN_MS=10000         # Tiempo en ms antes de intentar half-open (por defecto: 10000ms = 10s)
RES_CB_SUCCESS_THRESHOLD=1       # Umbral de éxitos para cerrar circuit breaker (por defecto: 1)
```

#### Variables Requeridas vs Opcionales

**🔴 REQUERIDAS** (la aplicación fallará sin ellas):
- `AMADEUS_API_KEY` - Clave de API de Amadeus
- `AMADEUS_API_SECRET` - Secreto de API de Amadeus

**🟡 OPCIONALES** (tienen valores por defecto):
- Todas las demás variables tienen valores por defecto razonables y funcionarán sin configurarlas.

#### Valores por Defecto

Si no configuras una variable, la aplicación usará estos valores:

| Variable | Valor por Defecto | Descripción |
|----------|-------------------|-------------|
| `NODE_ENV` | `development` | Ambiente de ejecución |
| `PORT` | `3000` | Puerto del servidor HTTP |
| `REDIS_HOST` | `localhost` | Host de Redis |
| `REDIS_PORT` | `6379` | Puerto de Redis |
| `REDIS_PASSWORD` | `undefined` (sin password) | Contraseña de Redis |
| `REDIS_TTL_SECONDS` | `3600` (1 hora) | TTL por defecto del cache |
| `AMADEUS_BASE_URL` | `https://test.api.amadeus.com` | URL de sandbox de Amadeus |
| `AMADEUS_TOKEN_CACHE_TTL` | `3300` (55 minutos) | TTL del token en cache |
| `RES_TIMEOUT_MS` | `1000` (1 segundo) | Timeout de operaciones |
| `RES_RETRY_ATTEMPTS` | `2` | Número de reintentos |
| `RES_RETRY_BASE_MS` | `200` | Delay base para retry |
| `RES_CB_FAILURE_THRESHOLD` | `3` | Umbral de fallos para circuit breaker |
| `RES_CB_HALFOPEN_MS` | `10000` (10 segundos) | Tiempo antes de half-open |
| `RES_CB_SUCCESS_THRESHOLD` | `1` | Umbral de éxitos para cerrar circuit breaker |

#### Obtener Credenciales de Amadeus

1. Ve a [https://developers.amadeus.com/](https://developers.amadeus.com/)
2. Crea una cuenta (es gratis)
3. Crea una nueva aplicación en el dashboard
4. Copia tu `API Key` y `API Secret`
5. Pega estos valores en tu archivo `.env`

### 7.2 Docker Compose

Para iniciar Redis localmente:

```bash
docker-compose up -d
```

Esto inicia:
- **Redis** en `localhost:6379`
- **Redis Insight** en `http://localhost:5540` (interfaz gráfica para inspeccionar datos de Redis)

**Verificar que los servicios están corriendo:**
```bash
docker-compose ps
```

**Ver logs de Redis:**
```bash
docker-compose logs redis
```

**Detener los servicios:**
```bash
docker-compose down
```

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

Sigue estos pasos en orden para levantar la aplicación correctamente:

#### Paso 1: Instalar Dependencias

```bash
pnpm install
```

#### Paso 2: Configurar Variables de Entorno

**Opción A: Usar `.env.example` (Recomendado)**
```bash
# Copia el archivo de ejemplo
cp .env.example .env

# Edita .env y completa AMADEUS_API_KEY y AMADEUS_API_SECRET
# Puedes usar cualquier editor de texto
```

**Opción B: Crear `.env` manualmente**

Crea un archivo `.env` en la raíz del proyecto con las variables necesarias (ver sección [7.1 Variables de Entorno](#71-variables-de-entorno)).

**⚠️ IMPORTANTE**: Debes configurar al menos:
- `AMADEUS_API_KEY` - Tu API Key de Amadeus
- `AMADEUS_API_SECRET` - Tu API Secret de Amadeus

Sin estas credenciales, la aplicación **no iniciará** (lanzará un error al intentar crear `AmadeusTokenService`).

#### Paso 3: Iniciar Redis

La aplicación necesita Redis para el sistema de cache. Tienes dos opciones:

**Opción A: Usar Docker Compose (Recomendado para desarrollo)**

```bash
# Inicia Redis y Redis Insight
docker-compose up -d

# Verifica que Redis está corriendo
docker ps
```

Esto iniciará:
- **Redis** en `localhost:6379`
- **Redis Insight** (interfaz gráfica) en `http://localhost:5540`

**Opción B: Redis local instalado**

Si tienes Redis instalado localmente, asegúrate de que esté corriendo:
```bash
# En macOS/Linux
redis-server

# Verifica que está corriendo
redis-cli ping
# Debe responder: PONG
```

#### Paso 4: Iniciar la Aplicación

**Modo Desarrollo (con hot-reload):**
```bash
pnpm run start:dev
```

**Modo Producción:**
```bash
# Compilar primero
pnpm run build

# Ejecutar versión compilada
pnpm run start:prod
```

#### Paso 5: Verificar que Funciona

Una vez iniciada, deberías ver en la consola:
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] AppModule dependencies initialized
[Nest] INFO [InstanceLoader] CacheModule dependencies initialized
[Nest] INFO [InstanceLoader] LoggerModule dependencies initialized
...
[Nest] INFO [NestApplication] Nest application successfully started
```

La aplicación estará disponible en: **`http://localhost:3000`** (o el puerto que configuraste en `PORT`)

#### Acceder al Frontend

El proyecto incluye un frontend básico integrado que se sirve automáticamente desde NestJS:

1. **Abre tu navegador** y ve a: **`http://localhost:3000/`**
2. Verás un formulario de búsqueda de vuelos con:
   - Formulario compacto a la izquierda
   - Área de resultados a la derecha (se llena después de buscar)
   - Validación de fechas (salida >= hoy, regreso > salida)
   - Campos de origen/destino en mayúsculas automáticas
   - Selector de moneda (USD/EUR)
   - Visualización de resultados con emojis de personitas según cantidad de adultos

**Nota**: El frontend es básico y está diseñado solo para probar la funcionalidad del backend. No requiere configuración adicional ni servidor separado.

#### Probar el Endpoint Principal (API)

También puedes probar la API directamente con `curl`:

```bash
# Búsqueda simple de vuelos
curl "http://localhost:3000/search/flights?origin=JFK&destination=LAX&departureDate=2026-06-25&adults=1"
```

Si todo está bien configurado, deberías recibir una respuesta JSON con vuelos.

#### Troubleshooting

**Error: "AMADEUS_API_KEY no está configurada"**
- Verifica que el archivo `.env` existe en la raíz del proyecto
- Verifica que `AMADEUS_API_KEY` y `AMADEUS_API_SECRET` están configuradas
- Reinicia la aplicación después de modificar `.env`

**Error: "Redis connection error"**
- Verifica que Redis está corriendo: `docker ps` o `redis-cli ping`
- Verifica que `REDIS_HOST` y `REDIS_PORT` en `.env` coinciden con tu Redis
- Si usas Docker, verifica: `docker-compose ps`

**Error: "Port 3000 already in use"**
- Cambia el puerto en `.env`: `PORT=3001`
- O detén el proceso que está usando el puerto 3000

### 8.2 Endpoints Disponibles

#### Búsqueda de Vuelos
```bash
# Búsqueda simple
curl "http://localhost:3000/search/flights?origin=JFK&destination=LAX&departureDate=2026-06-25&adults=1"

# Búsqueda con filtros avanzados
curl "http://localhost:3000/search/flights?origin=JFK&destination=LAX&departureDate=2026-06-25&returnDate=2026-07-01&adults=2&children=1&travelClass=ECONOMY&maxResults=20&currency=USD&includedAirlines=AA&includedAirlines=DL"

# Arrays en query params (dos formatos soportados):
# Formato 1: múltiples parámetros
?includedAirlines=AA&includedAirlines=DL
# Formato 2: string separado por comas
?includedAirlines=AA,DL
```

#### Debug del Caché

**Guardar un valor:**
```bash
curl "http://localhost:3000/debug/cache/set?key=test&value=hello"
```

**Obtener un valor:**
```bash
curl "http://localhost:3000/debug/cache/get?key=test"
```

**Probar cache-aside:**
```bash
# Primera llamada: genera nuevo valor
curl "http://localhost:3000/debug/cache/wrap?key=generated"

# Segunda llamada (mismo key): retorna del caché (mismo timestamp)
curl "http://localhost:3000/debug/cache/wrap?key=generated"
```

**Ver estadísticas:**
```bash
curl "http://localhost:3000/debug/cache/stats"
```

**Eliminar key específica:**
```bash
curl "http://localhost:3000/debug/cache/del?key=test"
```

**Eliminar búsqueda específica:**
```bash
curl "http://localhost:3000/debug/cache/del-search?origin=JFK&destination=LAX&departureDate=2026-06-25&adults=1"
```

**Eliminar keys por patrón:**
```bash
# Eliminar todas las búsquedas de vuelos
curl "http://localhost:3000/debug/cache/del-pattern?pattern=search:flights:*"

# Eliminar todas las búsquedas desde JFK
curl "http://localhost:3000/debug/cache/del-pattern?pattern=search:flights:JFK:*"

# Eliminar todo el cache (¡cuidado!)
curl "http://localhost:3000/debug/cache/del-pattern?pattern=*"
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

  async clearAllData() {
    // Eliminar todas las keys que coincidan con un patrón
    const deleted = await this.cache.deleteByPattern('data:*');
    console.log(`Eliminadas ${deleted} keys`);
  }
}
```

### 8.4 Estructura de Claves Recomendada

Usa el método `composeKey` para mantener consistencia:

```typescript
// ✅ Bueno
cache.composeKey('user', userId, 'profile')
// → 'flightsearch:dev:user:123:profile'

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

**Estado actual**: ✅ Sistema completo implementado y funcionando.

El sistema de logging proporciona:

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

4. **Uso**:
```typescript
import { LoggerService } from './infra/logging/logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(MyService.name);
  }

  async doSomething() {
    this.logger.info('Operación iniciada');
    this.logger.debug('Detalles de la operación', undefined, { data: 'value' });
    this.logger.warn('Advertencia');
    this.logger.error('Error ocurrido', error.stack);
  }
}
```

**Nota**: Los archivos de log se crean automáticamente en la carpeta `logs/` en producción. Asegúrate de que esta carpeta tenga permisos de escritura.

#### Simular Entorno de Producción para Generar Logs

Si quieres probar el sistema de logging con archivos sin desplegar a producción, puedes simular el entorno de producción cambiando la variable de entorno:

**Opción 1: Modificar `.env` (Recomendado)**

1. Abre tu archivo `.env`
2. Cambia la línea:
   ```env
   NODE_ENV=production
   ```
3. Reinicia la aplicación:
   ```bash
   pnpm run start:dev
   ```

**Opción 2: Variable de entorno temporal (sin modificar `.env`)**

```bash
# Windows PowerShell
$env:NODE_ENV="production"; pnpm run start:dev

# Windows CMD
set NODE_ENV=production && pnpm run start:dev

# Linux/Mac
NODE_ENV=production pnpm run start:dev
```

**Resultado:**
- Se creará automáticamente la carpeta `logs/` (si no existe)
- Se generarán dos archivos:
  - `logs/error.log`: Solo logs de nivel `error`
  - `logs/combined.log`: Todos los logs (nivel `info` y superior)
- Los logs en archivos estarán en formato JSON estructurado
- Los logs en consola también aparecerán (en formato JSON)

**Para volver a desarrollo:**
Simplemente cambia `NODE_ENV=development` en tu `.env` o reinicia sin la variable de entorno.

<<<<<<< HEAD
=======
=======

>>>>>>> origin/main
### 8.6 Características Avanzadas del Cache

#### Eliminación por Patrón

El método `deleteByPattern()` permite eliminar múltiples keys de forma eficiente usando `SCAN` (no bloquea Redis):

```typescript
// Eliminar todas las búsquedas de vuelos
await cache.deleteByPattern('search:flights:*');

// Eliminar todas las búsquedas desde un aeropuerto específico
await cache.deleteByPattern('search:flights:JFK:*');

// Eliminar todo el cache (¡cuidado!)
await cache.deleteByPattern('*');
```

**Ventajas**:
- Usa `SCAN` en lugar de `KEYS` (no bloquea Redis)
- Procesa en lotes de 100 keys
- Retorna el número de keys eliminadas
- Fail-safe: no lanza excepciones si falla

### 8.7 Búsqueda de Vuelos

#### Parámetros Soportados

El endpoint `/search/flights` soporta los siguientes parámetros:

**Requeridos:**
- `origin`: Código IATA del aeropuerto de origen (3 letras)
- `destination`: Código IATA del aeropuerto de destino (3 letras)
- `departureDate`: Fecha de salida (formato: YYYY-MM-DD)
- `adults`: Número de adultos (1-9)

**Opcionales:**
- `returnDate`: Fecha de retorno (formato: YYYY-MM-DD)
- `children`: Número de niños (0-9)
- `infants`: Número de infantes (0-9)
- `maxResults`: Número máximo de resultados (1-250)
- `travelClass`: Clase de viaje (ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST)
- `currency`: Código de moneda ISO 4217 (3 letras, ej: USD, EUR)
- `includedAirlines`: Array de códigos IATA de aerolíneas a incluir (2 letras cada uno)
- `excludedAirlines`: Array de códigos IATA de aerolíneas a excluir (2 letras cada uno)

#### Arrays en Query Params

Los parámetros `includedAirlines` y `excludedAirlines` soportan dos formatos:

**Formato 1: Múltiples parámetros**
```
?includedAirlines=AA&includedAirlines=DL
```

**Formato 2: String separado por comas**
```
?includedAirlines=AA,DL
```

Ambos formatos se transforman automáticamente a arrays y se normalizan (trim, uppercase).

---

## 9. Características Implementadas

### 9.1 Validación y Transformación

- ✅ **ValidationPipe global**: Configurado en `main.ts` con transformación automática
- ✅ **Validación de DTOs**: Todos los DTOs usan `class-validator` para validación
- ✅ **Transformación automática**: `class-transformer` convierte tipos automáticamente
- ✅ **Arrays en query params**: Soporte completo para `includedAirlines` y `excludedAirlines`
  - Múltiples parámetros: `?includedAirlines=AA&includedAirlines=DL`
  - String separado por comas: `?includedAirlines=AA,DL`

### 9.2 Manejo de Errores

- ✅ **GlobalExceptionFilter**: Captura todas las excepciones no manejadas
- ✅ **Formato estructurado**: Respuestas de error consistentes
- ✅ **Logging robusto**: Errores logueados con contexto completo
- ✅ **Handlers asíncronos**: Manejo de `unhandledRejection` y `uncaughtException`
- ✅ **AmadeusApiError**: Clase personalizada para errores de Amadeus con estructura detallada

### 9.3 Cache Avanzado

- ✅ **TTL dinámico**: TTL variable según fecha del vuelo
- ✅ **Eliminación por patrón**: `deleteByPattern()` usando SCAN
- ✅ **Métricas**: Hits/misses trackeados
- ✅ **Cache-aside**: Patrón implementado en `wrap()`
- ✅ **Fail-safe**: Cache puede fallar sin afectar la aplicación

### 9.4 Resiliencia

- ✅ **Circuit Breaker**: Protección contra fallos en cascada
- ✅ **Retry con backoff**: Reintentos automáticos con espera exponencial
- ✅ **Timeout**: Límites de tiempo por operación
- ✅ **Políticas combinadas**: Circuit Breaker + Retry + Timeout

### 9.5 Logging

- ✅ **Logging estructurado**: Formato JSON en producción, legible en desarrollo
- ✅ **Niveles de log**: debug, info, warn, error
- ✅ **Contexto**: Cada servicio tiene su contexto
- ✅ **Interceptor**: Logging automático de requests/responses
- ✅ **Filtro de excepciones**: Logging de errores con stack traces

---

## 10. Próximos Pasos

### 9.1 Estado de Implementación por Módulo

#### ✅ Completamente Implementado
- **`src/infra/cache/`**: Sistema de caché Redis completo y funcional
  - ✅ Métodos básicos (get, set, delete)
  - ✅ Patrón cache-aside (wrap)
  - ✅ Eliminación por patrón (deleteByPattern) usando SCAN
  - ✅ Métricas (hits/misses)
  - ✅ Type safety mejorado (uso de `unknown` en lugar de `any`)
  - ✅ Type assertions para métodos avanzados de Redis (scanStream, del con múltiples keys)
- **`src/infra/logging/`**: Sistema de logging completo con Winston
  - ✅ LoggerService con niveles y contexto
  - ✅ LoggingInterceptor para requests/responses
  - ✅ GlobalExceptionFilter para errores
- **`src/infra/resilience/`**: Módulo de resiliencia completo
  - ✅ Circuit Breaker con Cockatiel
  - ✅ Retry con Exponential Backoff
  - ✅ Timeout policies
  - ✅ Policy Composer para combinar políticas
- **`src/modules/providers/amadeus/`**: Integración completa con API de Amadeus
  - ✅ Autenticación OAuth2 con cache de tokens
  - ✅ Cliente HTTP con interceptores y manejo de errores
  - ✅ DTOs de request y response completos
  - ✅ Mappers para normalización de datos
  - ✅ Servicio principal de búsqueda
  - ✅ Módulo completo y exportable
  - ✅ Type safety mejorado (uso de `unknown` en lugar de `any` en métodos genéricos)
- **`src/modules/search/`**: Módulo de búsqueda de vuelos COMPLETO
  - ✅ Controller con endpoint `/search/flights`
  - ✅ Service con lógica de negocio y cache inteligente
  - ✅ DTOs normalizados (request, response, flight, segment, price)
  - ✅ Mappers para transformación de datos
  - ✅ Interfaz `IFlightProvider` para abstracción
  - ✅ Validación completa con `class-validator`
  - ✅ Soporte para arrays en query params
  - ✅ Cache con TTL dinámico según fecha del vuelo

### 10.2 Mejoras Futuras Sugeridas

- [x] Implementar logging estructurado completo
- [x] Implementar patrones de resiliencia con Cockatiel
- [x] Integración completa con Amadeus
- [x] Implementar módulo de búsqueda (`modules/search`)
- [x] Validación de DTOs con `class-validator` y `class-transformer`
- [x] Soporte para arrays en query params
- [ ] Agregar autenticación/autorización
- [ ] Implementar rate limiting con `@nestjs/throttler` (dependencia instalada)
- [ ] Agregar health checks con `@nestjs/terminus` (dependencia instalada)
- [ ] Documentación con Swagger/OpenAPI
- [ ] API versioning (`/api/v1`)
- [ ] Deshabilitar endpoints de debug en producción

---

## 11. Recursos Adicionales

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
