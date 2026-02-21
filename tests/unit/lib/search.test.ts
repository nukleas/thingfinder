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
