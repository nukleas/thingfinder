export interface SearchOptions {
  query: string;
  page?: number;
  pageSize?: number;
  sort?: 'relevant' | 'popular' | 'newest';
}

export interface SearchResult {
  id: string;
  name: string;
  creator: string;
  url: string;
  thumbnailUrl?: string;
  likes: number;
  downloads: number;
  source: string;
  createdAt?: string;
}

export interface ModelFile {
  id: string;
  name: string;
  url: string;
  size?: number;
  format: string;
}

export interface FetchFileResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}

export type FetchFileFn = (url: string) => Promise<FetchFileResponse>;

export interface SourceProvider {
  readonly name: string;
  search(options: SearchOptions): Promise<SearchResult[]>;
  getFiles(modelId: string): Promise<ModelFile[]>;
  resolveUrl(url: string): string | null;
  isAvailable(): boolean;
  /** Optional custom fetch for downloading files (e.g. to bypass Cloudflare). */
  fetchFile?: FetchFileFn;
}
