import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SourceProvider, ModelFile } from '../../../src/providers/types.js';

const mockProviders: SourceProvider[] = [];

vi.mock('../../../src/providers/index.js', async () => {
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
