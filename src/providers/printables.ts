import { HttpClient } from '../http/client.js';
import type { TransportResponse } from '../http/transport.js';
import type { ModelFile, SearchOptions, SearchResult, SourceProvider } from './types.js';

const SEARCH_QUERY = `
query SearchModels($query: String!, $limit: Int, $offset: Int, $ordering: SearchChoicesEnum) {
  result: searchPrints2(
    query: $query
    limit: $limit
    offset: $offset
    ordering: $ordering
    printType: print
  ) {
    totalCount
    items {
      id
      name
      slug
      likesCount
      downloadCount
      datePublished
      firstPublish
      user {
        id
        handle
        publicUsername
      }
      image {
        filePath
      }
    }
  }
}`;

const PRINT_DETAIL_QUERY = `
query PrintProfile($id: ID!) {
  print(id: $id) {
    id
    name
    slug
    stls {
      id
      name
      fileSize
    }
    gcodes {
      id
      name
      fileSize
    }
    slas {
      id
      name
      fileSize
    }
    otherFiles {
      id
      name
      fileSize
    }
  }
}`;

const DOWNLOAD_LINK_MUTATION = `
mutation GetDownloadLink($printId: ID!, $files: [DownloadFileInput], $source: DownloadSourceEnum!) {
  getDownloadLink(printId: $printId, files: $files, source: $source) {
    ok
    output {
      link
      files {
        id
        link
        fileType
      }
    }
  }
}`;

interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

interface SearchResponse {
  result: {
    totalCount: number;
    items: Array<{
      id: string;
      name: string;
      slug: string;
      likesCount: number;
      downloadCount: number;
      datePublished: string;
      firstPublish: string;
      user: { id: string; handle: string; publicUsername: string };
      image: { filePath: string } | null;
    }>;
  };
}

interface PrintDetailResponse {
  print: {
    id: string;
    name: string;
    slug: string;
    stls: FileEntry[];
    gcodes: FileEntry[];
    slas: FileEntry[];
    otherFiles: FileEntry[];
  };
}

interface FileEntry {
  id: string;
  name: string;
  fileSize: number;
}

interface DownloadLinkResponse {
  getDownloadLink: {
    ok: boolean;
    output: {
      link: string;
      files: Array<{ id: string; link: string; fileType: string }>;
    } | null;
  };
}

export class PrintablesProvider implements SourceProvider {
  readonly name = 'printables';
  private readonly client: HttpClient;

  constructor() {
    this.client = new HttpClient({
      baseUrl: 'https://api.printables.com',
      providerName: 'printables',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const offset = ((options.page ?? 1) - 1) * (options.pageSize ?? 20);
    const ordering = options.sort === 'newest' ? 'latest'
      : options.sort === 'popular' ? 'popular'
      : 'best_match';

    const resp = await this.graphql<SearchResponse>(SEARCH_QUERY, {
      query: options.query,
      limit: options.pageSize ?? 20,
      offset,
      ordering,
    });

    return resp.result.items.map(item => ({
      id: item.id,
      name: item.name,
      creator: item.user.publicUsername || item.user.handle,
      url: `https://www.printables.com/model/${item.id}-${item.slug}`,
      thumbnailUrl: item.image ? `https://media.printables.com/${item.image.filePath}` : undefined,
      likes: item.likesCount,
      downloads: item.downloadCount,
      source: 'printables',
      createdAt: item.firstPublish || item.datePublished,
    }));
  }

  async getFiles(modelId: string): Promise<ModelFile[]> {
    const detail = await this.graphql<PrintDetailResponse>(PRINT_DETAIL_QUERY, {
      id: modelId,
    });

    const p = detail.print;
    const files: ModelFile[] = [];

    const addFiles = (entries: FileEntry[], format: string) => {
      for (const f of entries) {
        files.push({
          id: f.id,
          name: f.name,
          url: '', // Will be resolved via getDownloadLink
          size: f.fileSize,
          format,
        });
      }
    };

    addFiles(p.stls, 'stl');
    addFiles(p.gcodes, 'gcode');
    addFiles(p.slas, 'sla');
    addFiles(p.otherFiles, 'other');

    // Resolve download URLs
    if (files.length > 0) {
      const filesByType = new Map<string, string[]>();
      for (const f of files) {
        const ids = filesByType.get(f.format) ?? [];
        ids.push(f.id);
        filesByType.set(f.format, ids);
      }

      const downloadFiles = [...filesByType.entries()].map(([fileType, ids]) => ({
        fileType,
        ids: ids.map(id => parseInt(id, 10)),
      }));

      try {
        const downloadResp = await this.graphql<DownloadLinkResponse>(DOWNLOAD_LINK_MUTATION, {
          printId: modelId,
          files: downloadFiles,
          source: 'model_detail',
        });

        if (downloadResp.getDownloadLink.ok && downloadResp.getDownloadLink.output) {
          const linkMap = new Map<string, string>();
          for (const f of downloadResp.getDownloadLink.output.files) {
            linkMap.set(f.id, f.link);
          }
          for (const file of files) {
            file.url = linkMap.get(file.id) ?? downloadResp.getDownloadLink.output.link;
          }
        }
      } catch {
        // Download links may fail for paid models — return files without URLs
      }
    }

    return files;
  }

  resolveUrl(url: string): string | null {
    // Match https://www.printables.com/model/12345-slug-name
    const match = url.match(/printables\.com\/model\/(\d+)/);
    return match ? match[1] : null;
  }

  isAvailable(): boolean {
    return true; // No auth required
  }

  fetchFile = (url: string): Promise<TransportResponse> => {
    return this.client.fetchRaw(url);
  };

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const resp = await this.client.post<GraphQLResponse<T>>('/graphql/', {
      query,
      variables,
    });

    if (resp.errors?.length) {
      throw new Error(`Printables GraphQL error: ${resp.errors[0].message}`);
    }

    return resp.data;
  }
}
