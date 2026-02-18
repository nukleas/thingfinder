import { describe, it, expect } from 'vitest';
import { isValidKey, configKeys } from '../../../src/config/schema.js';

describe('Config Schema', () => {
  it('should validate known config keys', () => {
    expect(isValidKey('downloadDir')).toBe(true);
    expect(isValidKey('thingiverse.apiKey')).toBe(true);
    expect(isValidKey('preferredFormats')).toBe(true);
  });

  it('should reject unknown config keys', () => {
    expect(isValidKey('unknownKey')).toBe(false);
    expect(isValidKey('')).toBe(false);
    expect(isValidKey('foo.bar')).toBe(false);
  });

  it('should have the expected config keys', () => {
    expect(configKeys).toContain('downloadDir');
    expect(configKeys).toContain('thingiverse.apiKey');
    expect(configKeys).toContain('preferredFormats');
  });
});
