import { MetaSearchProvider } from './metasearch.js';
import type { ParsedLink } from './metasearch.js';

const ORIGIN = 'https://www.yeggi.com';

function decode(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parsed from the live search page (verified 2026-11-22 via FlareSolverr):
 * each result is a `<div class="item_1_A">` block whose first anchor is a
 * `/goto/...` redirect to the hosting site, with the thumbnail img, an
 * `img-overlay` naming the site, and the title in the `<id>_txt` div.
 */
export function parseYeggiResults(html: string): ParsedLink[] {
  const links: ParsedLink[] = [];

  for (const block of html.split('<div class="item_1_A">').slice(1)) {
    const href = /<a\b[^>]*href="(\/goto\/[^"]+)"/i.exec(block)?.[1];
    const rawTitle = /id="\d+_txt">([\s\S]*?)<\/div>/i.exec(block)?.[1];
    if (!href || !rawTitle) continue;

    const title = decode(
      rawTitle.replace(/<span class="txt_tag_changer_1">[\s\S]*?<\/span>/i, '').replace(/<[^>]+>/g, ''),
    );
    if (title.length < 3) continue;

    const site = /Website:\s*<i>([^<]+)<\/i>/i.exec(block)?.[1];
    const thumbnailUrl = /<img\b[^>]*src="(https:\/\/[^"]+)"/i.exec(block)?.[1];

    links.push({
      url: `${ORIGIN}${href}`,
      title: title.slice(0, 160),
      site: site ? decode(site) : undefined,
      thumbnailUrl,
    });
  }

  return links;
}

export class YeggiProvider extends MetaSearchProvider {
  constructor() {
    super({
      name: 'yeggi',
      searchUrl: q => `${ORIGIN}/q/${q}/`,
      parse: parseYeggiResults,
      // The aggressive one: space requests 20 s apart, 15-minute base cooldown.
      defaultMinIntervalSeconds: 20,
      defaultCooldownMinutes: 15,
      retryDelayMs: 20_000,
      // Yeggi's challenge rarely clears past a minute — fail fast, back off.
      solverTimeoutMs: 60_000,
    });
  }
}
