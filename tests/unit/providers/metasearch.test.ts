import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaSearchProvider, parseOutboundLinks } from '../../../src/providers/metasearch.js';
import { StlfinderProvider } from '../../../src/providers/stlfinder.js';

const mockFetch = vi.fn();

vi.mock('../../../src/http/transport.js', () => ({
  NativeTransport: class { fetch = mockFetch; },
  ImpitTransport: class { fetch = mockFetch; },
}));

vi.mock('../../../src/config/store.js', () => ({
  getConfigValue: vi.fn().mockReturnValue(''),
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

describe('parseOutboundLinks', () => {
  it('should keep only cross-host anchors with titles', () => {
    const links = parseOutboundLinks(sampleHtml, /stlfinder\.com$/);
    const urls = links.map(l => l.url);

    expect(urls).toContain('https://www.thingiverse.com/thing:12345');
    expect(urls).toContain('https://www.printables.com/model/3161-benchy');
    expect(urls).toContain('https://thangs.com/designer/x/3d-model/Y/1');
    expect(urls).not.toContain('https://www.stlfinder.com/about');
    expect(urls).not.toContain('/relative/link');
  });

  it('should fall back to img alt for text-less anchors', () => {
    const links = parseOutboundLinks(sampleHtml, /stlfinder\.com$/);
    const printables = links.find(l => l.url.includes('printables'));
    expect(printables?.title).toBe('Benchy printable');
  });
});

describe('StlfinderProvider', () => {
  let provider: StlfinderProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new StlfinderProvider();
  });

  it('should be browse-only and available', () => {
    expect(provider.name).toBe('stlfinder');
    expect(provider.isBrowseOnly).toBe(true);
    expect(provider.isAvailable()).toBe(true);
  });

  it('should parse search page results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      text: () => Promise.resolve(sampleHtml),
    });

    const results = await provider.search({ query: 'benchy' });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      source: 'stlfinder',
      url: expect.stringMatching(/^https?:\/\//),
    });
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

  it('should throw a Cloudflare hint on challenge HTML with 200', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      text: () => Promise.resolve('<title>Just a moment...</title>'),
    });

    await expect(provider.search({ query: 'benchy' })).rejects.toThrow(/cf_clearance/);
  });

  it('should reject fetchFile as browse-only', async () => {
    await expect(provider.fetchFile('https://example.com/x.stl')).rejects.toThrow(/search index/);
  });

  it('should expose MetaSearchProvider construction via spec', () => {
    const p = new MetaSearchProvider({
      name: 'testsearch',
      searchUrl: q => `https://test.example/?q=${q}`,
      selfHost: /test\.example$/,
    });
    expect(p.name).toBe('testsearch');
    expect(p.resolveUrl('https://anything')).toBeNull();
  });
});
