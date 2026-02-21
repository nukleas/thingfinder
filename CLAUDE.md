# Thingfinder

CLI tool, library, and MCP server for searching and downloading 3D printing files across multiple repositories.

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

- **Providers** (`src/providers/`): Each source implements `SourceProvider` from `types.ts` — `search()`, `getFiles()`, `resolveUrl()`, `isAvailable()`, `fetchFile()`. Browse-only providers set `isBrowseOnly = true` and return empty files.
- **Registry** (`src/providers/registry.ts`): Manages provider registration and parallel search via `searchAll()`.
- **HTTP** (`src/http/`): `HttpClient` wraps pluggable transports (native fetch or impit for Cloudflare bypass) with rate limiting and retry.
- **Commands** (`src/commands/`): `search` and `download` commands using Commander.js.
- **Library** (`src/lib/`): Programmatic API — `listSources()`, `searchModels()`, `listFiles()`, `downloadModel()`. Importable via `thingfinder/lib`.
- **MCP Server** (`src/mcp/`): Model Context Protocol server exposing 4 tools (`list_sources`, `search_models`, `list_files`, `download_files`). Runs as `thingfinder-mcp` binary over stdio transport.
- **Config** (`src/config/`): Uses `conf` package. Type-safe generic store in `store.ts`. Schema in `schema.ts`. Keys: `downloadDir`, `preferredFormats`, `<provider>.apiKey`.
- **Errors** (`src/errors.ts`): `ProviderError`, `AuthError`, `RateLimitError`, `NetworkError`, `DownloadError`.

## Build Outputs

tsup produces three entry points:

| Entry | Output | Description |
|-------|--------|-------------|
| `src/index.ts` | `dist/index.js` | CLI binary (shebang) |
| `src/lib/index.ts` | `dist/lib.js` + `dist/lib.d.ts` | Library with type declarations |
| `src/mcp/index.ts` | `dist/mcp.js` | MCP server binary (shebang) |

## Providers

| Provider | Auth | Type |
|----------|------|------|
| Thangs | None | Full |
| Printables | None | Full |
| Thingiverse | API key | Full |
| Sketchfab | API token | Full |
| MyMiniFactory | API key | Full |
| Cults3D | API key | Browse-only |

Auth pattern: env var `THINGFINDER_<PROVIDER>_API_KEY` with config store fallback (`<provider>.apiKey`).

## Code Style

- TypeScript ESM (`"type": "module"`, `.js` extensions in imports)
- ESLint `strictTypeChecked` — no `any` in src, prefer `??` over `||`, no non-null assertions, no floating promises
- Tests use vitest with relaxed lint rules (any allowed)
- Unused params prefixed with `_`
