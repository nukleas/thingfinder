import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolypizzaProvider } from '../../../src/providers/polypizza.js';

const clients: { options: any }[] = [];
const mockGet = vi.fn();

vi.mock('../../../src/http/client.js', () => ({
  HttpClient: class {
    get = mockGet;
    fetchRaw = vi.fn().mockResolvedValue({ ok: true });
    constructor(public options: any) {
      clients.push(this);
    }
  },
}));

vi.mock('../../../src/config/store.js', () => ({
  getConfigValue: vi.fn().mockReturnValue(''),
}));

// Trimmed from the official v1.1 spec example.
const searchResponse = {
  total: 77,
  results: [
    {
      ID: 'BwwnUrWGmV',
      Title: 'Police Car',
      Thumbnail: 'https://static.poly.pizza/179e43ce.webp',
      Download: 'https://static.poly.pizza/179e43ce.glb',
      Creator: { Username: 'Quaternius' },
    },
  ],
};

describe('PolypizzaProvider', () => {
  let provider: PolypizzaProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    clients.length = 0;
    mockGet.mockReset();
    process.env = { ...originalEnv };
    delete process.env.THINGFINDER_POLYPIZZA_API_KEY;
    provider = new PolypizzaProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('is unavailable without an API key and throws AuthError on search', async () => {
    expect(provider.isAvailable()).toBe(false);
    await expect(provider.search({ query: 'chair' })).rejects.toThrow(/polypizza/);
  });

  describe('with an API key', () => {
    beforeEach(() => {
      process.env.THINGFINDER_POLYPIZZA_API_KEY = 'testkey';
    });

    it('searches v1.1 with the key in a header and Capitalized, 0-based paging', async () => {
      mockGet.mockResolvedValue(searchResponse);
      const results = await provider.search({ query: 'police car', pageSize: 50, page: 2 });

      expect(clients[0].options.baseUrl).toBe('https://api.poly.pizza/v1.1');
      expect(clients[0].options.headers['x-auth-token']).toBe('testkey');
      expect(mockGet).toHaveBeenCalledWith('/search/police%20car', { Limit: '32', Page: '1' });
      expect(results).toEqual([
        expect.objectContaining({
          id: 'BwwnUrWGmV',
          name: 'Police Car',
          creator: 'Quaternius',
          url: 'https://poly.pizza/m/BwwnUrWGmV',
          source: 'polypizza',
        }),
      ]);
    });

    it('lists the model GLB from /model/{id}', async () => {
      mockGet.mockResolvedValue(searchResponse.results[0]);
      expect(await provider.getFiles('BwwnUrWGmV')).toEqual([
        { id: 'BwwnUrWGmV', name: 'Police Car.glb', url: 'https://static.poly.pizza/179e43ce.glb', format: 'glb' },
      ]);
      expect(mockGet).toHaveBeenCalledWith('/model/BwwnUrWGmV');
    });

    it('sends the key to the poly.pizza CDN but never to other hosts', async () => {
      await provider.fetchFile('https://static.poly.pizza/x.glb');
      await provider.fetchFile('https://evil.example/poly.pizza/x.glb');

      expect(clients[0].options.headers['x-auth-token']).toBe('testkey');
      expect(clients[1].options.headers).toBeUndefined();
    });
  });

  it('resolves poly.pizza/m/<id> URLs only', () => {
    expect(provider.resolveUrl('https://poly.pizza/m/BwwnUrWGmV')).toBe('BwwnUrWGmV');
    expect(provider.resolveUrl('https://poly.pizza/u/Quaternius')).toBeNull();
    expect(provider.resolveUrl('https://example.com/thing')).toBeNull();
  });
});
