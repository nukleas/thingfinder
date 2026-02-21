import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the registry before importing
vi.mock('../../../src/providers/index.js', async () => {
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
    const _registry = getRegistry();
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
