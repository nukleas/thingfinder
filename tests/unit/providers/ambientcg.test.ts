import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AmbientcgProvider } from '../../../src/providers/ambientcg.js';

const mockFetch = vi.fn();

vi.mock('../../../src/http/transport.js', () => ({
  NativeTransport: class { fetch = mockFetch; },
  ImpitTransport: class { fetch = mockFetch; },
}));

const fixture = {
  foundAssets: [
    {
      assetId: 'WoodFloor029',
      tags: ['wood', 'floor'],
      category: 'Floor',
      creationDate: '2020-01-01',
      downloadCount: 1234,
      previewImage: 'https://ambientcg.com/get?id=WoodFloor029-Image_Preview.jpg',
      downloadFolders: {
        default: {
          downloadFiletypes: {
            ZIP: { downloadLink: 'https://dl.ambientcg.com/files/WoodFloor029/WoodFloor029.zip', size: 100 },
            '7Z': { downloadLink: 'https://dl.ambientcg.com/files/WoodFloor029/WoodFloor029.7z', size: 90 },
          },
        },
      },
    },
  ],
};

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    json: () => Promise.resolve(data),
    body: null,
  };
}

describe('AmbientcgProvider', () => {
  let provider: AmbientcgProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new AmbientcgProvider();
  });

  it('should have the correct name and be available', () => {
    expect(provider.name).toBe('ambientcg');
    expect(provider.isAvailable()).toBe(true);
  });

  describe('resolveUrl', () => {
    it('should resolve ?id= URLs', () => {
      expect(provider.resolveUrl('https://ambientcg.com/get?id=WoodFloor029')).toBe('WoodFloor029');
    });

    it('should resolve legacy hash URLs', () => {
      expect(provider.resolveUrl('https://ambientcg.com/get#WoodFloor029')).toBe('WoodFloor029');
    });

    it('should return null for other URLs', () => {
      expect(provider.resolveUrl('https://polyhaven.com/a/crate')).toBeNull();
    });
  });

  describe('search', () => {
    it('should map foundAssets to search results', async () => {
      mockFetch.mockResolvedValue(jsonResponse(fixture));

      const results = await provider.search({ query: 'wood' });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'WoodFloor029',
        name: 'WoodFloor029',
        creator: 'AmbientCG',
        source: 'ambientcg',
        downloads: 1234,
      });
    });
  });

  describe('getFiles', () => {
    it('should flatten downloadFiletypes', async () => {
      mockFetch.mockResolvedValue(jsonResponse(fixture));

      const files = await provider.getFiles('WoodFloor029');

      expect(files).toHaveLength(2);
      expect(files[0]).toMatchObject({
        name: 'WoodFloor029.zip',
        format: 'zip',
        size: 100,
      });
    });

    it('should return empty array for unknown id', async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));
      expect(await provider.getFiles('Nope')).toEqual([]);
    });
  });
});
