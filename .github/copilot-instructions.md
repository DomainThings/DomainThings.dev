# DomainThings AI Coding Agent Instructions

## Architecture Overview

**DomainThings** is a privacy-first Progressive Web App for domain availability checking and expiration monitoring. Key architectural decisions:

- **Client-side only**: No backend servers - all data stays in IndexedDB for privacy
- **External API integration**: Cloudflare DNS-over-HTTPS + IANA RDAP bootstrap for domain data
- **Service Worker architecture**: Background notifications, asset caching, and offline functionality
- **Immutable domain models**: `Domain` class with `.with()` pattern for updates

## Critical Development Patterns

### Service Architecture
The app uses a service-oriented architecture with these key services:
- `dnsService.ts`: Cloudflare DNS-over-HTTPS queries with intelligent caching
- `rdapService.ts`: IANA RDAP bootstrap → registry provider routing
- `alertService.ts`: Singleton alert management with Service Worker integration
- `dbService.ts`: IndexedDB wrapper with versioned schemas

**Key Pattern**: All services return `{ success: boolean, data?: T, error?: string }` result objects.

### Vue 3 Composition API Conventions
- **Always use `readonly` for interfaces and array types**
- **Computed properties for derived state**: `const computed = computed(() => ...)`
- **Ref destructuring**: `const { data, isLoading } = useService()`
- **Props with defaults**: `withDefaults(defineProps<Props>(), { variant: 'neutral' })`

### TypeScript Patterns
```typescript
// Service result pattern (use everywhere)
interface ServiceResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly fromCache?: boolean;
}

// Domain immutability pattern
const updatedDomain = domain.with({ availability: DomainAvailabilityStatus.AVAILABLE });

// Theme variant system
type ThemeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
```

### IndexedDB Schema Management
Database version 6 with stores: `domains`, `tlds`, `searches`, `dnsCache`, `settings`, `alerts`. 
**Critical**: Alert records store `alertDate: string` (ISO) not `daysBeforeExpiration: number`.

## Service Worker Integration

The Service Worker (`src/serviceWorker.ts`) handles:
- **Background notifications**: Periodic domain expiration checks
- **Alert synchronization**: Main thread ↔ Service Worker via `postMessage`
- **Asset precaching**: Workbox integration for offline functionality

**Message Types**: Use `AlertServiceWorkerMessageType` enum for Service Worker communication.

## External API Integration

### DNS Service (Cloudflare)
- Endpoint: `https://cloudflare-dns.com/dns-query`
- Headers: `accept: application/dns-json`, `user-agent: DomainThings/1.0`
- Caching: 5-minute TTL with Map-based cache
- **Domain availability logic**: Check for A/AAAA records + SOA authority analysis

### RDAP Service (IANA Bootstrap)
- Bootstrap: `https://data.iana.org/rdap/dns.json` → TLD-specific providers
- Retry logic: Exponential backoff for 5xx errors, max 2 retries
- **TLD extraction**: `domain.split('.').pop()` → find matching RDAP service

## Component Design System

### Theme System (`useTheme` composable)
Semantic color variants with automatic dark mode:
```vue
<BaseButton variant="primary" size="md" :disabled="!canSubmit">
<BaseBadge variant="success">Available</BaseBadge>
```

### Component Patterns
- **Base components**: `BaseButton`, `BaseBadge`, `BaseAlert`, `BaseModal`
- **Icon components**: SVG icons in `src/icons/` with `Props { class?: string | string[] }`
- **Layout**: `DefaultLayout.vue` with responsive navigation and dark mode toggle

## Development Workflow

### Build Commands
```bash
npm run dev              # Start dev server (builds dev service worker first)
npm run build:dev-sw     # Build development service worker
npm run type-check       # Vue TypeScript compilation check
npm run test:external    # Test external APIs (Cloudflare DNS, IANA RDAP)
```

### Critical Files to Understand
- `src/types/index.ts`: Core Domain model and DomainAvailabilityStatus enum
- `src/stores/searchStore.ts`: Pinia store with search history and validation
- `src/serviceWorker.ts`: Background processing and notifications
- `external-services.test.ts`: API integration tests (runs in CI)

## Data Flow Patterns

**Domain Search Flow**:
1. User input → `searchStore.ts` validation
2. Parallel DNS + RDAP queries → `dnsService.ts` + `rdapService.ts`
3. Results merged → `rdapUtil.ts` confidence scoring
4. Domain objects created → `types/index.ts` immutable pattern
5. Results cached → IndexedDB via `dbService.ts`

**Alert System Flow**:
1. Alert creation → `AlertForm.vue` with date picker
2. Data persistence → `alertService.ts` singleton → `dbService.ts`
3. Service Worker sync → `postMessage` with alert array
4. Background checks → Service Worker periodic sync → notifications

## Coding Style & Principles

### Clean Code Standards
- **Single Responsibility**: Each service has one clear purpose (DNS, RDAP, Alerts, DB)
- **Pure Functions**: Prefer stateless functions that return new objects instead of mutations
- **Explicit Error Handling**: Always return structured `{ success, data?, error? }` results
- **Meaningful Names**: Use descriptive function/variable names (`isValidDomainForRdap`, `shouldSendNotification`)

### Keep It Simple (KISS)
- **Avoid Over-Engineering**: Use simple Map-based caches instead of complex cache libraries
- **Clear Data Flow**: Linear service calls with explicit error propagation
- **Minimal Dependencies**: Leverage browser APIs (IndexedDB, Service Worker) over heavy libraries
- **Readable Logic**: Break complex operations into small, testable functions

### TypeScript Best Practices
```typescript
// ✅ Prefer readonly interfaces
interface AlertSettings {
  readonly id: string;
  readonly domain: string;
}

// ✅ Use enums for constants
export enum DomainAvailabilityStatus {
  AVAILABLE = 1,
  NOTAVAILABLE = 0
}

// ✅ Explicit return types for public methods
async fetchDns(domain: string): Promise<DnsResult<DnsJsonResponse>>
```

## Testing & Quality

- **External service monitoring**: `external-services.test.ts` validates API responses
- **Type safety**: Strict TypeScript with readonly interfaces
- **Error boundaries**: All services use structured error handling
- **Caching strategy**: Intelligent TTL-based caching for performance

Focus on maintaining the privacy-first architecture, service result patterns, and immutable domain modeling when making changes.