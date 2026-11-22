import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

interface PolyAsset {
  name?: string;
  tags?: string[];
  categories?: string[];
  authors?: Record<string, string> | string[];
  date_published?: number;
  type?: number;
}

interface FileLeaf {
  size?: number;
  url?: string;
  md5?: string;
}

type FilesTree = Record<string, Record<string, Record<string, FileLeaf>>>;

const SITE_URL = 'https://polyhaven.com';

export class PolyhavenProvider implements SourceProvider {
  readonly name = 'polyhaven';
  private readonly client: HttpClient;

  constructor() {
    this.client = new HttpClient({
      baseUrl: 'https://api.polyhaven.com',
      providerName: 'polyhaven',
      headers: { Accept: 'application/json' },
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const assets = await this.client.get<Record<string, PolyAsset>>('/assets', { t: 'models' });
    const q = options.query.toLowerCase();

    let entries = Object.entries(assets);
    if (q) {
      entries = entries.filter(
        ([id, asset]) =>
          id.toLowerCase().includes(q) ||
          (asset.name ?? '').toLowerCase().includes(q) ||
          (asset.tags ?? []).some(t => t.toLowerCase().includes(q)),
      );
    }

    const limit = options.pageSize ?? 20;
    const offset = ((options.page ?? 1) - 1) * limit;
    const page = entries.slice(offset, offset + limit);

    return page.map(([id, asset]) => {
      const authors = Array.isArray(asset.authors)
        ? asset.authors.join(', ')
        : Object.keys(asset.authors ?? {}).join(', ');

      return {
        id,
        name: asset.name ?? id,
        creator: authors || 'Poly Haven',
        url: `${SITE_URL}/a/${id}`,
        thumbnailUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?height=200`,
        likes: 0,
        downloads: 0,
        source: 'polyhaven',
        createdAt: asset.date_published
          ? new Date(asset.date_published * 1000).toISOString()
          : undefined,
      };
    });
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    const tree = await this.client.get<FilesTree>(`/files/${encodeURIComponent(modelId)}`);
    const files: ModelFile[] = [];

    for (const [group, byRes] of Object.entries(tree)) {
      for (const [res, byExt] of Object.entries(byRes)) {
        for (const [ext, leaf] of Object.entries(byExt)) {
          if (!leaf.url) continue;
          files.push({
            id: `${modelId}/${group}/${res}/${ext}`,
            name: `${modelId}_${group}_${res}.${ext}`,
            url: leaf.url,
            size: leaf.size,
            format: ext.toLowerCase(),
          });
        }
      }
    }

    return files;
  }

  resolveUrl(url: string): string | null {
    const match = url.match(/polyhaven\.com\/a\/([\w-]+)/);
    return match ? match[1] : null;
  }

  isAvailable(): boolean {
    return true;
  }

  fetchFile = (url: string): Promise<TransportResponse> => this.client.fetchRaw(url);
}
