import type { SearchResult } from '../providers/types.js';
import { truncate, formatNumber, padLeft, padRight } from './format.js';

export function formatResultsTable(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  const nameWidth = 40;
  const creatorWidth = 18;
  const sourceWidth = 12;
  const likesWidth = 8;
  const dlWidth = 8;

  const header = [
    padRight('#', 4),
    padRight('Name', nameWidth),
    padRight('Creator', creatorWidth),
    padRight('Source', sourceWidth),
    padLeft('Likes', likesWidth),
    padLeft('DLs', dlWidth),
  ].join(' ');

  const separator = '-'.repeat(header.length);

  const rows = results.map((r, i) => [
    padRight(String(i + 1), 4),
    padRight(truncate(r.name, nameWidth), nameWidth),
    padRight(truncate(r.creator, creatorWidth), creatorWidth),
    padRight(r.source, sourceWidth),
    padLeft(formatNumber(r.likes), likesWidth),
    padLeft(formatNumber(r.downloads), dlWidth),
  ].join(' '));

  return [header, separator, ...rows].join('\n');
}
