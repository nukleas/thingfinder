import { AuthError } from '../errors.js';
import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import { getConfigValue } from '../config/store.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

interface MMFSearchResponse {
  total_count: number;
  items: MMFObject[];
}

interface MMFObject {
  id: number;
  url: string;
  name: string;
  views: number;
  likes: number;
  published_at: string;
  designer: {
    username: string;
    name: string;
  };
  images: Array<{
    thumbnail?: { url: string };
  }>;
  files: MMFFile[];
}

interface MMFFile {
  id: number;
  filename: string;
  description?: string;
  size: string;
  download_url?: string;
}

export class MyMiniFactoryProvider implements SourceProvider {
  readonly name = 'myminifactory';

  private getApiKey(): string | undefined {
    const envKey = process.env.THINGFINDER_MYMINIFACTORY_API_KEY;
    if (envKey) return envKey;

    const configKey = getConfigValue('myminifactory.apiKey') as string;
    if (configKey) return configKey;

    return undefined;
  }

  private createClient(): HttpClient {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AuthError('myminifactory');
    }

    return new HttpClient({
      baseUrl: 'https://www.myminifactory.com/api/v2',
      providerName: 'myminifactory',
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const client = this.createClient();
    const apiKey = this.getApiKey()!;
    const page = options.page ?? 1;
    const perPage = Math.min(options.pageSize ?? 20, 30);

    const resp = await client.get<MMFSearchResponse>('/search', {
      key: apiKey,
      q: options.query,
      page: String(page),
      per_page: String(perPage),
    });

    return (resp.items ?? []).map(item => ({
      id: String(item.id),
      name: item.name,
      creator: item.designer?.name || item.designer?.username || 'Unknown',
      url: item.url,
      thumbnailUrl: item.images?.[0]?.thumbnail?.url,
      likes: item.likes ?? 0,
      downloads: item.views ?? 0,
      source: 'myminifactory',
      createdAt: item.published_at,
    }));
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    const client = this.createClient();
    const apiKey = this.getApiKey()!;

    const obj = await client.get<MMFObject>(`/objects/${modelId}`, {
      key: apiKey,
    });

    return (obj.files ?? []).map(f => {
      const ext = f.filename.split('.').pop()?.toLowerCase() ?? '';
      return {
        id: String(f.id),
        name: f.filename,
        url: f.download_url ?? '',
        size: parseInt(f.size, 10) || undefined,
        format: ext,
      };
    });
  }

  resolveUrl(url: string): string | null {
    const match = url.match(/myminifactory\.com\/object\/[\w-]+-(\d+)/);
    return match ? match[1] : null;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  fetchFile = (url: string): Promise<TransportResponse> => {
    const apiKey = this.getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const client = new HttpClient({ providerName: 'myminifactory', headers });
    return client.fetchRaw(url);
  };
}
