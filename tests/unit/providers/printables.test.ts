import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrintablesProvider } from '../../../src/providers/printables.js';
import searchFixture from '../../fixtures/printables-search.json';
import detailFixture from '../../fixtures/printables-detail.json';
import downloadFixture from '../../fixtures/printables-download.json';

vi.mock('../../../src/http/client.js', () => {
  return {
    HttpClient: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      post: vi.fn(),
      fetchRaw: vi.fn(),
    })),
  };
});

describe('PrintablesProvider', () => {
  let provider: PrintablesProvider;

  beforeEach(() => {
    provider = new PrintablesProvider();
  });

  it('should have the correct name', () => {
    expect(provider.name).toBe('printables');
  });

  it('should always be available', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  describe('resolveUrl', () => {
    it('should resolve printables.com model URLs', () => {
      expect(provider.resolveUrl('https://www.printables.com/model/3161-3d-benchy')).toBe('3161');
    });

    it('should resolve URLs without slug', () => {
      expect(provider.resolveUrl('https://printables.com/model/3161')).toBe('3161');
    });

    it('should return null for non-printables URLs', () => {
      expect(provider.resolveUrl('https://thingiverse.com/thing:123')).toBeNull();
    });
  });

  describe('search', () => {
    it('should parse search results correctly', async () => {
      const client = (provider as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client;
      client.post.mockResolvedValue(searchFixture);

      const results = await provider.search({ query: 'benchy' });

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: '3161',
        name: '3D BENCHY',
        creator: 'Prusa Research',
        source: 'printables',
        likes: 20710,
        downloads: 476309,
      });
      expect(results[0].url).toContain('printables.com/model/3161');
    });
  });

  describe('getFiles', () => {
    it('should return file list with download URLs', async () => {
      const client = (provider as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client;
      client.post
        .mockResolvedValueOnce(detailFixture)
        .mockResolvedValueOnce(downloadFixture);

      const files = await provider.getFiles('3161');

      expect(files).toHaveLength(2);
      expect(files[0]).toMatchObject({
        id: '49068',
        name: '3dbenchy.stl',
        format: 'stl',
        size: 11285384,
      });
      expect(files[0].url).toContain('files.printables.com');
    });
  });
});
