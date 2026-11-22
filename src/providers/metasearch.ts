import { ProviderError, RateLimitError } from '../errors.js';
import { HttpClient } from '../http/client.js';
import { ImpitTransport } from '../http/transport.js';
import type { TransportResponse } from '../http/transport.js';
import { getConfigNumber, getConfigValue } from '../config/store.js';
import type { SearchOptions, SearchResult, SourceProvider } from './types.js';
import type { ConfigKey } from '../config/schema.js';
import { checkGuard, cooldownBaseMs, formatDuration, markFailure, markRequest, markSuccess } from './rate-guard.js';

export interface ParsedLink {
  url: string;
  title: string;
}

export interface MetaSearchSpec {
  name: string;
  searchUrl: (query: string) => string;
  selfHost: RegExp;
  /** Site-specific HTML parser; defaults to the generic outbound-link heuristic. */
  parse?: (html: string, spec: MetaSearchSpec) => ParsedLink[];
  /** Minimum seconds between requests to this site (0 = no cross-run spacing). */
  defaultMinIntervalSeconds?: number;
  /** Base cooldown in minutes after a rate-limit-ish failure; doubles per repeat, capped at 2h. */
  defaultCooldownMinutes?: number;
  /** In-process pause before the single retry after a soft-block (ms). */
  retryDelayMs?: number;
  /** FlareSolverr challenge budget in ms (default 120000). */
  solverTimeoutMs?: number;
}

const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';

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

interface FlareSolverrSolution {
  status?: string;
  status_code?: number;
  response?: string;
  cookies?: Array<{ name: string; value: string }>;
}

interface FlareSolverrResponse {
  status: string;
  message?: string;
  solution?: FlareSolverrSolution;
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
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (clearance) {
      headers.Cookie = `cf_clearance=${clearance}`;
    }
    return headers;
  }

  private getFlareSolverrUrl(): string {
    return getConfigValue('flaresolverr.url');
  }

  /** Soft-block failures (rate limiting, bot walls, solver timeouts) for backoff. */
  private rateLimited(message: string): ProviderError {
    const err = new ProviderError(this.name, message);
    err.rateLimited = true;
    return err;
  }

  private minIntervalMs(): number {
    const seconds =
      getConfigNumber(`${this.name}.minIntervalSeconds` as ConfigKey) ?? this.spec.defaultMinIntervalSeconds ?? 0;
    return seconds * 1000;
  }

  private cooldownBaseMs(): number {
    const minutes =
      getConfigNumber(`${this.name}.cooldownMinutes` as ConfigKey) ?? this.spec.defaultCooldownMinutes ?? 15;
    return cooldownBaseMs(minutes);
  }

  private solverTimeoutMs(): number {
    const seconds = getConfigNumber(`${this.name}.solverTimeoutSeconds` as ConfigKey);
    return seconds !== undefined ? seconds * 1000 : (this.spec.solverTimeoutMs ?? 120_000);
  }

  /** Fetch search HTML via solver (preferred) or direct HTTP; tags soft blocks. */
  private async fetchPage(targetUrl: string): Promise<string> {
    let html: string;

    if (this.getFlareSolverrUrl()) {
      html = await this.fetchViaSolver(targetUrl);
    } else {
      const resp = await this.client.fetchRaw(targetUrl);

      if (resp.status === 403) {
        throw this.rateLimited(
          `Cloudflare/bot challenge blocked the search (HTTP 403). Set a FlareSolverr endpoint (thingfinder config set flaresolverr.url http://host:8192/v1) or supply a cf_clearance cookie: thingfinder config set ${this.name}.cfClearance <value> (must be from the same network).`,
        );
      }
      if (!resp.ok) {
        throw new ProviderError(this.name, `Search failed: HTTP ${resp.status} ${resp.statusText}`);
      }

      html = await resp.text();
    }

    if (/just a moment|challenge-form|enable js and disable any ad blocker/i.test(html.slice(0, 4000))) {
      throw this.rateLimited(
        `Cloudflare challenge page served. Set a FlareSolverr endpoint (thingfinder config set flaresolverr.url http://host:8192/v1) to solve it.`,
      );
    }

    return html;
  }

  private async fetchViaSolver(targetUrl: string): Promise<string> {
    const solverUrl = this.getFlareSolverrUrl();
    const budgetMs = this.solverTimeoutMs();
    let resp: Response;
    try {
      resp = await fetch(solverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmd: 'request.get',
          url: targetUrl,
          // No `session`: FlareSolverr then uses a temporary browser and
          // tears it down after the request instead of leaking one per call.
          maxTimeout: budgetMs,
        }),
        signal: AbortSignal.timeout(budgetMs + 30_000),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw this.rateLimited(`FlareSolverr request timed out after ${Math.round(budgetMs / 1000)}s.`);
      }
      // Unreachable solver is a config problem, not a site block: no cooldown.
      throw new ProviderError(
        this.name,
        `Could not reach FlareSolverr at ${solverUrl}${err instanceof Error ? ` (${err.message})` : ''}. Check flaresolverr.url.`,
      );
    }

    if (!resp.ok) {
      let reason = `HTTP ${resp.status}`;
      try {
        const err = (await resp.json()) as FlareSolverrResponse;
        if (err.message) reason = `${resp.status}: ${err.message}`;
      } catch {
        // body not JSON; keep the status code
      }
      throw this.rateLimited(`FlareSolverr request failed: ${reason}`);
    }

    const data = (await resp.json()) as FlareSolverrResponse;
    const solution = data.solution;

    if (data.status !== 'ok' || !solution?.response) {
      const reason = data.message ?? 'no solution returned';
      throw this.rateLimited(
        `FlareSolverr could not fetch the page: ${reason}. If the site rate-limits the solver's IP, retry after the cooldown or set ${this.name}.cfClearance.`,
      );
    }

    if ((solution.status_code ?? 200) >= 500) {
      throw this.rateLimited(
        `${this.name} returned HTTP ${solution.status_code} after passing the challenge — the site is rate-limiting the solver's IP; try again after the cooldown.`,
      );
    }

    return solution.response;
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const guard = checkGuard(this.name, this.minIntervalMs());
    if (!guard.ok) {
      throw new RateLimitError(this.name, guard.retryInMs);
    }
    markRequest(this.name);

    const targetUrl = this.spec.searchUrl(encodeURIComponent(options.query));

    let html: string;
    try {
      try {
        html = await this.fetchPage(targetUrl);
      } catch (err) {
        if (!(err instanceof ProviderError) || !err.rateLimited) throw err;
        // One in-process retry after a pause; sites soft-block solver traffic.
        await new Promise(resolve => setTimeout(resolve, this.spec.retryDelayMs ?? 0));
        html = await this.fetchPage(targetUrl);
      }
    } catch (err) {
      if (err instanceof ProviderError && err.rateLimited) {
        const cooldown = markFailure(this.name, this.cooldownBaseMs());
        const detail = err.message.startsWith(`[${this.name}] `)
          ? err.message.slice(this.name.length + 3)
          : err.message;
        throw new RateLimitError(
          this.name,
          cooldown,
          `${detail} — backing off ${formatDuration(cooldown)} before the next ${this.name} request.`,
        );
      }
      throw err;
    }
    markSuccess(this.name);

    const parse = this.spec.parse ?? ((h: string, s: MetaSearchSpec) => parseOutboundLinks(h, s.selfHost));
    const links = parse(html, this.spec);
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

  /** Opt-in: only searched once a solver endpoint or clearance cookie is configured. */
  isAvailable(): boolean {
    return Boolean(this.getFlareSolverrUrl() || getConfigValue(`${this.name}.cfClearance` as ConfigKey));
  }

  fetchFile = (_url: string): Promise<TransportResponse> =>
    Promise.reject(
      new ProviderError(this.name, `${this.name} is a search index; download from the linked source site.`),
    );
}
