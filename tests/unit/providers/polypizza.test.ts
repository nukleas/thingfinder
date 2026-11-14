import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolypizzaProvider } from '../../../src/providers/polypizza.js';

vi.mock('../../../src/http/client.js', () => ({
  HttpClient: class {
    get = vi.fn();
    post = vi.fn();
    fetchRaw = vi.fn();
  },
}));

vi.mock('../../../src/config/store.js', () => ({
  getConfigValue: vi.fn().mockReturnValue(''),
}));

describe('PolypizzaProvider', () => {
  let provider: PolypizzaProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.THINGFINDER_POLYPIZZA_API_KEY;
    provider = new PolypizzaProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have the correct name', () => {
    expect(provider.name).toBe('polypizza');
  });

  it('should be unavailable without API key (API returns 401 without one)', () => {
    expect(provider.isAvailable()).toBe(false);
  });

  it('should be available with env var API key', () => {
    process.env.THINGFINDER_POLYPIZZA_API_KEY = 'testkey';
    expect(provider.isAvailable()).toBe(true);
  });

  describe('resolveUrl', () => {
    it('should resolve poly.pizza/<id> URLs', () => {
      expect(provider.resolveUrl('https://poly.pizza/m1ab2c3d4e')).toBe('m1ab2c3d4e');
    });

    it('should return null for other URLs', () => {
      expect(provider.resolveUrl('https://example.com/thing')).toBeNull();
    });
  });

  it('should throw AuthError on search without key', async () => {
    await expect(provider.search({ query: 'chair' })).rejects.toThrow(/polypizza/);
  });
});
