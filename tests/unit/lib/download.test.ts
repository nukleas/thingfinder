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

    await downloadModel('model-123', 'testprovider', {
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
