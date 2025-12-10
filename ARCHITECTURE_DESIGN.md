# 🏗️ Flight Search Service - Diseño Arquitectónico

> Documento de diseño conceptual, arquitectura y decisiones técnicas fundamentadas.  
> **Sin código** — Solo conceptos, estructura, patrones y recursos oficiales.

---

## 📋 Índice

1. [Arquitectura General](#arquitectura-general)
2. [Estructura de Módulos](#estructura-de-módulos)
3. [Módulo de Resiliencia](#módulo-de-resiliencia)
4. [Integración con Amadeus](#integración-con-amadeus)
5. [Estrategia de Caching](#estrategia-de-caching)
6. [Rate Limiting](#rate-limiting)
7. [Normalización de DTOs](#normalización-de-dtos)
8. [API Versioning](#api-versioning)
9. [Health Checks](#health-checks)
10. [Testing Strategy](#testing-strategy)
11. [Consideraciones de Costos y Límites](#consideraciones-de-costos-y-límites)
12. [Recursos Oficiales](#recursos-oficiales)

---

## 🏛️ Arquitectura General

### Principios de Diseño

- **Modular por Feature (NestJS)**: Cada feature es un módulo autocontenido
- **Separación de Responsabilidades**: Infraestructura separada de lógica de negocio
- **Fail-Safe**: El sistema debe degradarse gracefully, no fallar completamente
- **Observabilidad**: Logging estructurado y métricas en cada capa crítica

### Capas del Sistema

```
┌─────────────────────────────────────────┐
│         API Layer (Controllers)         │  ← Endpoints REST, validación, versioning
├─────────────────────────────────────────┤
│      Application Layer (Services)       │  ← Lógica de negocio, orquestación
├─────────────────────────────────────────┤
│      Domain Layer (DTOs, Interfaces)    │  ← Modelos de dominio, contratos
├─────────────────────────────────────────┤
│   Infrastructure Layer (Adapters)       │  ← Amadeus client, Redis, HTTP clients
└─────────────────────────────────────────┘
```

**Flujo de una búsqueda:**
```
Controller → Service → Adapter (Amadeus) → External API
                ↓
            Cache Layer (Redis)
                ↓
         Resilience Layer (Circuit Breaker, Retry)
```

---

## 📦 Estructura de Módulos

### Organización Propuesta

```
src/
├── infra/                          # Infraestructura compartida
│   ├── cache/                      # ✅ Ya implementado
│   ├── logging/                    # ✅ Ya implementado
│   └── resilience/                 # ⚠️ Por diseñar
│       ├── resilience.module.ts
│       ├── circuit-breaker.service.ts
│       ├── retry.service.ts
│       ├── timeout.service.ts
│       └── resilience.types.ts
│
├── modules/
│   ├── search/                     # ✅ Módulo principal de búsqueda (COMPLETO)
│   │   ├── search.module.ts
│   │   ├── search.controller.ts
│   │   ├── search.service.ts
│   │   ├── dto/
│   │   │   ├── search-flights-request.dto.ts
│   │   │   ├── search-flights-response.dto.ts
│   │   │   ├── flight.dto.ts
│   │   │   ├── segment.dto.ts
│   │   │   └── price.dto.ts
│   │   ├── mappers/
│   │   │   └── flight.mapper.ts
│   │   └── interfaces/
│   │       └── flight-provider.interface.ts
│   │
│   └── providers/
│       └── amadeus/                # ✅ Adapter de Amadeus (COMPLETO)
│           ├── amadeus.module.ts
│           ├── amadeus.service.ts
│           ├── amadeus-token.service.ts
│           ├── amadeus.client.ts
│           ├── amadeus.config.ts
│           ├── amadeus.types.ts
│           ├── dto/
│           │   ├── amadeus-flight-offers-req.dto.ts
│           │   └── amadeus-flight-offers-res.dto.ts
│           └── mappers/
│               └── amadeus-flight-offers.mappers.ts
│
├── common/                         # Utilidades compartidas
│   └── exceptions/
│       └── global-exception.filter.ts  # ✅ Implementado
├── controllers/                    # Controladores compartidos
│   └── cache-debug.controller.ts  # ✅ Endpoints de debug de cache
│
└── config/                         # Configuración centralizada
    └── app.config.ts
```

### Responsabilidades por Módulo

#### `modules/search/`
- **Controller**: Recibe requests HTTP, valida DTOs, devuelve respuestas
- **Service**: Orquesta la búsqueda, decide si usar cache, llama al provider
- **DTOs**: Modelos normalizados independientes de proveedores externos

#### `modules/providers/amadeus/`
- **Service**: Cliente HTTP para Amadeus, maneja autenticación OAuth2
- **Mappers**: Transforma respuestas de Amadeus → DTOs normalizados
- **Config**: Credenciales, URLs base, timeouts

#### `infra/resilience/`
- **Circuit Breaker**: Protege contra fallos en cascada
- **Retry**: Reintentos con backoff exponencial
- **Timeout**: Límites de tiempo por operación

---

## 🔄 Módulo de Resiliencia

### Concepto General

La resiliencia permite que el sistema **siga funcionando** (aunque degradado) cuando componentes externos fallan.

### Componentes a Implementar

#### 1. Circuit Breaker (Cockatiel)

**¿Qué es?**
Patrón que "abre" el circuito cuando hay demasiados fallos, evitando llamadas inútiles y dando tiempo a que el servicio externo se recupere.

**Estados:**
- **CLOSED**: Normal, las llamadas pasan
- **OPEN**: Demasiados fallos, rechaza llamadas inmediatamente
- **HALF_OPEN**: Estado de prueba, permite algunas llamadas para ver si se recuperó

**Configuración sugerida:**
- **Failure Threshold**: 5 fallos consecutivos
- **Timeout**: 30 segundos antes de intentar HALF_OPEN
- **Success Threshold**: 2 éxitos para volver a CLOSED

**Recursos:**
- Cockatiel Docs: https://github.com/connor4312/cockatiel
- Martin Fowler: https://martinfowler.com/bliki/CircuitBreaker.html

#### 2. Retry con Exponential Backoff

**¿Qué es?**
Reintenta operaciones fallidas, pero espera cada vez más tiempo entre intentos.

**Estrategia sugerida:**
- **Max Attempts**: 3 intentos
- **Initial Delay**: 500ms
- **Max Delay**: 5 segundos
- **Multiplier**: 2x (exponencial)
- **Solo retry en**: Errores de red, timeouts, 5xx (NO en 4xx)

**Ejemplo de delays:**
```
Intento 1: falla → espera 500ms
Intento 2: falla → espera 1000ms
Intento 3: falla → espera 2000ms
Intento 4: falla → lanza error
```

**Recursos:**
- Microsoft Patterns: https://learn.microsoft.com/en-us/azure/architecture/patterns/retry

#### 3. Timeout

**¿Qué es?**
Límite máximo de tiempo para una operación. Si se excede, se cancela.

**Configuración sugerida:**
- **Amadeus API Call**: 10 segundos
- **Cache Operations**: 2 segundos
- **Total Request Timeout**: 15 segundos

**Recursos:**
- Cockatiel Timeout: https://github.com/connor4312/cockatiel#timeout

### Integración con Amadeus

**Flujo con resiliencia:**
```
1. Timeout wrapper (10s máximo)
2. Retry wrapper (3 intentos, backoff)
3. Circuit Breaker wrapper (protección global)
4. Llamada HTTP a Amadeus
```

**Si falla:**
- Circuit Breaker registra el fallo
- Retry intenta nuevamente (si aplica)
- Si Circuit Breaker está OPEN, rechaza inmediatamente
- Si todos los intentos fallan, retorna error controlado

---

## 🌐 Integración con Amadeus

### Autenticación OAuth2

**Flujo:**
1. Obtener `access_token` con `client_id` y `client_secret`
2. Token expira (típicamente 1 hora)
3. Cachear token en Redis (TTL: 55 minutos, menos que expiración real)
4. Reutilizar token hasta que expire

**Endpoints clave:**
- Token: `POST /v1/security/oauth2/token`
- Flight Offers: `GET /v2/shopping/flight-offers`

**Recursos:**
- Amadeus Self-Service: https://developers.amadeus.com/self-service
- Flight APIs: https://developers.amadeus.com/self-service/category/air

### Estructura del Adapter

**Responsabilidades:**
1. **Autenticación**: Gestionar OAuth2, refrescar tokens
2. **HTTP Client**: Llamadas a Amadeus con Axios
3. **Mapeo**: Transformar respuestas de Amadeus → DTOs internos
4. **Manejo de Errores**: Mapear errores de Amadeus a errores internos

**Errores comunes de Amadeus:**
- `400`: Request inválido (no retry)
- `401`: Token expirado (refrescar token, retry)
- `429`: Rate limit excedido (retry con backoff largo)
- `500`: Error del servidor (retry)
- `503`: Servicio no disponible (retry)

### Normalización de Respuestas

**Amadeus devuelve:**
```json
{
  "data": [
    {
      "id": "...",
      "price": { "total": "500.00", "currency": "EUR" },
      "itineraries": [...]
    }
  ]
}
```

**Tu DTO normalizado:**
```typescript
// Concepto, no código
interface Flight {
  id: string
  price: { amount: number, currency: string }
  segments: Segment[]
  duration: number
  provider: 'amadeus'
}
```

**Ventaja:** Si mañana agregas Skyscanner, solo cambias el mapper, no el resto del sistema.

---

## 💾 Estrategia de Caching

### ¿Qué Cachear?

#### ✅ Cachear:
1. **Tokens de autenticación** (OAuth2)
   - TTL: 55 minutos (menos que expiración real)
   - Key: `auth:amadeus:token`

2. **Búsquedas de vuelos**
   - TTL variable según tipo:
     - Búsquedas futuras (>7 días): 24 horas
     - Búsquedas próximas (1-7 días): 6 horas
     - Búsquedas hoy: 1 hora
   - Key: `search:flights:{origin}:{destination}:{date}:{passengers}`

3. **Datos estáticos** (aeropuertos, ciudades)
   - TTL: 7 días
   - Key: `reference:airports` o `reference:cities`

#### ❌ NO Cachear:
- Búsquedas con fecha de hoy (muy dinámicas)
- Respuestas de error (4xx, 5xx)
- Datos sensibles (aunque no aplica aquí)

### Estrategia de Keys

**Patrón recomendado:**
```
{namespace}:{resource}:{identifier}:{params}
```

**Ejemplos:**
- `search:flights:JFK:LAX:2024-12-25:2`
- `auth:amadeus:token`
- `reference:airports`

**Ventajas:**
- Fácil de invalidar por namespace
- Evita colisiones
- Permite búsquedas con wildcards (`KEYS search:flights:*`)

### Invalidación

**Estrategias:**
1. **TTL automático**: La mayoría de casos
2. **Invalidación manual**: Solo si necesitas forzar refresh
3. **Cache warming**: Pre-cargar búsquedas populares (opcional)

### Métricas de Cache

**Ya implementado en `CacheService`:**
- `hits`: Número de aciertos
- `misses`: Número de fallos
- `getStats()`: Retorna métricas actuales

**Métodos avanzados:**
- `deleteByPattern(pattern)`: Elimina múltiples keys usando SCAN (no bloquea Redis)
- `composeKey(...parts)`: Construye keys consistentes

**Ratio objetivo:**
- Hit rate > 70%: Cache efectivo
- Hit rate < 50%: Revisar TTLs o estrategia

**TTL dinámico implementado:**
- Búsquedas futuras (>7 días): 24 horas
- Búsquedas próximas (1-7 días): 6 horas
- Búsquedas hoy: 1 hora

---

## 🚦 Rate Limiting

### Dos Niveles de Rate Limiting

#### 1. Rate Limiting de Tu API (Proteger tu servicio)

**Objetivo:** Evitar abusos, proteger recursos.

**Configuración sugerida:**
- **Global**: 100 requests/minuto por IP
- **Por endpoint**: 20 requests/minuto por IP en `/search`
- **Burst**: Permitir 5 requests rápidas, luego throttling

**Implementación:**
- `@nestjs/throttler` con Redis como storage
- Headers de respuesta: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

**Recursos:**
- NestJS Throttler: https://docs.nestjs.com/security/rate-limiting

#### 2. Rate Limiting de Amadeus (Respetar límites externos)

**Objetivo:** No exceder los límites de Amadeus (evitar 429).

**Estrategia:**
- **Queue**: Cola de requests pendientes
- **Token Bucket**: Permitir N requests por ventana de tiempo
- **Backoff automático**: Si recibes 429, esperar más tiempo

**Configuración sugerida:**
- **Free tier Amadeus**: ~10 requests/minuto
- **Implementar**: Token bucket con 10 tokens, recarga cada minuto

**Recursos:**
- Amadeus Rate Limits: https://developers.amadeus.com/get-started/rate-limits-101

### Integración

**Flujo:**
```
Request → Rate Limiter (tu API) → Service → Amadeus Rate Limiter → Amadeus API
```

**Si se excede:**
- Tu API: Retorna `429 Too Many Requests`
- Amadeus: Retry con backoff largo (ej: 60 segundos)

---

## 📐 Normalización de DTOs

### Arquitectura de DTOs

**Tres capas:**

1. **Request DTOs** (lo que recibe tu API)
   - `SearchFlightsRequestDto`
   - Validación con `class-validator`

2. **Domain DTOs** (modelo interno normalizado)
   - `FlightDto`
   - `SegmentDto`
   - `PriceDto`
   - Independiente de proveedores

3. **Provider DTOs** (lo que devuelve Amadeus)
   - `AmadeusFlightOfferDto`
   - Solo para mapeo

### Mapeo

**Flujo:**
```
Amadeus Response → AmadeusFlightOfferDto → Mapper → FlightDto → Response
```

**Ventajas:**
- Cambios en Amadeus solo afectan el mapper
- Fácil agregar nuevos proveedores
- Testing más simple (mockeas el mapper)

### Ejemplo Conceptual

**Amadeus devuelve:**
- `price.total` (string)
- `itineraries[0].segments` (array complejo)

**Tu DTO normalizado:**
- `price.amount` (number)
- `segments` (array simplificado)

**Mapper transforma:**
- Parsea `price.total` a número
- Simplifica estructura de `itineraries`

---

## 🔢 API Versioning

### Estrategia: Versionado por URL

**Estructura:**
```
/api/v1/search/flights
/api/v1/health
```

**Ventajas:**
- Simple de probar
- Fácil de documentar
- Compatible con herramientas (Postman, Swagger)

### Implementación Conceptual

**Estructura de carpetas:**
```
src/
├── api/
│   ├── v1/
│   │   ├── search/
│   │   │   └── search.controller.ts
│   │   └── health/
│   │       └── health.controller.ts
│   └── v2/  (futuro)
```

**Routing:**
- Prefijo global: `/api/v1`
- Controllers dentro de `v1/` automáticamente tienen el prefijo

**Migración futura:**
- `v1` sigue funcionando
- `v2` introduce cambios breaking
- Deprecación gradual de `v1`

**Recursos:**
- NestJS Versioning: https://docs.nestjs.com/techniques/versioning

---

## 🏥 Health Checks

### Endpoints Propuestos

#### 1. `/health` (Básico)
**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 2. `/health/detailed` (Detallado)
**Chequea:**
- Redis: Conexión activa
- Amadeus: Token válido (opcional, puede ser lento)
- Circuit Breaker: Estado (CLOSED/OPEN)

**Respuesta:**
```json
{
  "status": "ok",
  "redis": { "status": "connected", "latency": "2ms" },
  "amadeus": { "status": "authenticated", "tokenExpiresIn": 3600 },
  "circuitBreaker": { "status": "closed", "failures": 0 }
}
```

### Uso

- **Kubernetes/Docker**: Liveness y readiness probes
- **Monitoreo**: Alertas si `status !== "ok"`
- **Load Balancers**: Routing basado en health

**Recursos:**
- NestJS Terminus: https://docs.nestjs.com/recipes/terminus

---

## 🧪 Testing Strategy

### Niveles de Testing

#### 1. Unit Tests
**Objetivo:** Probar lógica aislada.

**Qué testear:**
- Mappers (Amadeus → DTO normalizado)
- Servicios de dominio (lógica de negocio)
- Utilidades (composeKey, formatters)

**Mocks:**
- Redis client
- HTTP client (Axios)
- Logger

#### 2. Integration Tests
**Objetivo:** Probar interacción entre componentes.

**Qué testear:**
- Flujo completo: Controller → Service → Adapter
- Cache integration (Redis real o mock)
- Circuit Breaker con fallos simulados

**Setup:**
- Redis de test (docker-compose.test.yml)
- Mock de Amadeus (nock o similar)

#### 3. E2E Tests
**Objetivo:** Probar el sistema completo.

**Qué testear:**
- Endpoints HTTP reales
- Flujo completo con Redis real
- Respuestas válidas

**Setup:**
- Test database (Redis)
- Mock de Amadeus (no llamadas reales en tests)

### Cobertura Objetivo

- **Unit**: >80%
- **Integration**: >70%
- **E2E**: Casos críticos (happy path, errores comunes)

**Recursos:**
- NestJS Testing: https://docs.nestjs.com/fundamentals/testing

---

## 💰 Consideraciones de Costos y Límites

### Amadeus Free Tier

**Límites típicos:**
- **Requests/minuto**: ~10
- **Requests/día**: Variable según plan
- **Costo**: $0 en free tier (con límites)

**Estrategias de reducción:**
1. **Caching agresivo**: Reducir llamadas reales
2. **Batching**: Agrupar búsquedas similares (si Amadeus lo permite)
3. **Rate limiting**: Respetar límites, evitar 429
4. **Circuit breaker**: Evitar llamadas cuando el servicio está caído

### Optimización de Costos

**Decisiones:**
- Cachear búsquedas populares (origen-destino comunes)
- TTL largo para búsquedas futuras (datos menos dinámicos)
- Invalidación inteligente (solo cuando es necesario)

**Métricas a monitorear:**
- Número de llamadas a Amadeus/día
- Cache hit rate
- Costo estimado (si pasas a paid tier)

---

## 📚 Recursos Oficiales

### Redis
- **Documentación**: https://redis.io/docs/latest/
- **Patrones de Caching**: https://redis.io/docs/manual/patterns/
- **TTL y Expiración**: https://redis.io/docs/manual/keyspace-notifications/

### Amadeus
- **Self-Service Portal**: https://developers.amadeus.com/self-service
- **Flight APIs**: https://developers.amadeus.com/self-service/category/air
- **Rate Limits**: https://developers.amadeus.com/get-started/rate-limits-101
- **OAuth2**: https://developers.amadeus.com/get-started/oauth-2-0-1

### NestJS
- **Fundamentals**: https://docs.nestjs.com/
- **Configuration**: https://docs.nestjs.com/techniques/configuration
- **Versioning**: https://docs.nestjs.com/techniques/versioning
- **Rate Limiting**: https://docs.nestjs.com/security/rate-limiting
- **Health Checks**: https://docs.nestjs.com/recipes/terminus
- **Testing**: https://docs.nestjs.com/fundamentals/testing

### Resiliencia
- **Circuit Breaker (Martin Fowler)**: https://martinfowler.com/bliki/CircuitBreaker.html
- **Retry Pattern (Microsoft)**: https://learn.microsoft.com/en-us/azure/architecture/patterns/retry
- **Circuit Breaker Pattern (Microsoft)**: https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker
- **Cockatiel (Librería)**: https://github.com/connor4312/cockatiel

### Logging
- **Winston**: https://github.com/winstonjs/winston
- **NestJS Winston**: https://github.com/gremo/nest-winston

### Testing
- **Jest**: https://jestjs.io/docs/getting-started
- **Supertest**: https://github.com/visionmedia/supertest

---

## 🎯 Próximos Pasos Sugeridos

### ✅ Fase 1: Infraestructura de Resiliencia - COMPLETA
1. ✅ Diseñar `infra/resilience/` module
2. ✅ Implementar Circuit Breaker con Cockatiel
3. ✅ Implementar Retry con Exponential Backoff
4. ✅ Integrar Timeout

### ✅ Fase 2: Integración con Amadeus - COMPLETA
1. ✅ Crear `modules/providers/amadeus/`
2. ✅ Implementar OAuth2 authentication
3. ✅ Crear HTTP client wrapper
4. ✅ Diseñar mappers (Amadeus → DTOs normalizados)

### ✅ Fase 3: Módulo de Búsqueda - COMPLETA
1. ✅ Crear `modules/search/`
2. ✅ Integrar con Amadeus adapter
3. ✅ Implementar caching de búsquedas con TTL dinámico
4. ✅ Crear DTOs normalizados
5. ✅ Implementar validación completa
6. ✅ Soporte para arrays en query params

### Fase 4: API y Controllers
1. Implementar versioning (`/api/v1`)
2. ✅ Crear endpoints de búsqueda (`/search/flights`)
3. ✅ Agregar validación de DTOs
4. Implementar rate limiting

### Fase 5: Health Checks y Observabilidad
1. Implementar `/health` endpoints
2. ✅ Agregar métricas de cache (`/debug/cache/stats`)
3. ✅ Mejorar logging en puntos críticos

### Fase 6: Testing
1. Unit tests de mappers y servicios
2. Integration tests de flujos completos
3. E2E tests de endpoints

---

## 📝 Notas Finales

### Decisiones Técnicas Confirmadas
✅ Modular por feature (NestJS)  
✅ Circuit Breaker + Retry con backoff  
✅ Rate limiting con `@nestjs/throttler`  
✅ Cache con TTL variable  
✅ DTOs normalizados  
✅ Versionado por URL  

### Principios a Mantener
- **Fail-Safe**: El sistema debe degradarse, no caer
- **Observabilidad**: Logging estructurado en cada capa crítica
- **Modularidad**: Módulos autocontenidos y desacoplados
- **Testabilidad**: Diseño que facilite testing

### Preguntas Pendientes (Resolver durante implementación)
- ¿TTL exacto para cada tipo de búsqueda?
- ¿Configuración de Circuit Breaker (thresholds)?
- ¿Estrategia de invalidación de cache?
- ¿Límites exactos de rate limiting?

---

**Última actualización:** 2025-12-04  
**Estado:** Diseño conceptual completo. Implementación:
- ✅ Infraestructura base (Cache, Logging, Resilience) - COMPLETA
- ✅ Integración con Amadeus (completa) - COMPLETA
- ✅ Módulo de búsqueda (completo) - COMPLETA
- ✅ Endpoints funcionales (`/search/flights`, `/debug/cache/*`)
- ✅ Validación de DTOs con `class-validator` y `class-transformer`
- ✅ Soporte para arrays en query params (`includedAirlines`, `excludedAirlines`)
- ✅ Cache inteligente con TTL dinámico
- ✅ Eliminación de cache por patrón (`deleteByPattern`)
- ✅ Type safety mejorado (eliminación de `any`, uso de `unknown`)
- ✅ Optimización de código (eliminación de validaciones innecesarias)
- ✅ Type assertions correctas para métodos avanzados de Redis

