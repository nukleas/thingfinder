import { getRegistry } from '../providers/index.js';

export interface SourceInfo {
  name: string;
  available: boolean;
  isBrowseOnly: boolean;
}

export function listSources(): SourceInfo[] {
  const registry = getRegistry();
  return registry.getAll().map(p => ({
    name: p.name,
    available: p.isAvailable(),
    isBrowseOnly: p.isBrowseOnly ?? false,
  }));
}
