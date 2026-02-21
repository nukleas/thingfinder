import { logger } from '../logger.js';
import type { SearchOptions, SearchResult, SourceProvider } from './types.js';

export class ProviderRegistry {
  private readonly providers: Map<string, SourceProvider> = new Map();

  register(provider: SourceProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): SourceProvider | undefined {
    return this.providers.get(name);
  }

  getAvailable(): SourceProvider[] {
    return [...this.providers.values()].filter(p => p.isAvailable());
  }

  getAll(): SourceProvider[] {
    return [...this.providers.values()];
  }

  async searchAll(
    options: SearchOptions,
    sources?: string[],
  ): Promise<{ results: SearchResult[]; errors: { provider: string; error: Error }[] }> {
    let providers = this.getAvailable();
    if (sources?.length) {
      providers = providers.filter(p => sources.includes(p.name));
    }

    if (providers.length === 0) {
      return { results: [], errors: [] };
    }

    const providerNames = providers.map(p => p.name);
    const settled = await Promise.allSettled(
      providers.map(async p => {
        logger.debug(`Searching ${p.name}...`);
        const results = await p.search(options);
        logger.debug(`${p.name}: ${results.length} results`);
        return results;
      }),
    );

    const results: SearchResult[] = [];
    const errors: { provider: string; error: Error }[] = [];

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      } else {
        const reason = result.reason as Error;
        logger.debug(`${providerNames[i]} failed: ${reason.message}`);
        errors.push({ provider: providerNames[i], error: reason });
      }
    }

    return { results, errors };
  }

  resolveUrl(url: string): { provider: SourceProvider; modelId: string } | null {
    for (const provider of this.providers.values()) {
      const modelId = provider.resolveUrl(url);
      if (modelId) {
        return { provider, modelId };
      }
    }
    return null;
  }
}
