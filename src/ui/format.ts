export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + '\u2026';
}

export function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes >= 1_000_000) return ` (${(bytes / 1_000_000).toFixed(1)} MB)`;
  if (bytes >= 1_000) return ` (${(bytes / 1_000).toFixed(1)} KB)`;
  return ` (${bytes} B)`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

export function padLeft(str: string, len: number): string {
  return ' '.repeat(Math.max(0, len - str.length)) + str;
}
