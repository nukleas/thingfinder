import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MetaSearchProvider } from '../../../src/providers/metasearch.js';
import { StlfinderProvider } from '../../../src/providers/stlfinder.js';

const mockFetch = vi.fn();
const mockConfigGet = vi.fn().mockReturnValue('');

vi.mock('../../../src/http/transport.js', () => ({
  NativeTransport: class { fetch = mockFetch; },
  ImpitTransport: class { fetch = mockFetch; },
}));

vi.mock('../../../src/config/store.js', () => ({
  getConfigValue: (...args: unknown[]) => mockConfigGet(...args),
  getConfigNumber: (...args: unknown[]) => {
    const n = Number(mockConfigGet(...args));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  },
}));

const sampleHtml = `
<html><body>
  <a href="https://www.thingiverse.com/thing:12345">Benchy 3DBenchy</a>
  <a href="https://www.printables.com/model/3161-benchy"><img alt="Benchy printable" src="x.jpg"></a>
  <a href="https://www.stlfinder.com/about">About STLFinder</a>
  <a href="/relative/link">Relative link text</a>
  <a href="https://grabcad.com/library/gear-1">   </a>
  <a href="https://thangs.com/designer/x/3d-model/Y/1">Cool Gear Model</a>
</body></html>`;

const stubParse = () => [{ url: 'https://www.printables.com/model/1-stub', title: 'Stub result' }];

describe('StlfinderProvider', () => {
  let provider: StlfinderProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockFetch.mockReset();
    mockConfigGet.mockReturnValue('');
    provider = new StlfinderProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should be browse-only and unavailable until configured', () => {
    expect(provider.name).toBe('stlfinder');
    expect(provider.isBrowseOnly).toBe(true);
    expect(provider.isAvailable()).toBe(false);
  });

  it('should become available with a FlareSolverr URL or clearance cookie', () => {
    mockConfigGet.mockImplementation((key: string) => (key === 'flaresolverr.url' ? 'http://solver/v1' : ''));
    expect(provider.isAvailable()).toBe(true);
    mockConfigGet.mockImplementation((key: string) => (key === 'stlfinder.cfClearance' ? 'abc' : ''));
    expect(provider.isAvailable()).toBe(true);
  });

  it('should throw a Cloudflare hint on 403', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: { get: () => null },
      text: () => Promise.resolve('<html>Just a moment...</html>'),
    });

    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/cf_clearance/);
  });

  it('should throw a solver hint on challenge HTML with 200', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      text: () => Promise.resolve('<title>Just a moment...</title>'),
    });

    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/FlareSolverr/);
  });

  it('should parse card grids from the live search page format', async () => {
    const cardHtml = `
    <div class="masonry-grid">
      <article class="card" style="animation-delay: 0ms;">
        <div class="tilt-light"></div>
        <a href="/model/actually-floating-benchy-attachment/6157305?q=benchy" class="card-img-wrap">
          <img src="https://bamax.es/uploads_v2/615/actually-floating-benchy-attachment-N0p8PUDs_200.webp"
               alt="Actually Floating Benchy (Attachment)" loading="lazy" width="280" height="200">
        </a>
        <div class="card-body"><h3>Actually Floating Benchy (Attachment)</h3></div>
      </article>
      <article class="card">
        <a href="/model/benchy-the-jolly-printing-torture-test/123456" class="card-img-wrap">
          <img src="x.webp" alt="3DBenchy - The jolly printing torture-test">
        </a>
      </article>
    </div>`;
    mockFetch.mockReset();
    mockConfigGet.mockReturnValue('https://solver.example/v1');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        message: 'Challenge solved!',
        solution: { status: 'ok', status_code: 200, response: cardHtml },
      }),
    });

    const results = await provider.search({ query: 'benchy' });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      source: 'stlfinder',
      name: 'Actually Floating Benchy (Attachment)',
      url: 'https://www.stlfinder.com/model/actually-floating-benchy-attachment/6157305',
    });
  });

  it('should surface the site 500 verdict from the solver', async () => {
    mockConfigGet.mockReturnValue('https://solver.example/v1');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        solution: { status: 'ok', status_code: 500, response: '<html>500</html>' },
      }),
    });

    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/HTTP 500/);
  });

  it('should surface solver failures with a hint', async () => {
    mockConfigGet.mockReturnValue('https://solver.example/v1');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'error',
        message: 'Error solving the challenge. Timeout after 120.0 seconds.',
      }),
    });

    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/FlareSolverr could not fetch/);
  });

  it('should surface the solver error body on non-2xx responses', async () => {
    mockConfigGet.mockReturnValue('https://solver.example/v1');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({
        status: 'error',
        message: 'Error: Error solving the challenge. Timeout after 150.0 seconds.',
      }),
    });

    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/Timeout after 150/);
  });

  it('should report an unreachable solver as a config error, not a rate limit', async () => {
    mockConfigGet.mockReturnValue('http://localhost:1/v1');
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    const err: unknown = await provider.search({ query: 'benchy' }).catch((e: unknown) => e);
    expect((err as Error).message).toMatch(/Could not reach FlareSolverr/);
    expect((err as Error).name).not.toBe('RateLimitError');
  });

  it('should honour the provider solver budget in the solver request', async () => {
    mockConfigGet.mockReturnValue('https://solver.example/v1');
    const solverFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', solution: { status_code: 200, response: sampleHtml } }),
    });
    globalThis.fetch = solverFetch;

    const provider = new MetaSearchProvider({
      name: 'yeggi',
      searchUrl: q => `https://www.yeggi.com/q/${q}/`,
      parse: stubParse,
      solverTimeoutMs: 60_000,
    });
    await provider.search({ query: 'benchy' });

    const init = solverFetch.mock.calls[0][1] as { body: string };
    const body = JSON.parse(init.body);
    expect(body.maxTimeout).toBe(60_000);
    expect(body.session).toBeUndefined();
  });

  it('should reject fetchFile as browse-only', async () => {
    await expect(provider.fetchFile('https://example.com/x.stl')).rejects.toThrow(/search index/);
  });

  it('should expose MetaSearchProvider construction via spec', () => {
    const p = new MetaSearchProvider({
      name: 'testsearch',
      searchUrl: q => `https://test.example/?q=${q}`,
      parse: stubParse,
    });
    expect(p.name).toBe('testsearch');
    expect(p.resolveUrl('https://anything')).toBeNull();
  });
});

describe('meta-search rate guard', () => {
  let stateDir: string;
  const prevEnv = process.env.THINGFINDER_STATE_DIR;

  const guarded = () =>
    new MetaSearchProvider({
      name: 'yeggiguard',
      searchUrl: q => `https://www.yeggi.com/q/${q}/`,
      parse: stubParse,
      defaultMinIntervalSeconds: 20,
      defaultCooldownMinutes: 15,
      retryDelayMs: 0,
    });

  const blocked = {
    ok: false,
    status: 403,
    statusText: 'Forbidden',
    headers: { get: () => null },
    text: () => Promise.resolve('blocked'),
  };
  const okPage = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    text: () => Promise.resolve(sampleHtml),
  };

  beforeEach(() => {
    mockFetch.mockReset();
    mockConfigGet.mockReturnValue('');
    stateDir = mkdtempSync(join(tmpdir(), 'tf-guard-'));
    process.env.THINGFINDER_STATE_DIR = stateDir;
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
    if (prevEnv === undefined) delete process.env.THINGFINDER_STATE_DIR;
    else process.env.THINGFINDER_STATE_DIR = prevEnv;
  });

  it('retries once, then engages a persistent cooldown', async () => {
    mockFetch.mockResolvedValue(blocked);
    const provider = guarded();

    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(
      /backing off 15m/,
    );

    // Cooldown is persisted: the next search rejects instantly with no fetch.
    const callsBefore = mockFetch.mock.calls.length;
    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/Retry after/);
    expect(mockFetch.mock.calls.length).toBe(callsBefore);
  });

  it('keeps the underlying hint in the backoff message', async () => {
    mockFetch.mockResolvedValue(blocked);
    const provider = guarded();
    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/cf_clearance/);
  });

  it('spaces requests by the minimum interval after a success', async () => {
    mockFetch.mockResolvedValue(okPage);
    const provider = guarded();

    const first = await provider.search({ query: 'benchy' });
    expect(first.length).toBeGreaterThan(0);

    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/Retry after \d+s/);
    expect(mockFetch.mock.calls.length).toBe(1);
  });

  it('resets the guard after a success clears the streak', async () => {
    // First: blocked -> cooldown.
    mockFetch.mockResolvedValue(blocked);
    const provider = guarded();
    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/backing off/);

    // Expiry: simulate cooldown passing by clearing state file.
    rmSync(join(stateDir, 'state.json'), { force: true });

    mockFetch.mockResolvedValue(okPage);
    const results = await provider.search({ query: 'benchy' });
    expect(results.length).toBeGreaterThan(0);
  });
});
