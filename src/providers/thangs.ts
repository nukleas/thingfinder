import { HttpClient } from '../http/client.js';
import { ImpitTransport } from '../http/transport.js';
import type { TransportResponse } from '../http/transport.js';
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
  visibility?: string;
  marketplaceInfo?: { priceInUSD: number } | null;
}

interface ThangsModelDetail {
  id: string;
  name: string;
  parts: ThangsModelPart[];
}

interface ThangsModelPart {
  filename: string;
  originalFileName: string;
  size: number;
}

export class ThangsProvider implements SourceProvider {
  readonly name = 'thangs';
  private client: HttpClient;

  constructor() {
    this.client = new HttpClient({
      baseUrl: 'https://thangs.com',
      providerName: 'thangs',
      headers: { Accept: 'application/json' },
      transport: new ImpitTransport(),
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const page = (options.page ?? 1) - 1; // Thangs uses 0-based pages
    const pageSize = options.pageSize ?? 20;

    const data = await this.client.get<ThangsSearchResponse>(
      '/api/search/v5/search-by-text',
      {
        searchTerm: options.query,
        page: String(page),
        pageSize: String(pageSize),
        pageScope: 'root',
      },
    );

    const freeItems = (data.items ?? []).filter(item => {
      if (item.visibility === 'market-paid' || item.marketplaceInfo?.priceInUSD) {
        return false;
      }
      return true;
    });

    return freeItems.map(item => ({
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
      const detail = await this.client.get<ThangsModelDetail>(
        `/api/models/${modelId}`,
      );

      return (detail.parts ?? []).map((part, i) => {
        const ext = part.originalFileName.split('.').pop()?.toLowerCase() ?? '';
        const downloadUrl = `https://thangs.com/api/v4/models/${modelId}/viewerFile?part=${encodeURIComponent(part.filename)}&useDraco=false`;
        return {
          id: `${modelId}-${i}`,
          name: part.originalFileName,
          url: downloadUrl,
          size: part.size,
          format: ext,
        };
      });
    } catch {
      // Model detail may not be available for aggregated (non-Thangs-native) models
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

  fetchFile = (url: string): Promise<TransportResponse> => {
    return this.client.fetchRaw(url);
  };
}
