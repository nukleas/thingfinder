import { AuthError } from '../errors.js';
import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import { getConfigValue } from '../config/store.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

interface SketchfabSearchResponse {
  results: SketchfabModel[];
  cursors: { next: string | null; previous: string | null };
  next: string | null;
}

interface SketchfabModel {
  uid: string;
  name: string;
  viewCount: number;
  likeCount: number;
  isDownloadable: boolean;
  publishedAt: string;
  viewerUrl: string;
  thumbnails: {
    images: Array<{ url: string; width: number; height: number }>;
  };
  user: {
    uid: string;
    username: string;
    displayName: string;
  };
  archives?: Record<string, { size: number; type: string }>;
}

interface SketchfabDownloadResponse {
  gltf?: { url: string; size: number; expires: number };
  usdz?: { url: string; size: number; expires: number };
}

export class SketchfabProvider implements SourceProvider {
  readonly name = 'sketchfab';

  private getApiKey(): string | undefined {
    const envKey = process.env.THINGFINDER_SKETCHFAB_API_KEY;
    if (envKey) return envKey;

    const configKey = getConfigValue('sketchfab.apiKey');
    if (configKey) return configKey;

    return undefined;
  }

  private createClient(): HttpClient {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AuthError('sketchfab');
    }

    return new HttpClient({
      baseUrl: 'https://api.sketchfab.com/v3',
      providerName: 'sketchfab',
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });
  }

  private createSearchClient(): HttpClient {
    const apiKey = this.getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Token ${apiKey}`;
    }

    return new HttpClient({
      baseUrl: 'https://api.sketchfab.com/v3',
      providerName: 'sketchfab',
      headers,
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const client = this.createSearchClient();
    const count = Math.min(options.pageSize ?? 20, 24);

    const sortMap: Record<string, string> = {
      relevant: '-relevance',
      popular: '-viewCount',
      newest: '-createdAt',
    };

    const params: Record<string, string> = {
      q: options.query,
      downloadable: 'true',
      count: String(count),
      sort_by: sortMap[options.sort ?? 'relevant'] ?? '-relevance',
    };

    const resp = await client.get<SketchfabSearchResponse>('/models', params);

    return resp.results.map(model => ({
      id: model.uid,
      name: model.name,
      creator: model.user.displayName || model.user.username,
      url: model.viewerUrl,
      thumbnailUrl: model.thumbnails.images[0]?.url,
      likes: model.likeCount,
      downloads: model.viewCount,
      source: 'sketchfab',
      createdAt: model.publishedAt,
    }));
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    const client = this.createClient();

    const resp = await client.get<SketchfabDownloadResponse>(`/models/${modelId}/download`);

    const files: ModelFile[] = [];

    if (resp.gltf) {
      files.push({
        id: `${modelId}-gltf`,
        name: `${modelId}.gltf.zip`,
        url: resp.gltf.url,
        size: resp.gltf.size,
        format: 'gltf',
      });
    }

    if (resp.usdz) {
      files.push({
        id: `${modelId}-usdz`,
        name: `${modelId}.usdz`,
        url: resp.usdz.url,
        size: resp.usdz.size,
        format: 'usdz',
      });
    }

    return files;
  }

  resolveUrl(url: string): string | null {
    const longMatch = url.match(/sketchfab\.com\/3d-models\/[\w-]+-([a-f0-9]{12,})/);
    if (longMatch) return longMatch[1];

    const shortMatch = url.match(/sketchfab\.com\/models\/([a-f0-9]{12,})/);
    if (shortMatch) return shortMatch[1];

    return null;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  fetchFile = (url: string): Promise<TransportResponse> => {
    const client = new HttpClient({ providerName: 'sketchfab' });
    return client.fetchRaw(url);
  };
}
