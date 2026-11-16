import { AuthError, ProviderError } from '../errors.js';
import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import { getConfigValue } from '../config/store.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

interface PolyPizzaCreator {
  UserName?: string;
  DisplayName?: string;
}

interface PolyPizzaModel {
  ID?: string;
  Title?: string;
  Creator?: PolyPizzaCreator;
  Download?: string;
  Thumbnail?: string;
  Category?: string;
  Tags?: string[];
  PublishDate?: string;
}

interface PolyPizzaSearchResponse {
  assets?: PolyPizzaModel[];
  results?: PolyPizzaModel[];
  models?: PolyPizzaModel[];
}

const SITE_URL = 'https://poly.pizza';

export class PolypizzaProvider implements SourceProvider {
  readonly name = 'polypizza';
  private readonly client: HttpClient;

  constructor() {
    this.client = new HttpClient({
      baseUrl: 'https://api.poly.pizza/v1',
      providerName: 'polypizza',
      headers: { Accept: 'application/json' },
    });
  }

  private getApiKey(): string | undefined {
    const envKey = process.env.THINGFINDER_POLYPIZZA_API_KEY;
    if (envKey) return envKey;

    const configKey = getConfigValue('polypizza.apiKey');
    if (configKey) return configKey;

    return undefined;
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AuthError('polypizza');
    }

    const limit = Math.min(options.pageSize ?? 20, 50);
    const resp = await this.client.get<PolyPizzaSearchResponse>('/models', {
      q: options.query,
      limit: String(limit),
      page: String(options.page ?? 1),
      key: apiKey,
    });

    const items = resp.assets ?? resp.results ?? resp.models ?? [];
    return items
      .filter(item => item.ID)
      .map(item => ({
        id: item.ID as string,
        name: item.Title ?? item.ID as string,
        creator: item.Creator?.DisplayName ?? item.Creator?.UserName ?? '',
        url: `${SITE_URL}/${item.ID}`,
        thumbnailUrl: item.Thumbnail,
        likes: 0,
        downloads: 0,
        source: 'polypizza',
        createdAt: item.PublishDate,
      }));
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AuthError('polypizza');
    }

    const resp = await this.client.get<PolyPizzaModel & PolyPizzaSearchResponse>(
      `/models/${encodeURIComponent(modelId)}`,
      { key: apiKey },
    );

    if (!resp.Download) {
      throw new ProviderError('polypizza', `No direct download link for model ${modelId}`);
    }

    return [
      {
        id: modelId,
        name: `${resp.Title ?? modelId}.glb`,
        url: resp.Download,
        format: 'glb',
      },
    ];
  }

  resolveUrl(url: string): string | null {
    const match = url.match(/poly\.pizza\/([A-Za-z0-9-]+)/);
    return match ? match[1] : null;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  fetchFile = (url: string): Promise<TransportResponse> => this.client.fetchRaw(url);
}
