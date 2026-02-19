import { NetworkError, RateLimitError } from '../errors.js';
import { logger } from '../logger.js';
import { RateLimiter } from './rate-limiter.js';
import type { Transport, TransportInit, TransportResponse } from './transport.js';
import { NativeTransport } from './transport.js';

export interface HttpClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  providerName?: string;
  transport?: Transport;
}

export class HttpClient {
  private readonly rateLimiter = new RateLimiter(5, 1000);
  private readonly transport: Transport;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly providerName: string;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.headers = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 3;
    this.providerName = options.providerName ?? 'unknown';
    this.transport = options.transport ?? new NativeTransport();
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = this.baseUrl + path;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += (url.includes('?') ? '&' : '?') + qs;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.baseUrl + path;
    return this.request<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async fetchRaw(url: string, init?: TransportInit): Promise<TransportResponse> {
    await this.rateLimiter.acquire();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.transport.fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { ...this.headers, ...init?.headers },
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request<T>(url: string, init: TransportInit): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        logger.debug(`Retry ${attempt}/${this.maxRetries} for ${url} in ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        await this.rateLimiter.acquire();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: TransportResponse;
        try {
          response = await this.transport.fetch(url, {
            ...init,
            signal: controller.signal,
            headers: { ...this.headers, ...init.headers },
          });
        } finally {
          clearTimeout(timeout);
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const parsedRetry = retryAfter ? parseInt(retryAfter, 10) : NaN;
          const retryMs = !isNaN(parsedRetry) ? Math.min(parsedRetry, 120) * 1000 : undefined;
          if (retryMs && retryMs > 30000) {
            throw new RateLimitError(this.providerName, retryMs);
          }
          lastError = new RateLimitError(this.providerName, retryMs);
          if (retryMs) {
            await new Promise(resolve => setTimeout(resolve, retryMs));
          }
          continue;
        }

        if (!response.ok) {
          const err = new NetworkError(`HTTP ${response.status}: ${response.statusText} for ${url}`);
          // Don't retry client errors (4xx) except 429 (handled above)
          if (response.status >= 400 && response.status < 500) {
            throw err;
          }
          lastError = err;
          continue;
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof RateLimitError && error.retryAfterMs && error.retryAfterMs > 30000) {
          throw error;
        }
        // Don't retry client errors (4xx) — re-throw immediately
        if (error instanceof NetworkError && error.message.match(/^HTTP 4\d\d:/)) {
          throw error;
        }
        lastError = error as Error;
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new NetworkError(`Request timeout after ${this.timeoutMs}ms for ${url}`);
        }
      }
    }

    throw lastError ?? new NetworkError(`Request failed for ${url}`);
  }
}
