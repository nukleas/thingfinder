import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SketchfabProvider } from '../../../src/providers/sketchfab.js';

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

describe('SketchfabProvider', () => {
  let provider: SketchfabProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    provider = new SketchfabProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have the correct name', () => {
    expect(provider.name).toBe('sketchfab');
  });

  describe('isAvailable', () => {
    it('should be unavailable without API key', () => {
      expect(provider.isAvailable()).toBe(false);
    });

    it('should be available with env var API key', () => {
      process.env.THINGFINDER_SKETCHFAB_API_KEY = 'test-token';
      provider = new SketchfabProvider();
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('resolveUrl', () => {
    it('should resolve sketchfab.com model URLs', () => {
      expect(provider.resolveUrl('https://sketchfab.com/3d-models/benchy-abc123def456')).toBe('abc123def456');
    });

    it('should resolve short sketchfab URLs', () => {
      expect(provider.resolveUrl('https://sketchfab.com/models/abc123def456')).toBe('abc123def456');
    });

    it('should return null for non-sketchfab URLs', () => {
      expect(provider.resolveUrl('https://printables.com/model/123')).toBeNull();
    });
  });
});
