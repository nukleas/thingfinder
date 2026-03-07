# Thingfinder

CLI tool, library, and MCP server for searching and downloading 3D printing files across multiple repositories (Thingiverse, Printables, Thangs, Sketchfab, MyMiniFactory, Cults3D).

## Commands

```bash
npm run build        # Build with tsup (CLI + library + MCP server)
npm run dev          # Run CLI with tsx (no build needed)
npm run lint         # ESLint (strict TypeScript)
npm run lint:fix     # ESLint with autofix
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest watch mode
```

Always run `npm run lint && npm run typecheck` before committing.

## Architecture

### Directory Structure

```
src/
├── index.ts              # CLI entry point
├── cli.ts                # Commander.js program setup
├── logger.ts             # Console logger with verbose flag
├── errors.ts             # Error class hierarchy
├── commands/             # CLI commands (search, download, config)
├── providers/            # Source provider implementations
│   ├── types.ts          # SourceProvider interface, SearchResult, ModelFile
│   ├── registry.ts       # ProviderRegistry with searchAll()
│   ├── index.ts          # getRegistry() singleton
│   ├── thangs.ts         # Thangs (ImpitTransport for Cloudflare)
│   ├── printables.ts     # Printables (GraphQL API)
│   ├── thingiverse.ts    # Thingiverse (REST, Bearer token)
│   ├── sketchfab.ts      # Sketchfab (REST, GLTF/USDZ)
│   ├── myminifactory.ts  # MyMiniFactory (REST, query param auth)
│   └── cults3d.ts        # Cults3D (GraphQL, browse-only)
├── http/
│   ├── client.ts         # HttpClient with retry/rate-limit
│   ├── transport.ts      # NativeTransport, ImpitTransport
│   └── rate-limiter.ts   # Token bucket rate limiter
├── config/
│   ├── store.ts          # Singleton Conf wrapper
│   └── schema.ts         # Zod config schema
├── lib/                  # Programmatic API (importable via thingfinder/lib)
│   ├── index.ts          # Public exports
│   ├── search.ts         # searchModels()
│   ├── sources.ts        # listSources()
│   ├── files.ts          # listFiles()
│   └── download.ts       # downloadModel()
├── mcp/
│   ├── index.ts          # Stdio transport entry
│   └── server.ts         # McpServer with 4 tools
├── download/
│   ├── manager.ts        # Download orchestration, path safety
│   └── stream.ts         # Streaming downloads with .partial files
└── ui/                   # Terminal UI (prompts, spinner, progress, table)

tests/
├── fixtures/             # JSON API response fixtures
├── unit/                 # Mirrors src/ structure
│   ├── providers/        # One test per provider + registry
│   ├── lib/              # Library API tests
│   ├── http/             # Client, transport, rate-limiter tests
│   ├── commands/         # Command tests
│   ├── config/           # Config tests
│   └── mcp/              # MCP server tests
└── integration/          # CLI integration tests
```

### Key Components

- **Providers** (`src/providers/`): Each source implements `SourceProvider` from `types.ts` — `search()`, `getFiles()`, `resolveUrl()`, `isAvailable()`, `fetchFile()`. Browse-only providers set `isBrowseOnly = true` and return empty files.
- **Registry** (`src/providers/registry.ts`): Manages provider registration and parallel search via `searchAll()`.
- **HTTP** (`src/http/`): `HttpClient` wraps pluggable transports (native fetch or impit for Cloudflare bypass) with rate limiting (5 tokens/sec) and retry (exponential backoff, up to 3 retries, 15s timeout).
- **Commands** (`src/commands/`): `search`, `download`, and `config` commands using Commander.js. Support interactive modes.
- **Library** (`src/lib/`): Programmatic API — `listSources()`, `searchModels()`, `listFiles()`, `downloadModel()`. Importable via `thingfinder/lib`.
- **MCP Server** (`src/mcp/`): Model Context Protocol server exposing 4 tools (`list_sources`, `search_models`, `list_files`, `download_files`). Runs as `thingfinder-mcp` binary over stdio transport. Uses Zod for input validation.
- **Config** (`src/config/`): Uses `conf` package. Type-safe generic store in `store.ts`. Schema validated with Zod in `schema.ts`. Keys: `downloadDir`, `preferredFormats`, `<provider>.apiKey`.
- **Download** (`src/download/`): Streaming file downloads with progress bars, `.partial` file pattern (renamed on completion), path traversal safety checks.
- **Errors** (`src/errors.ts`): `ThingfinderError` (base) → `ProviderError` (includes provider name) → `AuthError`, `RateLimitError` (includes retryAfterMs). Also `NetworkError`, `DownloadError` (includes url). All support `ErrorOptions` for cause chaining.

## Build Outputs

tsup produces three entry points (target: Node 20):

| Entry | Output | Description |
|-------|--------|-------------|
| `src/index.ts` | `dist/index.js` | CLI binary (shebang) |
| `src/lib/index.ts` | `dist/lib.js` + `dist/lib.d.ts` | Library with type declarations |
| `src/mcp/index.ts` | `dist/mcp.js` | MCP server binary (shebang) |

## Providers

| Provider | Auth | Type | API Style | Notes |
|----------|------|------|-----------|-------|
| Thangs | None | Full | REST | Uses ImpitTransport for Cloudflare bypass |
| Printables | None | Full | GraphQL | Supports STL/GCODE/SLA formats |
| Thingiverse | API key | Full | REST | Bearer token auth |
| Sketchfab | API token | Full | REST | GLTF/USDZ formats, downloadable-only filter |
| MyMiniFactory | API key | Full | REST | Query parameter auth |
| Cults3D | API key | Browse-only | GraphQL | No file downloads (API restriction) |

Auth pattern: env var `THINGFINDER_<PROVIDER>_API_KEY` (e.g., `THINGFINDER_THINGIVERSE_API_KEY`) with config store fallback (`<provider>.apiKey`).

## Key Interfaces

```typescript
// src/providers/types.ts
interface SourceProvider {
  readonly name: string;
  readonly isBrowseOnly?: boolean;
  search(options: SearchOptions): Promise<SearchResult[]>;
  getFiles(modelId: string): Promise<ModelFile[]>;
  resolveUrl(url: string): string | null;
  isAvailable(): boolean;
  fetchFile(url: string): Promise<TransportResponse>;
}

interface SearchResult {
  id: string; name: string; creator: string; url: string;
  thumbnailUrl?: string; likes: number; downloads: number;
  source: string; createdAt?: string;
}

interface ModelFile {
  id: string; name: string; url: string;
  size?: number; format: string;
}
```

## Code Style

- TypeScript ESM (`"type": "module"`, `.js` extensions in imports)
- Target: ES2022, module resolution: bundler
- ESLint `strictTypeChecked` — no `any` in src, prefer `??` over `||`, no non-null assertions, no floating promises
- `eqeqeq`: always use `===`/`!==`
- `no-console`: warn (log/warn/error allowed)
- Tests use vitest with relaxed lint rules (`any` allowed, unsafe operations allowed)
- Unused params prefixed with `_`
- Node >= 20 required (`.node-version` file)
- 2-space indentation, LF line endings (`.editorconfig`)

## Testing

- Framework: vitest with globals enabled, Node environment
- Coverage: v8 provider
- Patterns: `vi.mock()` for module mocking, `vi.fn()` for stubs, JSON fixtures for API responses
- Test files: `tests/**/*.test.ts`
- Run: `npm test` (single run) or `npm run test:watch` (watch mode)

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
- Triggers: push to main/master, all PRs
- Matrix: Node 20, 22
- Steps: install → lint → typecheck → test → build

## Adding a New Provider

1. Create `src/providers/<name>.ts` implementing `SourceProvider`
2. Register in `src/providers/index.ts` via `getRegistry()`
3. Add API key support if needed (env var + config schema)
4. Add test file `tests/unit/providers/<name>.test.ts` with fixture data
5. Update provider table in README.md and this file
