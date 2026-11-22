import { getConfigValue } from '../config/store.js';
import type { ModelFile } from '../providers/types.js';

function normalize(formats: string[]): Set<string> {
  return new Set(formats.map(f => f.toLowerCase().replace(/^\./, '')));
}

/** Formats from the `preferredFormats` config (default: stl, 3mf). */
export function preferredFormats(): Set<string> {
  return normalize(getConfigValue('preferredFormats'));
}

export function isPreferred(file: ModelFile): boolean {
  return preferredFormats().has(file.format.toLowerCase());
}

/**
 * Explicit formats filter strictly. Without them, the preferred formats are
 * used, falling back to every file when the model has none of them (e.g.
 * glTF-only sources).
 */
export function filterByFormat(files: ModelFile[], explicit?: string[]): ModelFile[] {
  if (explicit?.length) {
    const wanted = normalize(explicit);
    return files.filter(f => wanted.has(f.format.toLowerCase()));
  }
  const preferred = files.filter(isPreferred);
  return preferred.length > 0 ? preferred : files;
}
