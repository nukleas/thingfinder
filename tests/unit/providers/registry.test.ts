import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../../src/providers/registry.js';
import type { SourceProvider, SearchResult } from '../../../src/providers/types.js';

function createMockProvider(name: string, available = true, results: SearchResult[] = []): SourceProvider {
  return {
    name,
    search: vi.fn().mockResolvedValue(results),
    getFiles: vi.fn().mockResolvedValue([]),
    resolveUrl: vi.fn().mockReturnValue(null),
    isAvailable: vi.fn().mockReturnValue(available),
  };
}

const mockResult = (source: string, id: string): SearchResult => ({
  id,
  name: `Model ${id}`,
  creator: 'TestUser',
  url: `https://example.com/${id}`,
  likes: 10,
  downloads: 100,
  source,
});

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should register and retrieve providers', () => {
    const provider = createMockProvider('test');
    registry.register(provider);
    expect(registry.getProvider('test')).toBe(provider);
  });

  it('should return undefined for unknown providers', () => {
    expect(registry.getProvider('unknown')).toBeUndefined();
  });

  it('should filter available providers', () => {
    registry.register(createMockProvider('available', true));
    registry.register(createMockProvider('unavailable', false));
    const available = registry.getAvailable();
    expect(available).toHaveLength(1);
    expect(available[0].name).toBe('available');
  });

  it('should search all available providers in parallel', async () => {
    const p1 = createMockProvider('source1', true, [mockResult('source1', '1')]);
    const p2 = createMockProvider('source2', true, [mockResult('source2', '2')]);
    registry.register(p1);
    registry.register(p2);

    const { results, errors } = await registry.searchAll({ query: 'test' });
    expect(results).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(p1.search).toHaveBeenCalled();
    expect(p2.search).toHaveBeenCalled();
  });

  it('should handle provider failures gracefully', async () => {
    const p1 = createMockProvider('working', true, [mockResult('working', '1')]);
    const failing: SourceProvider = {
      name: 'failing',
      search: vi.fn().mockRejectedValue(new Error('[failing] Network error')),
      getFiles: vi.fn().mockResolvedValue([]),
      resolveUrl: vi.fn().mockReturnValue(null),
      isAvailable: vi.fn().mockReturnValue(true),
    };
    registry.register(p1);
    registry.register(failing);

    const { results, errors } = await registry.searchAll({ query: 'test' });
    expect(results).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  it('should filter by source when specified', async () => {
    const p1 = createMockProvider('source1', true, [mockResult('source1', '1')]);
    const p2 = createMockProvider('source2', true, [mockResult('source2', '2')]);
    registry.register(p1);
    registry.register(p2);

    const { results } = await registry.searchAll({ query: 'test' }, ['source1']);
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('source1');
  });

  it('should resolve URLs to the right provider', () => {
    const p1 = createMockProvider('source1');
    (p1.resolveUrl as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const p2 = createMockProvider('source2');
    (p2.resolveUrl as ReturnType<typeof vi.fn>).mockReturnValue('42');

    registry.register(p1);
    registry.register(p2);

    const resolved = registry.resolveUrl('https://example.com/model/42');
    expect(resolved).not.toBeNull();
    expect(resolved!.provider.name).toBe('source2');
    expect(resolved!.modelId).toBe('42');
  });
});
