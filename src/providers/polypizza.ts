import { AuthError, ProviderError } from '../errors.js';
import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import { getConfigValue } from '../config/store.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

// Poly Pizza API v1.1: https://poly.pizza/apispec/v1.1.yaml
// Auth is an `x-auth-token` header, required on api.poly.pizza and on the
// static.poly.pizza file CDN alike. Query params are Capitalized; lowercase
// variants are accepted and silently ignored.

interface PolyPizzaModel {
  ID: string;
  Title?: string;
  Thumbnail?: string;
  Download?: string;
  Creator?: { Username?: string };
  Uploaded?: string;
}

interface PolyPizzaSearchResponse {
  total?: number;
  results?: PolyPizzaModel[];
}

const API_URL = 'https://api.poly.pizza/v1.1';
const SITE_URL = 'https://poly.pizza';
/** API maximum for `Limit`. */
const MAX_LIMIT = 32;
const POLY_PIZZA_HOST = /^https:\/\/([a-z0-9-]+\.)*poly\.pizza\//i;

export class PolypizzaProvider implements SourceProvider {
  readonly name = 'polypizza';

  private getApiKey(): string | undefined {
    const envKey = process.env.THINGFINDER_POLYPIZZA_API_KEY;
    if (envKey) return envKey;

    const configKey = getConfigValue('polypizza.apiKey');
    if (configKey) return configKey;

    return undefined;
  }

  private createClient(): HttpClient {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AuthError('polypizza');
    }

    return new HttpClient({
      baseUrl: API_URL,
      providerName: 'polypizza',
      headers: { Accept: 'application/json', 'x-auth-token': apiKey },
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const resp = await this.createClient().get<PolyPizzaSearchResponse>(
      `/search/${encodeURIComponent(options.query)}`,
      {
        Limit: String(Math.min(options.pageSize ?? 20, MAX_LIMIT)),
        // SearchOptions.page is 1-based; the API's Page is 0-based.
        Page: String((options.page ?? 1) - 1),
      },
    );

    return (resp.results ?? []).map(item => ({
      id: item.ID,
      name: item.Title ?? item.ID,
      creator: item.Creator?.Username ?? '',
      url: `${SITE_URL}/m/${item.ID}`,
      thumbnailUrl: item.Thumbnail,
      likes: 0,
      downloads: 0,
      source: 'polypizza',
      createdAt: item.Uploaded,
    }));
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    const model = await this.createClient().get<PolyPizzaModel>(`/model/${encodeURIComponent(modelId)}`);

    if (!model.Download) {
      throw new ProviderError('polypizza', `No direct download link for model ${modelId}`);
    }

    return [
      {
        id: modelId,
        name: `${model.Title ?? modelId}.glb`,
        url: model.Download,
        format: 'glb',
      },
    ];
  }

  resolveUrl(url: string): string | null {
    const match = url.match(/poly\.pizza\/m\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  // The file CDN wants the key too; it is only ever sent to poly.pizza hosts.
  fetchFile = (url: string): Promise<TransportResponse> =>
    POLY_PIZZA_HOST.test(url)
      ? this.createClient().fetchRaw(url)
      : new HttpClient({ providerName: 'polypizza' }).fetchRaw(url);
}
