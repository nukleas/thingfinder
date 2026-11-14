import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

interface DownloadFiletype {
  downloadLink?: string;
  size?: number;
}

interface AmbientAsset {
  assetId: string;
  tags?: string[];
  category?: string;
  creationDate?: string;
  latestUpdateDate?: string;
  downloadCount?: number;
  previewImage?: string;
  downloadFolders?: {
    default?: {
      downloadFiletypes?: Record<string, DownloadFiletype>;
    };
  };
}

interface FullJsonResponse {
  foundAssets?: AmbientAsset[];
}

function flattenFiles(asset: AmbientAsset): ModelFile[] {
  const filetypes = asset.downloadFolders?.default?.downloadFiletypes ?? {};
  const files: ModelFile[] = [];
  for (const [ext, leaf] of Object.entries(filetypes)) {
    if (!leaf.downloadLink) continue;
    const format = ext.toLowerCase();
    files.push({
      id: `${asset.assetId}/${format}`,
      name: `${asset.assetId}.${format}`,
      url: leaf.downloadLink,
      size: leaf.size,
      format,
    });
  }
  return files;
}

export class AmbientcgProvider implements SourceProvider {
  readonly name = 'ambientcg';
  private readonly client: HttpClient;

  constructor() {
    this.client = new HttpClient({
      baseUrl: 'https://ambientcg.com/api/v2',
      providerName: 'ambientcg',
      headers: { Accept: 'application/json' },
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const limit = Math.min(options.pageSize ?? 20, 50);
    const offset = ((options.page ?? 1) - 1) * limit;

    const resp = await this.client.get<FullJsonResponse>('/full_json', {
      type: '3DModel',
      limit: String(limit),
      offset: String(offset),
      sortingField: options.sort === 'newest' ? 'latestCreatedAtOnline' : 'downloadCount',
      include: 'downloadData,imageData',
      ...(options.query ? { q: options.query } : {}),
    });

    const assets = resp.foundAssets ?? [];
    return assets.map(asset => ({
      id: asset.assetId,
      name: asset.assetId,
      creator: 'AmbientCG',
      url: `https://ambientcg.com/get?id=${encodeURIComponent(asset.assetId)}`,
      thumbnailUrl: asset.previewImage,
      likes: 0,
      downloads: asset.downloadCount ?? 0,
      source: 'ambientcg',
      createdAt: asset.creationDate,
    }));
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    const resp = await this.client.get<FullJsonResponse>('/full_json', {
      ids: modelId,
      include: 'downloadData',
    });

    const assets = (resp.foundAssets ?? []) as (AmbientAsset | undefined)[];
    const asset = assets[0];
    return asset ? flattenFiles(asset) : [];
  }

  resolveUrl(url: string): string | null {
    const byQuery = url.match(/ambientcg\.com\/get\?id=([\w-]+)/);
    if (byQuery) return byQuery[1];
    const byHash = url.match(/ambientcg\.com\/get#([\w-]+)/);
    return byHash ? byHash[1] : null;
  }

  isAvailable(): boolean {
    return true;
  }

  fetchFile = (url: string): Promise<TransportResponse> => this.client.fetchRaw(url);
}
