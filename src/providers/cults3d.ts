import { AuthError, ProviderError } from '../errors.js';
import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import { getConfigValue } from '../config/store.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

const SEARCH_QUERY = `
query SearchCreations($query: String!, $limit: Int) {
  creationsSearchBatch(query: $query, limit: $limit) {
    total
    results {
      name(locale: EN)
      shortUrl
      illustrationImageUrl
      publishedAt
      likesCount
      downloadsCount
      price(currency: USD) { cents }
      creator {
        nick
      }
    }
  }
}`;

interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

interface Cults3dSearchResponse {
  creationsSearchBatch: {
    total: number;
    results: Array<{
      name: string;
      shortUrl: string;
      illustrationImageUrl: string | null;
      publishedAt: string;
      likesCount: number;
      downloadsCount: number;
      price: { cents: number } | null;
      creator: { nick: string };
    }>;
  };
}

export class Cults3dProvider implements SourceProvider {
  readonly name = 'cults3d';
  readonly isBrowseOnly = true;

  private getApiKey(): string | undefined {
    const envKey = process.env.THINGFINDER_CULTS3D_API_KEY;
    if (envKey) return envKey;

    const configKey = getConfigValue('cults3d.apiKey');
    if (configKey) return configKey;

    return undefined;
  }

  private createClient(): HttpClient {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AuthError('cults3d');
    }

    const encoded = Buffer.from(apiKey).toString('base64');

    return new HttpClient({
      baseUrl: 'https://cults3d.com',
      providerName: 'cults3d',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const client = this.createClient();
    const limit = Math.min(options.pageSize ?? 20, 20);

    const resp = await client.post<GraphQLResponse<Cults3dSearchResponse>>('/graphql', {
      query: SEARCH_QUERY,
      variables: { query: options.query, limit },
    });

    if (resp.errors?.length) {
      throw new ProviderError('cults3d', `GraphQL error: ${resp.errors[0].message}`);
    }

    return resp.data.creationsSearchBatch.results
      .filter(item => item.price === null || item.price.cents === 0)
      .map(item => ({
        id: this.slugFromUrl(item.shortUrl) ?? item.name,
        name: item.name,
        creator: item.creator.nick,
        url: item.shortUrl,
        thumbnailUrl: item.illustrationImageUrl ?? undefined,
        likes: item.likesCount,
        downloads: item.downloadsCount,
        source: 'cults3d',
        createdAt: item.publishedAt,
      }));
  }

  getFiles(_modelId: string): Promise<ModelFile[]> {
    // Cults3D does not allow file downloads via API
    return Promise.resolve([]);
  }

  resolveUrl(url: string): string | null {
    const match = url.match(/cults3d\.com\/(?:[a-z]{2}\/)?3d-model\/[\w-]+\/([\w-]+)/);
    return match ? match[1] : null;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  fetchFile = (_url: string): Promise<TransportResponse> => {
    throw new ProviderError('cults3d', 'Cults3D does not support file downloads via API. Use the browser to download.');
  };

  private slugFromUrl(url: string): string | null {
    const match = url.match(/\/3d-model\/[\w-]+\/([\w-]+)/);
    return match ? match[1] : null;
  }
}
