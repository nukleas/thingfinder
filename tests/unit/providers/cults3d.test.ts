import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cults3dProvider } from '../../../src/providers/cults3d.js';

vi.mock('../../../src/http/client.js', () => {
  return {
    HttpClient: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      post: vi.fn(),
      fetchRaw: vi.fn(),
    })),
  };
});

vi.mock('../../../src/config/store.js', () => ({
  getConfigValue: vi.fn().mockReturnValue(''),
}));

describe('Cults3dProvider', () => {
  let provider: Cults3dProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    provider = new Cults3dProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have the correct name', () => {
    expect(provider.name).toBe('cults3d');
  });

  describe('isAvailable', () => {
    it('should be unavailable without API key', () => {
      expect(provider.isAvailable()).toBe(false);
    });

    it('should be available with env var API key', () => {
      process.env.THINGFINDER_CULTS3D_API_KEY = 'user:secretkey';
      provider = new Cults3dProvider();
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('resolveUrl', () => {
    it('should resolve cults3d.com model URLs', () => {
      expect(provider.resolveUrl('https://cults3d.com/en/3d-model/art/dragon-figurine')).toBe('dragon-figurine');
    });

    it('should resolve cults3d.com URLs without locale', () => {
      expect(provider.resolveUrl('https://cults3d.com/3d-model/art/dragon-figurine')).toBe('dragon-figurine');
    });

    it('should return null for non-cults3d URLs', () => {
      expect(provider.resolveUrl('https://printables.com/model/123')).toBeNull();
    });
  });

  describe('isBrowseOnly', () => {
    it('should return true', () => {
      expect(provider.isBrowseOnly).toBe(true);
    });
  });
});
