import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PolyhavenProvider } from '../../../src/providers/polyhaven.js';

const mockFetch = vi.fn();

vi.mock('../../../src/http/transport.js', () => ({
  NativeTransport: class { fetch = mockFetch; },
  ImpitTransport: class { fetch = mockFetch; },
}));

const assetsFixture = {
  ArmChair_01: {
    name: 'Arm Chair 01',
    tags: ['chair', 'vintage'],
    categories: ['furniture'],
    authors: { 'Kirill Sannikov': 'All' },
    date_published: 1585605600,
  },
  crate: {
    name: 'Crate',
    tags: ['box'],
    categories: ['props'],
    authors: ['Some Author'],
    date_published: 1500000000,
  },
};

const filesFixture = {
  blend: {
    '100mb': {
      blend: { size: 1048576, url: 'https://dl.polyhaven.org/file/ph-assets/Models/blend/100mb/ArmChair_01.blend' },
    },
  },
  fbx: {
    '50mb': {
      fbx: { size: 524288, url: 'https://dl.polyhaven.org/file/ph-assets/Models/fbx/50mb/ArmChair_01.fbx' },
    },
  },
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

describe('PolyhavenProvider', () => {
  let provider: PolyhavenProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new PolyhavenProvider();
  });

  it('should have the correct name and be available', () => {
    expect(provider.name).toBe('polyhaven');
    expect(provider.isAvailable()).toBe(true);
  });

  describe('resolveUrl', () => {
    it('should resolve polyhaven.com/a/<id> URLs', () => {
      expect(provider.resolveUrl('https://polyhaven.com/a/ArmChair_01')).toBe('ArmChair_01');
    });

    it('should return null for other URLs', () => {
      expect(provider.resolveUrl('https://printables.com/model/1')).toBeNull();
    });
  });

  describe('search', () => {
    it('should filter by query and map results', async () => {
      mockFetch.mockResolvedValue(jsonResponse(assetsFixture));

      const results = await provider.search({ query: 'chair' });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'ArmChair_01',
        name: 'Arm Chair 01',
        creator: 'Kirill Sannikov',
        url: 'https://polyhaven.com/a/ArmChair_01',
        source: 'polyhaven',
        createdAt: new Date(1585605600 * 1000).toISOString(),
      });
    });

    it('should join array authors', async () => {
      mockFetch.mockResolvedValue(jsonResponse(assetsFixture));
      const results = await provider.search({ query: 'crate' });
      expect(results[0].creator).toBe('Some Author');
    });
  });

  describe('getFiles', () => {
    it('should flatten the files tree into model files', async () => {
      mockFetch.mockResolvedValue(jsonResponse(filesFixture));

      const files = await provider.getFiles('ArmChair_01');

      expect(files).toHaveLength(2);
      expect(files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'ArmChair_01_blend_100mb.blend',
            format: 'blend',
            size: 1048576,
            url: expect.stringContaining('dl.polyhaven.org'),
          }),
          expect.objectContaining({ format: 'fbx' }),
        ]),
      );
    });
  });
});
