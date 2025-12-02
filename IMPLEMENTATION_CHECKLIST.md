# ✅ Checklist de Implementación - Flight Search Service

> Lista detallada y ordenada de tareas para completar el proyecto.  
> Marca cada tarea conforme la vayas completando.

---

## 📊 Estado General

- **Total de tareas**: ~80
- **Completadas**: ~15
- **Pendientes**: ~65

---

## 🎯 FASE 0: Preparación y Configuración Base

### Variables de Entorno
- [ ] Crear archivo `.env` en la raíz del proyecto
- [ ] Configurar variables de Redis:
  - [ ] `REDIS_HOST=localhost`
  - [ ] `REDIS_PORT=6379`
  - [ ] `REDIS_PASSWORD=` (opcional)
  - [ ] `REDIS_TTL_SECONDS=3600`
- [ ] Configurar variables de aplicación:
  - [ ] `PORT=3000`
  - [ ] `NODE_ENV=development`
- [ ] Configurar variables de Amadeus (preparar):
  - [ ] `AMADEUS_API_KEY=`
  - [ ] `AMADEUS_API_SECRET=`
  - [ ] `AMADEUS_BASE_URL=https://test.api.amadeus.com` (test) o `https://api.amadeus.com` (prod)
- [ ] Agregar `.env` a `.gitignore` (verificar que esté)
- [ ] Crear `.env.example` con estructura sin valores sensibles

### Infraestructura Local
- [ ] Verificar que Docker esté instalado
- [ ] Iniciar Redis con `docker-compose up -d`
- [ ] Verificar conexión a Redis (puerto 6379)
- [ ] Acceder a Redis Insight en `http://localhost:8001` (opcional, para debugging)

### Dependencias Adicionales
- [ ] Instalar `@nestjs/throttler` para rate limiting
- [ ] Instalar `@nestjs/terminus` para health checks (opcional pero recomendado)
- [ ] Verificar que todas las dependencias estén instaladas: `pnpm install`

---

## 🔧 FASE 1: Completar Infraestructura Base

### 1.1 Sistema de Logging (Completar implementación)

#### Logger Service
- [ ] Revisar `src/infra/logging/logger.service.ts` (ya existe)
- [ ] Verificar que implemente correctamente `NestLoggerService`
- [ ] Verificar método `setContext()`
- [ ] Verificar método `childLogger()`
- [ ] Verificar métodos: `debug()`, `log()`, `info()`, `warn()`, `error()`
- [ ] Probar logging en diferentes niveles

#### Logger Interceptor
- [ ] Revisar `src/infra/logging/logger.interceptor.ts` (ya existe)
- [ ] Verificar que capture requests HTTP entrantes
- [ ] Verificar que loguee: método, URL, headers relevantes, query params
- [ ] Verificar que capture responses: status code, tiempo de respuesta
- [ ] Agregar logging de errores si ocurren
- [ ] Probar interceptor con requests reales

#### Global Exception Filter
- [ ] Revisar `src/common/exceptions/global-exception.filter.ts` (ya existe)
- [ ] Verificar que capture todas las excepciones no manejadas
- [ ] Verificar formato de respuesta de error (estructurado)
- [ ] Verificar logging de errores con stack trace
- [ ] Verificar mapeo de diferentes tipos de errores:
  - [ ] `HttpException` → status code y mensaje
  - [ ] `ValidationError` → 400 con detalles
  - [ ] Errores desconocidos → 500 con mensaje genérico
- [ ] Probar con diferentes tipos de errores

#### Logger Module
- [ ] Verificar que `LoggerModule` esté marcado como `@Global()`
- [ ] Verificar que exporte `LoggerService`
- [ ] Verificar que registre `APP_INTERCEPTOR` y `APP_FILTER`
- [ ] Verificar que esté importado en `AppModule`

#### Testing de Logging
- [ ] Crear test unitario para `LoggerService`
- [ ] Crear test unitario para `LoggingInterceptor`
- [ ] Crear test unitario para `GlobalExceptionFilter`
- [ ] Verificar que los logs se generen correctamente en desarrollo
- [ ] Verificar formato JSON en modo producción (simular con `NODE_ENV=production`)

---

### 1.2 Módulo de Resiliencia

#### Estructura Base
- [ ] Crear `src/infra/resilience/resilience.module.ts`
- [ ] Crear `src/infra/resilience/resilience.types.ts` (interfaces, tipos)
- [ ] Crear `src/infra/resilience/resilience.config.ts` (configuración)

#### Circuit Breaker Service
- [ ] Crear `src/infra/resilience/circuit-breaker.service.ts`
- [ ] Implementar wrapper con Cockatiel `CircuitBreaker`
- [ ] Configurar thresholds:
  - [ ] Failure threshold: 5 fallos consecutivos
  - [ ] Timeout: 30 segundos antes de HALF_OPEN
  - [ ] Success threshold: 2 éxitos para volver a CLOSED
- [ ] Implementar logging de cambios de estado (CLOSED → OPEN → HALF_OPEN)
- [ ] Implementar método genérico `execute<T>()` que envuelve cualquier función
- [ ] Agregar métricas: número de fallos, estado actual, últimas transiciones

#### Retry Service
- [ ] Crear `src/infra/resilience/retry.service.ts`
- [ ] Implementar wrapper con Cockatiel `RetryPolicy`
- [ ] Configurar estrategia:
  - [ ] Max attempts: 3
  - [ ] Initial delay: 500ms
  - [ ] Max delay: 5 segundos
  - [ ] Multiplier: 2x (exponencial)
- [ ] Implementar condición: solo retry en errores de red, timeouts, 5xx
- [ ] NO retry en 4xx (errores del cliente)
- [ ] Implementar logging de cada intento
- [ ] Implementar método genérico `execute<T>()`

#### Timeout Service
- [ ] Crear `src/infra/resilience/timeout.service.ts`
- [ ] Implementar wrapper con Cockatiel `TimeoutPolicy`
- [ ] Configurar timeouts por tipo de operación:
  - [ ] Amadeus API: 10 segundos
  - [ ] Cache operations: 2 segundos
  - [ ] Default: 5 segundos
- [ ] Implementar logging cuando se excede timeout
- [ ] Implementar método genérico `execute<T>()` con timeout configurable

#### Resilience Service (Orquestador)
- [ ] Crear `src/infra/resilience/resilience.service.ts`
- [ ] Combinar Circuit Breaker + Retry + Timeout
- [ ] Implementar método `executeWithResilience<T>()` que:
  - [ ] Aplica timeout
  - [ ] Aplica retry (si aplica)
  - [ ] Aplica circuit breaker
- [ ] Configurar orden: Timeout → Retry → Circuit Breaker
- [ ] Implementar logging estructurado de cada capa

#### Resilience Module
- [ ] Exportar `ResilienceService` desde `resilience.module.ts`
- [ ] Hacer el módulo `@Global()` para uso en toda la app
- [ ] Importar en `AppModule`

#### Testing de Resiliencia
- [ ] Crear test unitario para `CircuitBreakerService`
  - [ ] Test: estado CLOSED permite llamadas
  - [ ] Test: después de N fallos, estado OPEN rechaza llamadas
  - [ ] Test: después de timeout, estado HALF_OPEN permite prueba
  - [ ] Test: después de éxito en HALF_OPEN, vuelve a CLOSED
- [ ] Crear test unitario para `RetryService`
  - [ ] Test: retry en errores 5xx
  - [ ] Test: NO retry en errores 4xx
  - [ ] Test: backoff exponencial funciona
  - [ ] Test: máximo de intentos se respeta
- [ ] Crear test unitario para `TimeoutService`
  - [ ] Test: operación que excede timeout se cancela
  - [ ] Test: operación rápida no se cancela
- [ ] Crear test de integración para `ResilienceService` completo

---

## 🌐 FASE 2: Integración con Amadeus

### 2.1 Estructura del Módulo Amadeus

#### Módulo Base
- [ ] Crear `src/modules/providers/amadeus/amadeus.module.ts`
- [ ] Crear `src/modules/providers/amadeus/amadeus.config.ts`
- [ ] Configurar variables de entorno en `amadeus.config.ts`:
  - [ ] `AMADEUS_API_KEY`
  - [ ] `AMADEUS_API_SECRET`
  - [ ] `AMADEUS_BASE_URL`
  - [ ] `AMADEUS_TOKEN_CACHE_TTL` (55 minutos)

#### Tipos e Interfaces
- [ ] Crear `src/modules/providers/amadeus/amadeus.types.ts`
- [ ] Definir interface `AmadeusConfig`
- [ ] Definir interface `AmadeusTokenResponse`
- [ ] Definir interface `AmadeusErrorResponse`
- [ ] Definir tipos para requests de búsqueda

---

### 2.2 Autenticación OAuth2

#### Token Service
- [ ] Crear `src/modules/providers/amadeus/amadeus-token.service.ts`
- [ ] Implementar método `getAccessToken()`:
  - [ ] Verificar cache primero (key: `auth:amadeus:token`)
  - [ ] Si existe y es válido, retornar
  - [ ] Si no existe o expiró, hacer request a `/v1/security/oauth2/token`
  - [ ] Guardar token en cache con TTL de 55 minutos
  - [ ] Retornar token
- [ ] Implementar manejo de errores de autenticación
- [ ] Implementar logging de obtención de tokens
- [ ] Integrar con `ResilienceService` (retry, circuit breaker)

#### Testing de Autenticación
- [ ] Crear test unitario para `AmadeusTokenService`
  - [ ] Test: obtiene token de cache si existe
  - [ ] Test: hace request si no hay token en cache
  - [ ] Test: guarda token en cache después de obtenerlo
  - [ ] Test: maneja errores de autenticación

---

### 2.3 Cliente HTTP

#### HTTP Client Service
- [ ] Crear `src/modules/providers/amadeus/amadeus-http.service.ts`
- [ ] Configurar Axios con:
  - [ ] Base URL desde config
  - [ ] Headers por defecto (Content-Type, Accept)
  - [ ] Interceptor para agregar token automáticamente
  - [ ] Interceptor para refrescar token si expira (401)
  - [ ] Interceptor para logging de requests/responses
- [ ] Implementar método genérico `get<T>()`
- [ ] Implementar método genérico `post<T>()`
- [ ] Integrar con `ResilienceService` en cada llamada
- [ ] Implementar manejo de errores específicos de Amadeus:
  - [ ] 400 → Bad Request (no retry)
  - [ ] 401 → Unauthorized (refrescar token, retry)
  - [ ] 429 → Rate Limit (retry con backoff largo)
  - [ ] 500 → Server Error (retry)
  - [ ] 503 → Service Unavailable (retry)

#### Testing de HTTP Client
- [ ] Crear test unitario para `AmadeusHttpService`
  - [ ] Test: agrega token automáticamente
  - [ ] Test: refresca token en 401
  - [ ] Test: maneja rate limit (429)
  - [ ] Test: integración con resilience service

---

### 2.4 DTOs de Amadeus

#### Request DTOs
- [ ] Crear `src/modules/providers/amadeus/dto/amadeus-flight-search-request.dto.ts`
- [ ] Definir estructura según API de Amadeus:
  - [ ] `originLocationCode`
  - [ ] `destinationLocationCode`
  - [ ] `departureDate`
  - [ ] `adults`
  - [ ] `children` (opcional)
  - [ ] `infants` (opcional)
  - [ ] `max` (opcional, número de resultados)
- [ ] Agregar validación con `class-validator`:
  - [ ] `@IsString()`, `@IsNotEmpty()`
  - [ ] `@IsDateString()` para fechas
  - [ ] `@IsInt()`, `@Min()` para números

#### Response DTOs
- [ ] Crear `src/modules/providers/amadeus/dto/amadeus-flight-offer.dto.ts`
- [ ] Definir estructura completa de respuesta de Amadeus:
  - [ ] `data[]` con flight offers
  - [ ] `meta` con información de la búsqueda
  - [ ] `dictionaries` con referencias (aeropuertos, aerolíneas)
- [ ] Mapear todos los campos relevantes:
  - [ ] `id`, `price`, `itineraries`, `travelerPricings`
  - [ ] `segments` dentro de itineraries
  - [ ] `aircraft`, `carrierCode`, `duration`

#### Testing de DTOs
- [ ] Crear test unitario para validación de request DTOs
- [ ] Crear test unitario para parsing de response DTOs

---

### 2.5 Mappers (Amadeus → DTOs Normalizados)

#### Flight Mapper
- [ ] Crear `src/modules/providers/amadeus/mappers/amadeus-flight.mapper.ts`
- [ ] Crear función `mapAmadeusFlightOfferToFlight()`:
  - [ ] Mapear `price.total` (string) → `price.amount` (number)
  - [ ] Mapear `price.currency` → `price.currency`
  - [ ] Simplificar estructura de `itineraries` → `segments[]`
  - [ ] Calcular `duration` total del vuelo
  - [ ] Extraer `airline` codes
  - [ ] Mapear `departure` y `arrival` times
  - [ ] Agregar `provider: 'amadeus'` al resultado
- [ ] Manejar casos edge:
  - [ ] Vuelos con múltiples escalas
  - [ ] Vuelos con diferentes aerolíneas
  - [ ] Precios en diferentes monedas
- [ ] Implementar logging de mapeo (debug level)

#### Testing de Mappers
- [ ] Crear test unitario para `amadeus-flight.mapper.ts`
  - [ ] Test: mapeo básico de un vuelo directo
  - [ ] Test: mapeo de vuelo con escala
  - [ ] Test: conversión de precio string → number
  - [ ] Test: cálculo de duración total
  - [ ] Test: manejo de datos faltantes

---

### 2.6 Servicio Principal de Amadeus

#### Amadeus Service
- [ ] Crear `src/modules/providers/amadeus/amadeus.service.ts`
- [ ] Implementar método `searchFlights()`:
  - [ ] Recibir parámetros de búsqueda normalizados
  - [ ] Convertir a formato de request de Amadeus
  - [ ] Llamar a `AmadeusHttpService.get()` con endpoint `/v2/shopping/flight-offers`
  - [ ] Parsear respuesta a `AmadeusFlightOfferDto[]`
  - [ ] Mapear cada resultado a DTO normalizado
  - [ ] Retornar array de vuelos normalizados
- [ ] Integrar con `ResilienceService`
- [ ] Integrar con `CacheService` (opcional aquí, se hará en SearchService)
- [ ] Implementar logging estructurado

#### Testing de Amadeus Service
- [ ] Crear test unitario para `AmadeusService`
  - [ ] Mock de `AmadeusHttpService`
  - [ ] Mock de `AmadeusTokenService`
  - [ ] Test: búsqueda exitosa
  - [ ] Test: manejo de errores
  - [ ] Test: integración con resilience
- [ ] Crear test de integración (opcional, requiere credenciales reales):
  - [ ] Test con Amadeus test API
  - [ ] Verificar autenticación
  - [ ] Verificar búsqueda real

#### Exportar desde Módulo
- [ ] Exportar `AmadeusService` desde `amadeus.module.ts`
- [ ] Importar `AmadeusModule` en `AppModule` (o en `SearchModule`)

---

## 🔍 FASE 3: Módulo de Búsqueda

### 3.1 Estructura del Módulo Search

#### Módulo Base
- [ ] Crear `src/modules/search/search.module.ts`
- [ ] Importar `AmadeusModule` (o inyectar `AmadeusService`)
- [ ] Importar `CacheModule`
- [ ] Importar `ResilienceModule` (si no es global)

---

### 3.2 DTOs Normalizados

#### Request DTO
- [ ] Crear `src/modules/search/dto/search-flights-request.dto.ts`
- [ ] Definir estructura normalizada:
  - [ ] `origin`: string (código IATA)
  - [ ] `destination`: string (código IATA)
  - [ ] `departureDate`: string (ISO date)
  - [ ] `returnDate?`: string (opcional, para ida y vuelta)
  - [ ] `adults`: number
  - [ ] `children?`: number
  - [ ] `infants?`: number
  - [ ] `maxResults?`: number
- [ ] Agregar validación con `class-validator`:
  - [ ] `@IsString()`, `@Length(3, 3)` para códigos IATA
  - [ ] `@IsDateString()` para fechas
  - [ ] `@IsInt()`, `@Min(1)` para pasajeros
  - [ ] `@IsOptional()` para campos opcionales

#### Response DTO
- [ ] Crear `src/modules/search/dto/search-flights-response.dto.ts`
- [ ] Crear `src/modules/search/dto/flight.dto.ts` (DTO normalizado de vuelo)
- [ ] Definir estructura:
  - [ ] `id`: string
  - [ ] `price`: `{ amount: number, currency: string }`
  - [ ] `segments`: `SegmentDto[]`
  - [ ] `duration`: number (minutos)
  - [ ] `airlines`: string[]
  - [ ] `provider`: 'amadeus' | 'skyscanner' (preparar para futuro)
- [ ] Crear `src/modules/search/dto/segment.dto.ts`:
  - [ ] `departure`: `{ airport: string, time: string }`
  - [ ] `arrival`: `{ airport: string, time: string }`
  - [ ] `duration`: number
  - [ ] `airline`: string
  - [ ] `flightNumber`: string

#### Testing de DTOs
- [ ] Crear test unitario para validación de `SearchFlightsRequestDto`
- [ ] Crear test unitario para estructura de `FlightDto`

---

### 3.3 Interfaces de Proveedores

#### Flight Provider Interface
- [ ] Crear `src/modules/search/interfaces/flight-provider.interface.ts`
- [ ] Definir interface `IFlightProvider`:
  - [ ] `searchFlights(params: SearchParams): Promise<FlightDto[]>`
- [ ] Esto permite agregar múltiples proveedores en el futuro
- [ ] `AmadeusService` implementará esta interface

---

### 3.4 Servicio de Búsqueda

#### Search Service
- [ ] Crear `src/modules/search/search.service.ts`
- [ ] Inyectar dependencias:
  - [ ] `AmadeusService` (o `IFlightProvider[]` para múltiples)
  - [ ] `CacheService`
  - [ ] `ResilienceService` (si no es global)
  - [ ] `LoggerService`
- [ ] Implementar método `searchFlights()`:
  - [ ] Recibir `SearchFlightsRequestDto`
  - [ ] Generar cache key: `search:flights:{origin}:{destination}:{date}:{passengers}`
  - [ ] Verificar cache con `CacheService.wrap()`
  - [ ] Si no está en cache:
    - [ ] Llamar a `AmadeusService.searchFlights()`
    - [ ] Guardar resultado en cache con TTL variable:
      - [ ] Búsquedas futuras (>7 días): 24 horas
      - [ ] Búsquedas próximas (1-7 días): 6 horas
      - [ ] Búsquedas hoy: 1 hora
  - [ ] Retornar `SearchFlightsResponseDto`
- [ ] Implementar cálculo de TTL dinámico según fecha de vuelo
- [ ] Implementar logging estructurado:
  - [ ] Log de búsqueda iniciada
  - [ ] Log de cache hit/miss
  - [ ] Log de llamada a proveedor
  - [ ] Log de resultados encontrados

#### Testing de Search Service
- [ ] Crear test unitario para `SearchService`
  - [ ] Mock de `AmadeusService`
  - [ ] Mock de `CacheService`
  - [ ] Test: retorna desde cache si existe
  - [ ] Test: llama a proveedor si no hay cache
  - [ ] Test: guarda resultado en cache
  - [ ] Test: TTL dinámico según fecha
  - [ ] Test: manejo de errores

---

### 3.5 Controller de Búsqueda

#### Search Controller
- [ ] Crear `src/modules/search/search.controller.ts`
- [ ] Definir ruta base: `@Controller('search')` (se versionará después)
- [ ] Implementar endpoint `GET /search/flights`:
  - [ ] Recibir query parameters
  - [ ] Validar con `SearchFlightsRequestDto` usando `@Query()` y `class-validator`
  - [ ] Llamar a `SearchService.searchFlights()`
  - [ ] Retornar `SearchFlightsResponseDto`
  - [ ] Manejar errores con excepciones HTTP apropiadas
- [ ] Agregar decoradores de documentación (Swagger, opcional):
  - [ ] `@ApiOperation()`
  - [ ] `@ApiResponse()`
  - [ ] `@ApiQuery()`
- [ ] Implementar logging de requests (ya cubierto por interceptor)

#### Testing de Controller
- [ ] Crear test E2E para `SearchController`
  - [ ] Test: búsqueda exitosa
  - [ ] Test: validación de parámetros requeridos
  - [ ] Test: validación de formato de fechas
  - [ ] Test: validación de códigos IATA
  - [ ] Test: manejo de errores 400, 500

---

## 🚦 FASE 4: Rate Limiting

### 4.1 Configuración de Throttler

#### Instalación y Configuración
- [ ] Instalar `@nestjs/throttler` y `@nestjs/throttler-storage-redis`
- [ ] Crear `src/config/throttler.config.ts`
- [ ] Configurar límites:
  - [ ] Global: 100 requests/minuto por IP
  - [ ] Endpoint `/search`: 20 requests/minuto por IP
- [ ] Configurar storage en Redis (usar `ioredis` existente)
- [ ] Configurar mensajes de error personalizados

#### Throttler Module
- [ ] Importar `ThrottlerModule` en `AppModule`
- [ ] Configurar como global o por módulo
- [ ] Agregar `@Throttle()` decorator en `SearchController` si es necesario

#### Testing de Rate Limiting
- [ ] Crear test E2E para rate limiting
  - [ ] Test: permite requests dentro del límite
  - [ ] Test: rechaza requests que exceden límite (429)
  - [ ] Test: headers `X-RateLimit-*` están presentes

---

### 4.2 Rate Limiting para Amadeus

#### Amadeus Rate Limiter
- [ ] Crear `src/modules/providers/amadeus/amadeus-rate-limiter.service.ts`
- [ ] Implementar token bucket o sliding window:
  - [ ] 10 tokens por minuto (según límite de Amadeus free tier)
  - [ ] Recarga automática cada minuto
- [ ] Integrar con `AmadeusHttpService`:
  - [ ] Antes de cada request, verificar tokens disponibles
  - [ ] Si no hay tokens, esperar o rechazar
  - [ ] Después de request exitoso, consumir token
  - [ ] Si recibe 429, esperar tiempo adicional
- [ ] Implementar logging de rate limiting

#### Testing de Amadeus Rate Limiter
- [ ] Crear test unitario para `AmadeusRateLimiterService`
  - [ ] Test: consume tokens correctamente
  - [ ] Test: rechaza cuando no hay tokens
  - [ ] Test: recarga tokens después de 1 minuto
  - [ ] Test: maneja 429 de Amadeus

---

## 🔢 FASE 5: API Versioning

### 5.1 Configuración de Versioning

#### Setup en main.ts
- [ ] Modificar `src/main.ts`
- [ ] Agregar `app.setGlobalPrefix('api')`
- [ ] Configurar versioning:
  - [ ] `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`
- [ ] Esto hará que todas las rutas tengan prefijo `/api/v1`

#### Actualizar Controllers
- [ ] Modificar `SearchController`:
  - [ ] Agregar `@Version('1')` decorator
  - [ ] Ruta final será: `/api/v1/search/flights`
- [ ] Actualizar otros controllers si existen

#### Testing de Versioning
- [ ] Crear test E2E para versioning
  - [ ] Test: `/api/v1/search/flights` funciona
  - [ ] Test: `/api/v2/search/flights` retorna 404 (si no existe v2)
  - [ ] Test: `/search/flights` (sin versión) retorna 404 o redirige

---

## 🏥 FASE 6: Health Checks

### 6.1 Health Check Básico

#### Health Controller
- [ ] Instalar `@nestjs/terminus` (opcional pero recomendado)
- [ ] Crear `src/api/v1/health/health.controller.ts`
- [ ] Implementar endpoint `GET /api/v1/health`:
  - [ ] Retornar `{ status: 'ok', timestamp: ISO string }`
- [ ] Implementar endpoint `GET /api/v1/health/detailed`:
  - [ ] Verificar Redis: conexión activa, latencia
  - [ ] Verificar Amadeus: token válido (opcional, puede ser lento)
  - [ ] Verificar Circuit Breaker: estado (CLOSED/OPEN)
  - [ ] Retornar objeto con estado de cada componente

#### Health Checks con Terminus (Opcional)
- [ ] Si usas `@nestjs/terminus`:
  - [ ] Configurar `HealthCheckService`
  - [ ] Agregar `HttpHealthIndicator` para Amadeus
  - [ ] Agregar `RedisHealthIndicator` para Redis
  - [ ] Implementar checks personalizados para Circuit Breaker

#### Testing de Health Checks
- [ ] Crear test E2E para health checks
  - [ ] Test: `/api/v1/health` retorna 200
  - [ ] Test: `/api/v1/health/detailed` retorna estado de componentes
  - [ ] Test: health check falla si Redis está desconectado

---

## 🧪 FASE 7: Testing Completo

### 7.1 Tests Unitarios Pendientes

#### Cache Service
- [ ] Test: `composeKey()` genera keys correctas
- [ ] Test: `get()` retorna null si no existe
- [ ] Test: `get()` parsea JSON correctamente
- [ ] Test: `set()` guarda valores con TTL
- [ ] Test: `wrap()` implementa cache-aside correctamente
- [ ] Test: `getStats()` retorna métricas correctas

#### Resilience Services
- [ ] Ya listados en Fase 1.2

#### Amadeus Services
- [ ] Ya listados en Fase 2

#### Search Service
- [ ] Ya listado en Fase 3.4

### 7.2 Tests de Integración

#### Flujo Completo de Búsqueda
- [ ] Crear `test/integration/search.e2e-spec.ts`
- [ ] Test: búsqueda completa con Redis real
- [ ] Test: cache funciona correctamente
- [ ] Test: resilience funciona con fallos simulados
- [ ] Test: rate limiting funciona

#### Integración con Amadeus (Opcional)
- [ ] Test con credenciales de test de Amadeus
- [ ] Verificar autenticación
- [ ] Verificar búsqueda real
- [ ] Verificar manejo de errores reales

### 7.3 Cobertura de Tests

#### Verificar Cobertura
- [ ] Ejecutar `pnpm run test:cov`
- [ ] Verificar cobertura > 70% en servicios críticos
- [ ] Identificar áreas sin cobertura
- [ ] Agregar tests faltantes

---

## 📝 FASE 8: Documentación y Mejoras Finales

### 8.1 Documentación de API

#### Swagger/OpenAPI (Opcional)
- [ ] Instalar `@nestjs/swagger`
- [ ] Configurar Swagger en `main.ts`
- [ ] Agregar decoradores `@ApiTags()`, `@ApiOperation()`, etc.
- [ ] Acceder a `/api/docs` para ver documentación interactiva

### 8.2 Variables de Entorno

#### Documentar Variables
- [ ] Crear `.env.example` completo
- [ ] Documentar cada variable en `ARCHITECTURE_DESIGN.md` o README
- [ ] Agregar valores por defecto donde aplique

### 8.3 Scripts y Comandos

#### Verificar Scripts
- [ ] Verificar que todos los scripts en `package.json` funcionen:
  - [ ] `start:dev`
  - [ ] `start:prod`
  - [ ] `build`
  - [ ] `test`
  - [ ] `test:cov`
  - [ ] `test:e2e`
  - [ ] `lint`
  - [ ] `format`

### 8.4 Seguridad

#### Endpoints de Debug
- [ ] Deshabilitar `CacheDebugController` en producción
- [ ] Agregar guard de autenticación o condición `if (NODE_ENV !== 'production')`
- [ ] O eliminar completamente si no se necesita

#### Validación de Input
- [ ] Verificar que todos los DTOs tengan validación
- [ ] Verificar que se usen `ValidationPipe` globalmente
- [ ] Probar con inputs maliciosos (SQL injection, XSS, etc.)

### 8.5 Optimizaciones

#### Performance
- [ ] Revisar queries a Redis (optimizar si es necesario)
- [ ] Revisar llamadas a Amadeus (minimizar si es posible)
- [ ] Agregar índices o optimizaciones si aplica

#### Logging
- [ ] Verificar que no se loguee información sensible
- [ ] Verificar niveles de log apropiados (no debug en producción)
- [ ] Verificar rotación de logs si se usan archivos

---

## 🎯 FASE 9: Preparación para Producción

### 9.1 Configuración de Producción

#### Variables de Entorno
- [ ] Configurar `NODE_ENV=production`
- [ ] Configurar credenciales de producción de Amadeus
- [ ] Configurar Redis de producción
- [ ] Configurar puerto de producción

#### Build
- [ ] Verificar que `pnpm run build` funcione sin errores
- [ ] Verificar que `dist/` contenga todos los archivos necesarios
- [ ] Probar `pnpm run start:prod` localmente

### 9.2 Monitoreo y Observabilidad

#### Logging en Producción
- [ ] Verificar formato JSON en producción
- [ ] Configurar agregación de logs (ELK, CloudWatch, etc.) si aplica
- [ ] Verificar que los logs no contengan información sensible

#### Métricas
- [ ] Verificar que `CacheService.getStats()` esté accesible
- [ ] Considerar exponer métricas en endpoint `/metrics` (Prometheus, opcional)
- [ ] Verificar health checks funcionan correctamente

### 9.3 Deployment

#### Docker (Opcional)
- [ ] Crear `Dockerfile` si planeas usar Docker
- [ ] Crear `docker-compose.prod.yml` si es necesario
- [ ] Probar build de imagen Docker

#### CI/CD (Opcional)
- [ ] Configurar pipeline de CI (GitHub Actions, GitLab CI, etc.)
- [ ] Agregar steps: lint, test, build
- [ ] Configurar deployment automático si aplica

---

## ✅ Checklist Final

### Verificación General
- [ ] Todos los tests pasan: `pnpm run test`
- [ ] Tests E2E pasan: `pnpm run test:e2e`
- [ ] Linter no tiene errores: `pnpm run lint`
- [ ] Build funciona: `pnpm run build`
- [ ] Aplicación inicia correctamente: `pnpm run start:dev`
- [ ] Health checks responden correctamente
- [ ] Búsqueda de vuelos funciona end-to-end
- [ ] Cache funciona correctamente
- [ ] Rate limiting funciona correctamente
- [ ] Resilience (circuit breaker, retry) funciona correctamente

### Documentación
- [ ] `ARCHITECTURE_DESIGN.md` está completo
- [ ] `IMPLEMENTATION_CHECKLIST.md` está actualizado
- [ ] `README.md` tiene instrucciones de uso
- [ ] `.env.example` está completo
- [ ] Comentarios en código son claros (donde sea necesario)

### Código
- [ ] No hay `console.log` en código de producción (usar logger)
- [ ] No hay código comentado innecesario
- [ ] No hay variables hardcodeadas (todo en .env)
- [ ] Manejo de errores es consistente
- [ ] Logging es estructurado y útil

---

## 📊 Progreso

**Última actualización**: [Fecha]  
**Tareas completadas**: [X] / [Total]  
**Porcentaje**: [X]%

---

## 📌 Notas

- Marca cada tarea con `[x]` cuando la completes
- Si una tarea requiere más pasos, créalos como subtareas
- Si encuentras dependencias entre tareas, ajusta el orden
- Revisa este checklist periódicamente para actualizar el progreso

---

**¡Éxito con la implementación! 🚀**

