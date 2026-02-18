import { Impit } from 'impit';

/** Minimal response shape both transports return. */
export interface TransportResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  body: ReadableStream<Uint8Array> | null;
}

export interface TransportInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface Transport {
  fetch(url: string, init?: TransportInit): Promise<TransportResponse>;
}

/** Default transport wrapping globalThis.fetch. */
export class NativeTransport implements Transport {
  async fetch(url: string, init?: TransportInit): Promise<TransportResponse> {
    const response = await globalThis.fetch(url, init as globalThis.RequestInit);
    return response;
  }
}

/** Transport using impit to bypass Cloudflare TLS fingerprinting. */
export class ImpitTransport implements Transport {
  private impit = new Impit({ browser: 'chrome' });

  async fetch(url: string, init?: TransportInit): Promise<TransportResponse> {
    const response = await this.impit.fetch(url, init as import('impit').RequestInit);
    return response as TransportResponse;
  }
}
