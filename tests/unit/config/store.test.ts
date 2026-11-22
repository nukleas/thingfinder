import { describe, it, expect, vi, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'tf-config-'));

// Real conf + real schema validation, pointed at a throwaway directory.
vi.mock('conf', async (importOriginal) => {
  const { default: RealConf } = await importOriginal<typeof import('conf')>();
  return {
    default: class extends RealConf<any> {
      constructor(opts: any) {
        super({ ...opts, cwd: dir });
      }
    },
  };
});

const { setConfigValue, getConfigNumber, getConfigValue } = await import('../../../src/config/store.js');
const { isSecretKey } = await import('../../../src/config/schema.js');

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('config store', () => {
  it('stores numeric keys as numbers so schema validation passes', () => {
    setConfigValue('yeggi.minIntervalSeconds', '60');
    expect(getConfigNumber('yeggi.minIntervalSeconds')).toBe(60);
  });

  it('rejects non-numeric values for numeric keys', () => {
    expect(() => setConfigValue('yeggi.cooldownMinutes', 'soon')).toThrow(/non-negative number/);
    expect(() => setConfigValue('yeggi.cooldownMinutes', '-5')).toThrow(/non-negative number/);
  });

  it('stores string and list keys unchanged', () => {
    setConfigValue('flaresolverr.url', 'http://localhost:8191/v1');
    setConfigValue('preferredFormats', 'stl, 3mf');
    expect(getConfigValue('flaresolverr.url')).toBe('http://localhost:8191/v1');
    expect(getConfigValue('preferredFormats')).toEqual(['stl', '3mf']);
  });

  it('treats API keys and clearance cookies as secrets', () => {
    expect(isSecretKey('thingiverse.apiKey')).toBe(true);
    expect(isSecretKey('yeggi.cfClearance')).toBe(true);
    expect(isSecretKey('flaresolverr.url')).toBe(false);
  });
});
