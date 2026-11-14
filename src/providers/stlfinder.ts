import { MetaSearchProvider } from './metasearch.js';
import type { ParsedLink } from './metasearch.js';

const ORIGIN = 'https://www.stlfinder.com';

/**
 * Parsed from the live search page structure (verified 2026-11-14 via
 * FlareSolverr): results are `<article class="card">` blocks whose
 * `card-img-wrap` anchor points at the /model/<slug>/<id> interstitial
 * page and whose thumbnail img alt carries the model title.
 */
function parseStlfinderCards(html: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const seen = new Set<string>();
  const cardRe = /<article\b[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;

  for (const match of html.matchAll(cardRe)) {
    const card = match[1];
    const href = card.match(/<a\b[^>]*href="((?:\/model\/|https?:\/\/[^"]*\/model\/)[^"]+)"/i)?.[1];
    if (!href) continue;

    const url = href.startsWith('http') ? href : `${ORIGIN}${href}`;
    const key = url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);

    const title =
      card.match(/<img\b[^>]*alt="([^"]{3,160})"/i)?.[1] ??
      card.match(/<h[23]\b[^>]*>([^<]{3,160})</i)?.[1] ??
      '';
    if (title.length < 3) continue;

    links.push({ url: key, title: title.trim().slice(0, 160) });
  }

  return links;
}

export class StlfinderProvider extends MetaSearchProvider {
  constructor() {
    super({
      name: 'stlfinder',
      searchUrl: q => `${ORIGIN}/3dmodels/${q}/`,
      selfHost: /stlfinder\.com$/,
      parse: parseStlfinderCards,
      defaultMinIntervalSeconds: 0,
      defaultCooldownMinutes: 5,
      retryDelayMs: 0,
    });
  }
}
