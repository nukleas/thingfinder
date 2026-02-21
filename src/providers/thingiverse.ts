import { AuthError } from '../errors.js';
import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import { getConfigValue } from '../config/store.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

interface ThingiverseSearchItem {
  id: number;
  name: string;
  url: string;
  public_url?: string;
  thumbnail: string;
  like_count?: number;
  added: string;
  creator?: {
    name: string;
  };
}

interface ThingiverseFile {
  id: number;
  name: string;
  size: number;
  download_url?: string;
  direct_url?: string;
}

export class ThingiverseProvider implements SourceProvider {
  readonly name = 'thingiverse';

  private getApiKey(): string | undefined {
    const envKey = process.env.THINGFINDER_THINGIVERSE_API_KEY;
    if (envKey) return envKey;

    const configKey = getConfigValue('thingiverse.apiKey');
    if (configKey) return configKey;

    return undefined;
  }

  private createClient(): HttpClient {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AuthError('thingiverse');
    }

    return new HttpClient({
      baseUrl: 'https://api.thingiverse.com',
      providerName: 'thingiverse',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const client = this.createClient();
    const page = options.page ?? 1;
    const perPage = Math.min(options.pageSize ?? 20, 30);

    const items = await client.get<ThingiverseSearchItem[] | null>(
      `/search/${encodeURIComponent(options.query)}`,
      {
        per_page: String(perPage),
        page: String(page),
      },
    );

    return (items ?? []).map(item => ({
      id: String(item.id),
      name: item.name,
      creator: item.creator?.name ?? 'Unknown',
      url: item.public_url ?? `https://www.thingiverse.com/thing:${item.id}`,
      thumbnailUrl: item.thumbnail,
      likes: item.like_count ?? 0,
      downloads: 0, // Thingiverse search doesn't return download count
      source: 'thingiverse',
      createdAt: item.added,
    }));
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    const client = this.createClient();

    const files = await client.get<ThingiverseFile[] | null>(`/things/${modelId}/files`);

    return (files ?? []).map(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return {
        id: String(f.id),
        name: f.name,
        url: f.download_url ?? f.direct_url ?? '',
        size: f.size,
        format: ext,
      };
    });
  }

  resolveUrl(url: string): string | null {
    // Match https://www.thingiverse.com/thing:12345
    const match = url.match(/thingiverse\.com\/thing:(\d+)/);
    return match ? match[1] : null;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  fetchFile = (url: string): Promise<TransportResponse> => {
    return this.createClient().fetchRaw(url);
  };
}
