# Thingfinder MCP Server + Library Exports

**Date:** 2026-02-21
**Status:** Approved

## Goal

Expose thingfinder's search and download capabilities to AI agents (Claude, etc.) via an MCP server, and to other Node.js tools via clean library exports. Thingfinder stays focused on search + download — no slicing or printer integration.

## Approach

Single-package approach (Approach B): add an MCP server and library exports to the existing thingfinder package. The core refactoring extracts business logic from CLI command handlers into a library layer that all consumers share.

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  CLI (cmds)  │  │  MCP Server  │  │  Library Imports  │
│  search.ts   │  │  server.ts   │  │  import from      │
│  download.ts │  │  (stdio)     │  │  'thingfinder/lib' │
└──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
       │                 │                    │
       └─────────────────┼────────────────────┘
                         │
                  ┌──────▼───────┐
                  │  Library API │
                  │  src/lib/    │
                  └──────┬───────┘
                         │
              ┌──────────▼──────────┐
              │  Providers/Registry │
              │  HTTP / Config      │
              └─────────────────────┘
```

## Library Layer (`src/lib/`)

Pure async functions, no console output, no process.exit. Return structured data or throw typed errors.

### `src/lib/search.ts`

```typescript
interface SearchModelsOptions {
  sources?: string[];
  sort?: 'relevant' | 'popular' | 'newest';
  limit?: number;
}

interface SearchModelsResult {
  results: SearchResult[];
  errors: { provider: string; message: string }[];
}

function searchModels(query: string, options?: SearchModelsOptions): Promise<SearchModelsResult>
```

Wraps `registry.searchAll()` + deduplication. Returns structured results.

### `src/lib/files.ts`

```typescript
function listFiles(modelId: string, source: string): Promise<ModelFile[]>
```

Gets files for a specific model from a specific provider.

### `src/lib/download.ts`

```typescript
interface DownloadOptions {
  outputDir?: string;
  formats?: string[];
}

interface DownloadResult {
  files: string[];       // downloaded file paths
  skipped: string[];     // files that were skipped (already exist, no URL, etc.)
}

function downloadModel(
  modelId: string,
  source: string,
  options?: DownloadOptions,
): Promise<DownloadResult>
```

Resolves files, optionally filters by format, downloads, returns paths.

### `src/lib/sources.ts`

```typescript
interface SourceInfo {
  name: string;
  available: boolean;
  isBrowseOnly: boolean;
}

function listSources(): SourceInfo[]
```

Returns all registered sources with their current availability/auth status.

### `src/lib/index.ts`

Re-exports the public API:

```typescript
export { searchModels, type SearchModelsOptions, type SearchModelsResult } from './search.js';
export { listFiles } from './files.js';
export { downloadModel, type DownloadOptions, type DownloadResult } from './download.js';
export { listSources, type SourceInfo } from './sources.js';
export type { SearchResult, ModelFile } from '../providers/types.js';
```

## MCP Server

### Tools

| Tool | Input | Output |
|------|-------|--------|
| `search_models` | `query`, `source?`, `sort?`, `limit?` | Array of results with name, creator, url, source, likes, downloads |
| `list_files` | `modelId`, `source` | Array of files with name, format, size |
| `download_files` | `modelId`, `source`, `outputDir?`, `formats?` | Array of downloaded file paths |
| `list_sources` | (none) | Array of sources with name, available, isBrowseOnly |

### Implementation (`src/mcp/server.ts`)

Uses `@modelcontextprotocol/sdk` with `McpServer` and `StdioServerTransport`. Each tool is a thin wrapper over the library API — validates input with Zod, calls the library function, returns JSON as text content.

No MCP resources or prompts. Stateless — each tool call is independent.

### Entrypoint (`src/mcp/index.ts`)

```typescript
import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Claude Configuration

```json
{
  "mcpServers": {
    "thingfinder": {
      "command": "npx",
      "args": ["thingfinder-mcp"]
    }
  }
}
```

## Package Configuration

### `package.json` changes

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./lib": "./dist/lib.js"
  },
  "bin": {
    "thingfinder": "./dist/index.js",
    "thingfinder-mcp": "./dist/mcp.js"
  }
}
```

### `tsup.config.ts` changes

Three entry points:
- `src/index.ts` — CLI
- `src/lib/index.ts` — library exports
- `src/mcp/index.ts` — MCP server

### New dependency

- `@modelcontextprotocol/sdk` (with `zod` as peer)

## CLI Refactoring

`src/commands/search.ts` and `src/commands/download.ts` are refactored to call library functions. All UI concerns (spinners, prompts, table formatting, process.exit) remain in the command layer. The library layer is pure data in, data out.

## What doesn't change

- **Providers** — untouched
- **HTTP layer, config, errors** — untouched
- **Existing tests** — stay as-is

## New/Changed Files

```
New:
  src/lib/search.ts
  src/lib/files.ts
  src/lib/download.ts
  src/lib/sources.ts
  src/lib/index.ts
  src/mcp/server.ts
  src/mcp/index.ts
  tests/unit/lib/
  tests/unit/mcp/

Changed:
  src/commands/search.ts    — delegates to lib/search
  src/commands/download.ts  — delegates to lib/download
  package.json              — exports, bin, dependencies
  tsup.config.ts            — multi-entry build
```

## Testing

- **Library tests** (`tests/unit/lib/`): test each library function with mocked providers
- **MCP tests** (`tests/unit/mcp/`): test tool handlers return correct JSON structure
- **Existing tests**: unchanged, continue to pass
