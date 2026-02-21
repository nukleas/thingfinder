# MCP Server + Library Exports Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose thingfinder's search/download capabilities to AI agents via MCP and to Node.js consumers via library exports.

**Architecture:** Extract business logic from CLI commands into `src/lib/` functions. Build an MCP server (`src/mcp/`) as a thin wrapper over the library API. Both CLI and MCP consume the same library layer.

**Tech Stack:** `@modelcontextprotocol/sdk` (v2, uses `registerTool` + `zod/v4`), `zod`, existing thingfinder providers/registry.

---

### Task 1: `listSources` library function

Simplest function — no dependencies on other new code. Gets the pattern established.

**Files:**
- Create: `src/lib/sources.ts`
- Create: `tests/unit/lib/sources.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/sources.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the registry before importing
vi.mock('../../../src/providers/index.js', () => {
  const { ProviderRegistry } = await vi.importActual<typeof import('../../../src/providers/registry.js')>('../../../src/providers/registry.js');
  const registry = new ProviderRegistry();
  return { getRegistry: () => registry };
});

import { getRegistry } from '../../../src/providers/index.js';
import { listSources } from '../../../src/lib/sources.js';
import type { SourceProvider } from '../../../src/providers/types.js';

function mockProvider(name: string, available: boolean, browseOnly = false): SourceProvider {
  return {
    name,
    isBrowseOnly: browseOnly,
    search: vi.fn().mockResolvedValue([]),
    getFiles: vi.fn().mockResolvedValue([]),
    resolveUrl: vi.fn().mockReturnValue(null),
    isAvailable: vi.fn().mockReturnValue(available),
    fetchFile: vi.fn(),
  };
}

describe('listSources', () => {
  beforeEach(() => {
    // Clear registry by getting a fresh one via the mock
    const registry = getRegistry();
    // registry.providers is private, so we re-register fresh for each test
  });

  it('should return source info for all registered providers', () => {
    const registry = getRegistry();
    registry.register(mockProvider('thangs', true));
    registry.register(mockProvider('cults3d', true, true));
    registry.register(mockProvider('thingiverse', false));

    const sources = listSources();

    expect(sources).toHaveLength(3);
    expect(sources).toContainEqual({ name: 'thangs', available: true, isBrowseOnly: false });
    expect(sources).toContainEqual({ name: 'cults3d', available: true, isBrowseOnly: true });
    expect(sources).toContainEqual({ name: 'thingiverse', available: false, isBrowseOnly: false });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/sources.test.ts`
Expected: FAIL — `src/lib/sources.js` does not exist.

**Step 3: Write the implementation**

Create `src/lib/sources.ts`:

```typescript
import { getRegistry } from '../providers/index.js';

export interface SourceInfo {
  name: string;
  available: boolean;
  isBrowseOnly: boolean;
}

export function listSources(): SourceInfo[] {
  const registry = getRegistry();
  return registry.getAll().map(p => ({
    name: p.name,
    available: p.isAvailable(),
    isBrowseOnly: p.isBrowseOnly ?? false,
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/sources.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/sources.ts tests/unit/lib/sources.test.ts
git commit -m "feat: add listSources library function"
```

---

### Task 2: `searchModels` library function

**Files:**
- Create: `src/lib/search.ts`
- Create: `tests/unit/lib/search.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/search.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SourceProvider, SearchResult } from '../../../src/providers/types.js';

const mockResult = (source: string, id: string, url: string): SearchResult => ({
  id,
  name: `Model ${id}`,
  creator: 'TestUser',
  url,
  likes: 10,
  downloads: 100,
  source,
});

const mockProviders: SourceProvider[] = [];

vi.mock('../../../src/providers/index.js', () => {
  const { ProviderRegistry } = await vi.importActual<typeof import('../../../src/providers/registry.js')>('../../../src/providers/registry.js');
  return {
    getRegistry: () => {
      const registry = new ProviderRegistry();
      for (const p of mockProviders) registry.register(p);
      return registry;
    },
  };
});

import { searchModels } from '../../../src/lib/search.js';

function createProvider(name: string, results: SearchResult[]): SourceProvider {
  return {
    name,
    search: vi.fn().mockResolvedValue(results),
    getFiles: vi.fn().mockResolvedValue([]),
    resolveUrl: vi.fn().mockReturnValue(null),
    isAvailable: vi.fn().mockReturnValue(true),
    fetchFile: vi.fn(),
  };
}

describe('searchModels', () => {
  beforeEach(() => {
    mockProviders.length = 0;
  });

  it('should return search results from all providers', async () => {
    mockProviders.push(
      createProvider('source1', [mockResult('source1', '1', 'https://a.com/1')]),
      createProvider('source2', [mockResult('source2', '2', 'https://b.com/2')]),
    );

    const { results, errors } = await searchModels('test query');

    expect(results).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('should deduplicate results by URL', async () => {
    mockProviders.push(
      createProvider('source1', [mockResult('source1', '1', 'https://same.com/model')]),
      createProvider('source2', [mockResult('source2', '2', 'https://same.com/model')]),
    );

    const { results } = await searchModels('test');

    expect(results).toHaveLength(1);
  });

  it('should filter by source', async () => {
    mockProviders.push(
      createProvider('source1', [mockResult('source1', '1', 'https://a.com/1')]),
      createProvider('source2', [mockResult('source2', '2', 'https://b.com/2')]),
    );

    const { results } = await searchModels('test', { sources: ['source1'] });

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('source1');
  });

  it('should capture provider errors without throwing', async () => {
    const failing: SourceProvider = {
      name: 'failing',
      search: vi.fn().mockRejectedValue(new Error('boom')),
      getFiles: vi.fn().mockResolvedValue([]),
      resolveUrl: vi.fn().mockReturnValue(null),
      isAvailable: vi.fn().mockReturnValue(true),
      fetchFile: vi.fn(),
    };
    mockProviders.push(failing);

    const { results, errors } = await searchModels('test');

    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].provider).toBe('failing');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/search.test.ts`
Expected: FAIL — `src/lib/search.js` does not exist.

**Step 3: Write the implementation**

Create `src/lib/search.ts`:

```typescript
import { getRegistry } from '../providers/index.js';
import type { SearchResult } from '../providers/types.js';

export interface SearchModelsOptions {
  sources?: string[];
  sort?: 'relevant' | 'popular' | 'newest';
  limit?: number;
}

export interface SearchModelsResult {
  results: SearchResult[];
  errors: { provider: string; message: string }[];
}

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchModels(
  query: string,
  options?: SearchModelsOptions,
): Promise<SearchModelsResult> {
  const registry = getRegistry();

  const { results, errors } = await registry.searchAll(
    {
      query,
      pageSize: options?.limit ?? 20,
      sort: options?.sort ?? 'relevant',
    },
    options?.sources,
  );

  return {
    results: deduplicateResults(results),
    errors: errors.map(e => ({ provider: e.provider, message: e.error.message })),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/search.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/search.ts tests/unit/lib/search.test.ts
git commit -m "feat: add searchModels library function"
```

---

### Task 3: `listFiles` library function

**Files:**
- Create: `src/lib/files.ts`
- Create: `tests/unit/lib/files.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/files.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SourceProvider, ModelFile } from '../../../src/providers/types.js';

const mockProviders: SourceProvider[] = [];

vi.mock('../../../src/providers/index.js', () => {
  const { ProviderRegistry } = await vi.importActual<typeof import('../../../src/providers/registry.js')>('../../../src/providers/registry.js');
  return {
    getRegistry: () => {
      const registry = new ProviderRegistry();
      for (const p of mockProviders) registry.register(p);
      return registry;
    },
  };
});

import { listFiles } from '../../../src/lib/files.js';

const sampleFiles: ModelFile[] = [
  { id: '1', name: 'part.stl', url: 'https://example.com/part.stl', size: 1024, format: 'stl' },
  { id: '2', name: 'part.3mf', url: 'https://example.com/part.3mf', size: 2048, format: '3mf' },
];

describe('listFiles', () => {
  beforeEach(() => {
    mockProviders.length = 0;
  });

  it('should return files from the specified provider', async () => {
    mockProviders.push({
      name: 'testprovider',
      search: vi.fn().mockResolvedValue([]),
      getFiles: vi.fn().mockResolvedValue(sampleFiles),
      resolveUrl: vi.fn().mockReturnValue(null),
      isAvailable: vi.fn().mockReturnValue(true),
      fetchFile: vi.fn(),
    });

    const files = await listFiles('model-123', 'testprovider');

    expect(files).toEqual(sampleFiles);
  });

  it('should throw if provider is not found', async () => {
    await expect(listFiles('model-123', 'nonexistent')).rejects.toThrow('Unknown source: nonexistent');
  });

  it('should throw if provider is browse-only', async () => {
    mockProviders.push({
      name: 'browseonly',
      isBrowseOnly: true,
      search: vi.fn().mockResolvedValue([]),
      getFiles: vi.fn().mockResolvedValue([]),
      resolveUrl: vi.fn().mockReturnValue(null),
      isAvailable: vi.fn().mockReturnValue(true),
      fetchFile: vi.fn(),
    });

    await expect(listFiles('model-123', 'browseonly')).rejects.toThrow('browse-only');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/files.test.ts`
Expected: FAIL — `src/lib/files.js` does not exist.

**Step 3: Write the implementation**

Create `src/lib/files.ts`:

```typescript
import { getRegistry } from '../providers/index.js';
import { ProviderError } from '../errors.js';
import type { ModelFile } from '../providers/types.js';

export async function listFiles(modelId: string, source: string): Promise<ModelFile[]> {
  const registry = getRegistry();
  const provider = registry.getProvider(source);

  if (!provider) {
    throw new ProviderError(source, `Unknown source: ${source}`);
  }

  if (provider.isBrowseOnly) {
    throw new ProviderError(source, `${source} is browse-only and does not support file listing`);
  }

  return provider.getFiles(modelId);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/files.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/files.ts tests/unit/lib/files.test.ts
git commit -m "feat: add listFiles library function"
```

---

### Task 4: `downloadModel` library function

**Files:**
- Create: `src/lib/download.ts`
- Create: `tests/unit/lib/download.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/download.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SourceProvider, ModelFile } from '../../../src/providers/types.js';

const mockProviders: SourceProvider[] = [];

vi.mock('../../../src/providers/index.js', () => {
  const { ProviderRegistry } = await vi.importActual<typeof import('../../../src/providers/registry.js')>('../../../src/providers/registry.js');
  return {
    getRegistry: () => {
      const registry = new ProviderRegistry();
      for (const p of mockProviders) registry.register(p);
      return registry;
    },
  };
});

const mockDownloadFiles = vi.fn();
vi.mock('../../../src/download/manager.js', () => ({
  downloadFiles: (...args: any[]) => mockDownloadFiles(...args),
}));

import { downloadModel } from '../../../src/lib/download.js';

const sampleFiles: ModelFile[] = [
  { id: '1', name: 'part.stl', url: 'https://example.com/part.stl', size: 1024, format: 'stl' },
  { id: '2', name: 'model.3mf', url: 'https://example.com/model.3mf', size: 2048, format: '3mf' },
  { id: '3', name: 'readme.txt', url: 'https://example.com/readme.txt', size: 100, format: 'txt' },
];

describe('downloadModel', () => {
  beforeEach(() => {
    mockProviders.length = 0;
    mockDownloadFiles.mockReset();
  });

  it('should download all files for a model', async () => {
    mockProviders.push({
      name: 'testprovider',
      search: vi.fn().mockResolvedValue([]),
      getFiles: vi.fn().mockResolvedValue(sampleFiles),
      resolveUrl: vi.fn().mockReturnValue(null),
      isAvailable: vi.fn().mockReturnValue(true),
      fetchFile: vi.fn(),
    });
    mockDownloadFiles.mockResolvedValue(['/tmp/part.stl', '/tmp/model.3mf', '/tmp/readme.txt']);

    const result = await downloadModel('model-123', 'testprovider', { outputDir: '/tmp' });

    expect(result.files).toHaveLength(3);
    expect(mockDownloadFiles).toHaveBeenCalledWith(sampleFiles, '/tmp', expect.any(Function));
  });

  it('should filter files by format', async () => {
    mockProviders.push({
      name: 'testprovider',
      search: vi.fn().mockResolvedValue([]),
      getFiles: vi.fn().mockResolvedValue(sampleFiles),
      resolveUrl: vi.fn().mockReturnValue(null),
      isAvailable: vi.fn().mockReturnValue(true),
      fetchFile: vi.fn(),
    });
    mockDownloadFiles.mockResolvedValue(['/tmp/part.stl']);

    const result = await downloadModel('model-123', 'testprovider', {
      outputDir: '/tmp',
      formats: ['stl'],
    });

    // downloadFiles should only receive the stl file
    const calledFiles = mockDownloadFiles.mock.calls[0][0] as ModelFile[];
    expect(calledFiles).toHaveLength(1);
    expect(calledFiles[0].format).toBe('stl');
  });

  it('should throw if provider is not found', async () => {
    await expect(downloadModel('model-123', 'nonexistent')).rejects.toThrow('Unknown source');
  });

  it('should throw if provider is browse-only', async () => {
    mockProviders.push({
      name: 'browseonly',
      isBrowseOnly: true,
      search: vi.fn().mockResolvedValue([]),
      getFiles: vi.fn().mockResolvedValue([]),
      resolveUrl: vi.fn().mockReturnValue(null),
      isAvailable: vi.fn().mockReturnValue(true),
      fetchFile: vi.fn(),
    });

    await expect(downloadModel('model-123', 'browseonly')).rejects.toThrow('browse-only');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/download.test.ts`
Expected: FAIL — `src/lib/download.js` does not exist.

**Step 3: Write the implementation**

Create `src/lib/download.ts`:

```typescript
import { getRegistry } from '../providers/index.js';
import { ProviderError } from '../errors.js';
import { downloadFiles } from '../download/manager.js';

export interface DownloadOptions {
  outputDir?: string;
  formats?: string[];
}

export interface DownloadResult {
  files: string[];
}

export async function downloadModel(
  modelId: string,
  source: string,
  options?: DownloadOptions,
): Promise<DownloadResult> {
  const registry = getRegistry();
  const provider = registry.getProvider(source);

  if (!provider) {
    throw new ProviderError(source, `Unknown source: ${source}`);
  }

  if (provider.isBrowseOnly) {
    throw new ProviderError(source, `${source} is browse-only and does not support downloads`);
  }

  let files = await provider.getFiles(modelId);

  if (options?.formats?.length) {
    const fmts = new Set(options.formats.map(f => f.toLowerCase().replace(/^\./, '')));
    files = files.filter(f => fmts.has(f.format.toLowerCase()));
  }

  const downloaded = await downloadFiles(files, options?.outputDir, (url) => provider.fetchFile(url));

  return { files: downloaded };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/download.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/download.ts tests/unit/lib/download.test.ts
git commit -m "feat: add downloadModel library function"
```

---

### Task 5: Library barrel export + package.json exports

**Files:**
- Create: `src/lib/index.ts`
- Modify: `package.json` — add `exports` field
- Modify: `tsup.config.ts` — add `src/lib/index.ts` entry

**Step 1: Create the barrel export**

Create `src/lib/index.ts`:

```typescript
export { searchModels, type SearchModelsOptions, type SearchModelsResult } from './search.js';
export { listFiles } from './files.js';
export { downloadModel, type DownloadOptions, type DownloadResult } from './download.js';
export { listSources, type SourceInfo } from './sources.js';
export type { SearchResult, ModelFile } from '../providers/types.js';
```

**Step 2: Update `tsup.config.ts`**

Modify `tsup.config.ts` to have multiple entry points with per-entry config. The CLI needs the shebang banner, the library does not:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node20',
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: { lib: 'src/lib/index.ts' },
    format: ['esm'],
    target: 'node20',
    clean: false,
    splitting: false,
    sourcemap: true,
    dts: true,
  },
]);
```

**Step 3: Update `package.json`**

Add the `exports` field alongside the existing `"main"` behavior:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./lib": {
      "types": "./dist/lib.d.ts",
      "import": "./dist/lib.js"
    }
  }
}
```

**Step 4: Build and verify**

Run: `npm run build`
Expected: `dist/index.js` and `dist/lib.js` (and `dist/lib.d.ts`) are generated.

Run: `npm run lint && npm run typecheck && npm test`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/lib/index.ts tsup.config.ts package.json
git commit -m "feat: add library barrel export and package.json exports"
```

---

### Task 6: Refactor CLI commands to use library layer

**Files:**
- Modify: `src/commands/search.ts` — replace inline logic with `searchModels()` call
- Modify: `src/commands/download.ts` — use `listFiles()` (optionally)

**Step 1: Refactor `src/commands/search.ts`**

Remove the `deduplicateResults` function (now in lib). Replace the search logic:

```typescript
import { Command } from 'commander';
import { searchModels } from '../lib/search.js';
import { getRegistry } from '../providers/index.js';
import { formatResultsTable } from '../ui/table.js';
import { selectModel, selectFiles } from '../ui/prompts.js';
import { downloadFiles } from '../download/manager.js';
import { createSpinner } from '../ui/spinner.js';
import { logger } from '../logger.js';
import type { SearchResult } from '../providers/types.js';

export function createSearchCommand(): Command {
  return new Command('search')
    .description('Search for 3D models across multiple sources')
    .argument('<query>', 'Search query')
    .option('-i, --interactive', 'Interactive mode: select and download files')
    .option('-s, --source <sources...>', 'Only search specific sources (thangs, printables, thingiverse, sketchfab, myminifactory, cults3d)')
    .option('--sort <order>', 'Sort order: relevant, popular, newest', 'relevant')
    .option('-n, --limit <count>', 'Max results per source', '20')
    .option('-o, --output <dir>', 'Download directory')
    .option('-f, --format <formats...>', 'Preferred file formats (e.g. stl 3mf)')
    .action(async (query: string, options: {
      interactive?: boolean;
      source?: string[];
      sort?: string;
      limit?: string;
      output?: string;
      format?: string[];
    }) => {
      const registry = getRegistry();
      const available = registry.getAvailable();

      if (available.length === 0) {
        logger.error('No providers available. Configure at least one source.');
        logger.info('Thangs and Printables work without configuration.');
        process.exit(1);
      }

      const spinner = createSpinner(`Searching for "${query}"...`);
      spinner.start();

      const { results: deduplicated, errors } = await searchModels(query, {
        limit: parseInt(options.limit ?? '20', 10),
        sort: (options.sort ?? 'relevant') as 'relevant' | 'popular' | 'newest',
        sources: options.source,
      });

      spinner.stop();

      if (errors.length > 0) {
        for (const e of errors) {
          logger.warn(`${e.provider}: ${e.message}`);
        }
      }

      if (deduplicated.length === 0) {
        logger.info('No results found.');
        return;
      }

      if (options.interactive) {
        await interactiveMode(deduplicated, options.output, options.format);
      } else {
        console.log();
        console.log(formatResultsTable(deduplicated));
        console.log();
        console.log(`${deduplicated.length} results from ${available.length} source(s)`);

        // Hint about unconfigured sources
        const all = registry.getAll();
        const unconfigured = all.filter(p => !p.isAvailable());
        if (unconfigured.length > 0) {
          const names = unconfigured.map(p => p.name).join(', ');
          logger.info(`Tip: ${names} not searched (API key not configured). Run: thingfinder config set <source>.apiKey <key>`);
        }
      }
    });
}

async function interactiveMode(results: SearchResult[], outputDir?: string, formats?: string[]) {
  const selected = await selectModel(results);
  if (!selected) return;

  const registry = getRegistry();
  const provider = registry.getProvider(selected.source);
  if (!provider) {
    logger.error(`Provider ${selected.source} not found`);
    return;
  }

  if (provider.isBrowseOnly) {
    logger.info(`Opening ${selected.url} in browser...`);
    const { exec } = await import('node:child_process');
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} ${JSON.stringify(selected.url)}`);
    return;
  }

  const spinner = createSpinner('Fetching file list...');
  spinner.start();
  let files = await provider.getFiles(selected.id);
  spinner.stop();

  if (formats?.length) {
    const fmts = new Set(formats.map(f => f.toLowerCase().replace(/^\./, '')));
    files = files.filter(f => fmts.has(f.format.toLowerCase()));
  }

  if (files.length === 0) {
    logger.info('No downloadable files found for this model.');
    return;
  }

  const selectedFiles = await selectFiles(files);
  if (selectedFiles.length === 0) {
    logger.info('No files selected.');
    return;
  }

  const downloaded = await downloadFiles(selectedFiles, outputDir, (u) => provider.fetchFile(u));
  console.log();
  logger.info(`Downloaded ${downloaded.length} file(s)`);
}
```

Note: `interactiveMode` stays in the command layer because it uses UI prompts. Only the non-interactive search path is refactored to use the library.

**Step 2: Run all tests**

Run: `npm run lint && npm run typecheck && npm test`
Expected: All pass. Existing `tests/unit/commands/search.test.ts` should still pass.

**Step 3: Smoke test**

Run: `npm run dev -- search "raspberry pi mount" -n 5`
Expected: Same output as before.

**Step 4: Commit**

```bash
git add src/commands/search.ts
git commit -m "refactor: use searchModels library function in search command"
```

---

### Task 7: Install MCP SDK + zod

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install dependencies**

Run: `npm install @modelcontextprotocol/sdk zod`

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS (no type conflicts).

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @modelcontextprotocol/sdk and zod dependencies"
```

---

### Task 8: MCP server with `list_sources` tool

Start with one tool, get the server scaffold working.

**Files:**
- Create: `src/mcp/server.ts`
- Create: `src/mcp/index.ts`
- Create: `tests/unit/mcp/server.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/mcp/server.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/providers/index.js', () => {
  const { ProviderRegistry } = await vi.importActual<typeof import('../../../src/providers/registry.js')>('../../../src/providers/registry.js');
  const registry = new ProviderRegistry();
  registry.register({
    name: 'thangs',
    search: vi.fn().mockResolvedValue([]),
    getFiles: vi.fn().mockResolvedValue([]),
    resolveUrl: vi.fn().mockReturnValue(null),
    isAvailable: vi.fn().mockReturnValue(true),
    fetchFile: vi.fn(),
  });
  registry.register({
    name: 'cults3d',
    isBrowseOnly: true,
    search: vi.fn().mockResolvedValue([]),
    getFiles: vi.fn().mockResolvedValue([]),
    resolveUrl: vi.fn().mockReturnValue(null),
    isAvailable: vi.fn().mockReturnValue(false),
    fetchFile: vi.fn(),
  });
  return { getRegistry: () => registry };
});

import { createServer } from '../../../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

describe('MCP Server', () => {
  it('should handle list_sources tool', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({ name: 'list_sources', arguments: {} });

    expect(result.content).toHaveLength(1);
    const content = result.content[0];
    expect(content).toHaveProperty('type', 'text');
    const parsed = JSON.parse((content as { type: 'text'; text: string }).text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ name: 'thangs', available: true, isBrowseOnly: false });
    expect(parsed[1]).toEqual({ name: 'cults3d', available: false, isBrowseOnly: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/mcp/server.test.ts`
Expected: FAIL — `src/mcp/server.js` does not exist.

**Step 3: Write the implementation**

Create `src/mcp/server.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listSources } from '../lib/sources.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'thingfinder',
    version: '0.1.0',
  });

  server.registerTool(
    'list_sources',
    {
      title: 'List Sources',
      description: 'List all available 3D model sources and their status',
    },
    async () => {
      const sources = listSources();
      return {
        content: [{ type: 'text', text: JSON.stringify(sources, null, 2) }],
      };
    },
  );

  return server;
}
```

Create `src/mcp/index.ts`:

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/mcp/server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mcp/server.ts src/mcp/index.ts tests/unit/mcp/server.test.ts
git commit -m "feat: add MCP server with list_sources tool"
```

---

### Task 9: Add `search_models` MCP tool

**Files:**
- Modify: `src/mcp/server.ts`
- Modify: `tests/unit/mcp/server.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/mcp/server.test.ts`:

```typescript
  it('should handle search_models tool', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: 'search_models',
      arguments: { query: 'raspberry pi' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0];
    expect(content).toHaveProperty('type', 'text');
    const parsed = JSON.parse((content as { type: 'text'; text: string }).text);
    expect(parsed).toHaveProperty('results');
    expect(parsed).toHaveProperty('errors');
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/mcp/server.test.ts`
Expected: FAIL — tool not found.

**Step 3: Add the tool to `src/mcp/server.ts`**

Import zod and add the tool registration after `list_sources`:

```typescript
import { z } from 'zod';
import { searchModels } from '../lib/search.js';

// Inside createServer(), after list_sources:
server.registerTool(
  'search_models',
  {
    title: 'Search 3D Models',
    description: 'Search for 3D printable models across multiple sources (Thangs, Printables, Thingiverse, Sketchfab, MyMiniFactory, Cults3D)',
    inputSchema: z.object({
      query: z.string().describe('Search query (e.g. "raspberry pi case", "cable clip")'),
      source: z.string().optional().describe('Limit to a specific source (thangs, printables, thingiverse, sketchfab, myminifactory, cults3d)'),
      sort: z.enum(['relevant', 'popular', 'newest']).optional().describe('Sort order. Default: relevant'),
      limit: z.number().optional().describe('Max results per source. Default: 20'),
    }),
  },
  async ({ query, source, sort, limit }) => {
    const result = await searchModels(query, {
      sources: source ? [source] : undefined,
      sort,
      limit,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/mcp/server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mcp/server.ts tests/unit/mcp/server.test.ts
git commit -m "feat: add search_models MCP tool"
```

---

### Task 10: Add `list_files` and `download_files` MCP tools

**Files:**
- Modify: `src/mcp/server.ts`
- Modify: `tests/unit/mcp/server.test.ts`

**Step 1: Write the failing tests**

Add to `tests/unit/mcp/server.test.ts`:

```typescript
  it('should handle list_files tool', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: 'list_files',
      arguments: { modelId: '123', source: 'thangs' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0];
    expect(content).toHaveProperty('type', 'text');
    // The mock provider returns [], which is valid
    const parsed = JSON.parse((content as { type: 'text'; text: string }).text);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('should handle list_files for unknown source', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: 'list_files',
      arguments: { modelId: '123', source: 'nonexistent' },
    });

    expect(result.isError).toBe(true);
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/mcp/server.test.ts`
Expected: FAIL — tools not found.

**Step 3: Add both tools to `src/mcp/server.ts`**

```typescript
import { listFiles } from '../lib/files.js';
import { downloadModel } from '../lib/download.js';

// Inside createServer(), after search_models:

server.registerTool(
  'list_files',
  {
    title: 'List Model Files',
    description: 'List downloadable files for a specific 3D model. Use after search_models to inspect what files are available before downloading.',
    inputSchema: z.object({
      modelId: z.string().describe('Model ID from search results'),
      source: z.string().describe('Source provider name (e.g. "thangs", "printables")'),
    }),
  },
  async ({ modelId, source }) => {
    try {
      const files = await listFiles(modelId, source);
      return {
        content: [{ type: 'text', text: JSON.stringify(files, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: (error as Error).message }],
      };
    }
  },
);

server.registerTool(
  'download_files',
  {
    title: 'Download Model Files',
    description: 'Download files for a 3D model to the local filesystem. Returns the paths of downloaded files.',
    inputSchema: z.object({
      modelId: z.string().describe('Model ID from search results'),
      source: z.string().describe('Source provider name'),
      outputDir: z.string().optional().describe('Directory to save files. Default: configured download dir or current dir'),
      formats: z.array(z.string()).optional().describe('Only download these formats (e.g. ["stl", "3mf"])'),
    }),
  },
  async ({ modelId, source, outputDir, formats }) => {
    try {
      const result = await downloadModel(modelId, source, { outputDir, formats });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: (error as Error).message }],
      };
    }
  },
);
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/mcp/server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mcp/server.ts tests/unit/mcp/server.test.ts
git commit -m "feat: add list_files and download_files MCP tools"
```

---

### Task 11: Build configuration + bin entry for MCP server

**Files:**
- Modify: `tsup.config.ts` — add MCP entry point
- Modify: `package.json` — add `thingfinder-mcp` bin entry

**Step 1: Update `tsup.config.ts`**

Add a third config entry for the MCP server (needs shebang, no dts):

```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node20',
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: { lib: 'src/lib/index.ts' },
    format: ['esm'],
    target: 'node20',
    clean: false,
    splitting: false,
    sourcemap: true,
    dts: true,
  },
  {
    entry: { mcp: 'src/mcp/index.ts' },
    format: ['esm'],
    target: 'node20',
    clean: false,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
```

**Step 2: Update `package.json`**

Add the `thingfinder-mcp` bin entry:

```json
{
  "bin": {
    "thingfinder": "./dist/index.js",
    "thingfinder-mcp": "./dist/mcp.js"
  }
}
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: `dist/index.js`, `dist/lib.js`, `dist/lib.d.ts`, `dist/mcp.js` all generated.

Run: `npm run lint && npm run typecheck && npm test`
Expected: All pass.

**Step 4: Smoke test MCP server**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/mcp.js`
Expected: JSON response with server capabilities (tools listed).

**Step 5: Commit**

```bash
git add tsup.config.ts package.json
git commit -m "feat: add MCP server build and bin entry"
```

---

### Task 12: Full verification + smoke test

**Step 1: Run full verification suite**

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: All pass, zero errors.

**Step 2: CLI smoke test**

Run: `node dist/index.js search "battery holder" -n 3`
Expected: Results table as before.

**Step 3: MCP smoke test**

Test `list_sources` via JSON-RPC over stdin:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_sources","arguments":{}}}\n' | node dist/mcp.js
```

Expected: JSON response containing the sources list.

**Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "chore: final verification and fixups"
```
