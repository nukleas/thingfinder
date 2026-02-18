import { Impit } from 'impit';
import { NetworkError } from '../errors.js';
import { logger } from '../logger.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

interface ThangsSearchResponse {
  items: ThangsItem[];
  totalPages: number;
  totalResults: number;
}

interface ThangsItem {
  modelId: string;
  name: string;
  ownerUsername: string;
  modelPageUrl: string;
  thumbnailUrl?: string;
  likesCount: number;
  downloadCount: number;
  publishedOn?: string;
  fileTypes?: string[];
  site: string;
}

interface ThangsDownloadResponse {
  url?: string;
  downloadUrl?: string;
}

export class ThangsProvider implements SourceProvider {
  readonly name = 'thangs';
  private impit: Impit;

  constructor() {
    this.impit = new Impit({ browser: 'chrome' });
  }

  private async fetchJson<T>(url: string): Promise<T> {
    logger.debug(`Thangs fetch: ${url}`);
    const response = await this.impit.fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new NetworkError(`HTTP ${response.status}: ${response.statusText} for ${url}`);
    }

    return (await response.json()) as T;
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const page = (options.page ?? 1) - 1; // Thangs uses 0-based pages
    const pageSize = options.pageSize ?? 20;

    const params = new URLSearchParams({
      searchTerm: options.query,
      page: String(page),
      pageSize: String(pageSize),
      pageScope: 'root',
    });

    const data = await this.fetchJson<ThangsSearchResponse>(
      `https://thangs.com/api/search/v5/search-by-text?${params}`,
    );

    return (data.items ?? []).map(item => ({
      id: item.modelId,
      name: item.name,
      creator: item.ownerUsername ?? 'Unknown',
      url: item.modelPageUrl ?? `https://thangs.com/m/${item.modelId}`,
      thumbnailUrl: item.thumbnailUrl,
      likes: item.likesCount ?? 0,
      downloads: item.downloadCount ?? 0,
      source: 'thangs',
      createdAt: item.publishedOn,
    }));
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    try {
      const data = await this.fetchJson<ThangsDownloadResponse>(
        `https://thangs.com/api/v2/models/${modelId}/download-url`,
      );
      const url = data.url ?? data.downloadUrl;
      if (url) {
        return [{
          id: modelId,
          name: `model-${modelId}.zip`,
          url,
          format: 'zip',
        }];
      }
    } catch {
      // Some models may not have direct downloads via Thangs
    }
    return [];
  }

  resolveUrl(url: string): string | null {
    const mMatch = url.match(/thangs\.com\/m\/(\d+)/);
    if (mMatch) return mMatch[1];

    const designerMatch = url.match(/thangs\.com\/designer\/.+?\/3d-model\/.+-(\d+)/);
    if (designerMatch) return designerMatch[1];

    return null;
  }

  isAvailable(): boolean {
    return true;
  }
}
