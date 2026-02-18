import type { SearchResult } from '../providers/types.js';

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + '\u2026';
}

function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

function padLeft(str: string, len: number): string {
  return ' '.repeat(Math.max(0, len - str.length)) + str;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

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
