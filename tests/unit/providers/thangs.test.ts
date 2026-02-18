import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThangsProvider } from '../../../src/providers/thangs.js';
import thangsFixture from '../../fixtures/thangs-search.json';
import thangsDetailFixture from '../../fixtures/thangs-model-detail.json';

const mockFetch = vi.fn();

vi.mock('impit', () => ({
  Impit: vi.fn().mockImplementation(() => ({
    fetch: mockFetch,
  })),
}));

describe('ThangsProvider', () => {
  let provider: ThangsProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new ThangsProvider();
  });

  it('should have the correct name', () => {
    expect(provider.name).toBe('thangs');
  });

  it('should always be available (no auth required)', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  describe('resolveUrl', () => {
    it('should resolve thangs.com/m/123 URLs', () => {
      expect(provider.resolveUrl('https://thangs.com/m/1234567')).toBe('1234567');
    });

    it('should resolve designer URLs', () => {
      const url = 'https://thangs.com/designer/SomeUser/3d-model/Cool-Model-1234567';
      expect(provider.resolveUrl(url)).toBe('1234567');
    });

    it('should return null for non-thangs URLs', () => {
      expect(provider.resolveUrl('https://thingiverse.com/thing:123')).toBeNull();
    });
  });

  describe('search', () => {
    it('should parse search results correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(thangsFixture),
      });

      const results = await provider.search({ query: 'benchy' });

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: '1234567',
        name: '3DBenchy - The jolly 3D printing torture-test',
        creator: 'CreativeTools',
        url: 'https://thangs.com/m/1234567',
        thumbnailUrl: 'https://storage.googleapis.com/thangs-thumbnails/production/benchy.png',
        likes: 5000,
        downloads: 120000,
        source: 'thangs',
        createdAt: '2020-01-15T10:00:00.000Z',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('thangs.com/api/search/v5/search-by-text'),
        expect.objectContaining({ headers: { Accept: 'application/json' } }),
      );
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(provider.search({ query: 'test' })).rejects.toThrow('HTTP 403');
    });
  });

  describe('getFiles', () => {
    it('should return files from model detail parts', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(thangsDetailFixture),
      });

      const files = await provider.getFiles('56337');

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        name: '3dBenchy.stl',
        format: 'stl',
        size: 11257784,
      });
      expect(files[0].url).toContain('storage.googleapis.com/thangs-thumbnails/production/');
      expect(files[0].url).toContain('3dBenchy.stl');
    });

    it('should return empty array if model detail fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const files = await provider.getFiles('99999');
      expect(files).toEqual([]);
    });
  });
});
