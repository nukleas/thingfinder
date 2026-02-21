import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MyMiniFactoryProvider } from '../../../src/providers/myminifactory.js';

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

describe('MyMiniFactoryProvider', () => {
  let provider: MyMiniFactoryProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    provider = new MyMiniFactoryProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have the correct name', () => {
    expect(provider.name).toBe('myminifactory');
  });

  describe('isAvailable', () => {
    it('should be unavailable without API key', () => {
      expect(provider.isAvailable()).toBe(false);
    });

    it('should be available with env var API key', () => {
      process.env.THINGFINDER_MYMINIFACTORY_API_KEY = 'test-key';
      provider = new MyMiniFactoryProvider();
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('resolveUrl', () => {
    it('should resolve myminifactory.com object URLs', () => {
      expect(provider.resolveUrl('https://www.myminifactory.com/object/3d-print-benchy-12345')).toBe('12345');
    });

    it('should return null for non-myminifactory URLs', () => {
      expect(provider.resolveUrl('https://printables.com/model/123')).toBeNull();
    });
  });
});
