import { ProviderError } from '../errors.js';
import { HttpClient } from '../http/client.js';
import { ImpitTransport } from '../http/transport.js';
import type { TransportResponse } from '../http/transport.js';
import { getConfigValue } from '../config/store.js';
import type { SearchOptions, SearchResult, SourceProvider } from './types.js';
import type { ConfigKey } from '../config/schema.js';

export interface MetaSearchSpec {
  name: string;
  searchUrl: (query: string) => string;
  selfHost: RegExp;
}

const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';

interface ParsedLink {
  url: string;
  title: string;
}

/**
 * Heuristic: meta-search result pages list outbound links to the hosting
 * sites. Collect anchors whose href leaves the meta-search host and whose
 * text (or img alt) reads like a model title.
 */
export function parseOutboundLinks(html: string, selfHost: RegExp): ParsedLink[] {
  const links: ParsedLink[] = [];
  const seen = new Set<string>();
  const anchorRe = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRe)) {
    const href = match[1];
    const inner = match[2];

    if (!/^https?:\/\//.test(href)) continue;

    let host: string;
    try {
      host = new URL(href).hostname;
    } catch {
      continue;
    }
    if (selfHost.test(host)) continue;

    const imgAlt = inner.match(/alt="([^"]{3,120})"/i)?.[1];
    const text = inner
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const title = (text.length >= 3 ? text : imgAlt) ?? '';
    if (title.length < 3) continue;

    const key = href.split('#')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url: href, title: title.slice(0, 160) });
  }

  return links;
}

export class MetaSearchProvider implements SourceProvider {
  readonly name: string;
  readonly isBrowseOnly = true;
  private readonly spec: MetaSearchSpec;
  private readonly client: HttpClient;

  constructor(spec: MetaSearchSpec) {
    this.name = spec.name;
    this.spec = spec;
    this.client = new HttpClient({
      providerName: spec.name,
      transport: new ImpitTransport(),
      headers: this.headers(),
    });
  }

  private headers(): Record<string, string> {
    const uaKey = `${this.name}.userAgent` as ConfigKey;
    const clearanceKey = `${this.name}.cfClearance` as ConfigKey;
    const ua = (getConfigValue(uaKey) as string) || DEFAULT_UA;
    const clearance = getConfigValue(clearanceKey) as string;

    const headers: Record<string, string> = {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-AU,en;q=0.9',
    };
    if (clearance) {
      headers.Cookie = `cf_clearance=${clearance}`;
    }
    return headers;
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const resp = await this.client.fetchRaw(this.spec.searchUrl(encodeURIComponent(options.query)));

    if (resp.status === 403) {
      throw new ProviderError(
        this.name,
        `Cloudflare/bot challenge blocked the search (HTTP 403). Open ${this.spec.searchUrl('x')} in your browser, then copy the cf_clearance cookie and User-Agent into: thingfinder config set ${this.name}.cfClearance <value> (must be from the same network).`,
      );
    }
    if (!resp.ok) {
      throw new ProviderError(this.name, `Search failed: HTTP ${resp.status} ${resp.statusText}`);
    }

    const html = await resp.text();

    if (/just a moment|challenge-form|enable js and disable any ad blocker/i.test(html.slice(0, 4000))) {
      throw new ProviderError(
        this.name,
        `Cloudflare challenge blocked the search. Open ${this.spec.searchUrl('x')} in your browser, then copy the cf_clearance cookie and User-Agent into: thingfinder config set ${this.name}.cfClearance <value> (must be from the same network).`,
      );
    }

    const links = parseOutboundLinks(html, this.spec.selfHost);
    const limit = options.pageSize ?? 20;

    return links.slice(0, limit).map((link, i) => ({
      id: `${this.name}-${i}-${link.url}`,
      name: link.title,
      creator: `${this.name} (links out)`,
      url: link.url,
      likes: 0,
      downloads: 0,
      source: this.name,
    }));
  }

  getFiles(_modelId: string): Promise<import('./types.js').ModelFile[]> {
    return Promise.resolve([]);
  }

  resolveUrl(_url: string): string | null {
    return null;
  }

  isAvailable(): boolean {
    return true;
  }

  fetchFile = (_url: string): Promise<TransportResponse> =>
    Promise.reject(
      new ProviderError(this.name, `${this.name} is a search index; download from the linked source site.`),
    );
}
