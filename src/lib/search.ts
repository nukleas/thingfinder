import { getRegistry } from '../providers/index.js';
import type { SearchResult } from '../providers/types.js';

export interface SearchModelsOptions {
  sources?: string[];
  sort?: 'relevant' | 'popular' | 'newest';
  limit?: number;
}

export interface SearchModelsResult {
  results: SearchResult[];
  errors: { provider: string; message: string }[];
}

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchModels(
  query: string,
  options?: SearchModelsOptions,
): Promise<SearchModelsResult> {
  const registry = getRegistry();

  const { results, errors } = await registry.searchAll(
    {
      query,
      pageSize: options?.limit ?? 20,
      sort: options?.sort ?? 'relevant',
    },
    options?.sources,
  );

  return {
    results: deduplicateResults(results),
    errors: errors.map(e => ({ provider: e.provider, message: e.error.message })),
  };
}
