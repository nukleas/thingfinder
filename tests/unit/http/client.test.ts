import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from '../../../src/http/client.js';
import type { Transport, TransportResponse, TransportInit } from '../../../src/http/transport.js';

function createMockTransport() {
  const mockFetch = vi.fn<(url: string, init?: TransportInit) => Promise<TransportResponse>>();
  const transport: Transport = { fetch: mockFetch };
  return { transport, mockFetch };
}

function okResponse(data: unknown): TransportResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    json: () => Promise.resolve(data),
    body: null,
  };
}

describe('HttpClient', () => {
  it('should create with default options', () => {
    const client = new HttpClient();
    expect(client).toBeDefined();
  });

  it('should make GET requests with query params', async () => {
    const { transport, mockFetch } = createMockTransport();
    mockFetch.mockResolvedValue(okResponse({ data: 'test' }));

    const client = new HttpClient({ baseUrl: 'https://api.example.com', transport });
    const result = await client.get<{ data: string }>('/search', { q: 'hello' });

    expect(result).toEqual({ data: 'test' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/search?q=hello',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('should make POST requests with JSON body', async () => {
    const { transport, mockFetch } = createMockTransport();
    mockFetch.mockResolvedValue(okResponse({ result: true }));

    const client = new HttpClient({ baseUrl: 'https://api.example.com', transport });
    const result = await client.post<{ result: boolean }>('/data', { key: 'value' });

    expect(result).toEqual({ result: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      }),
    );
  });

  it('should throw on non-OK responses after retries', async () => {
    const { transport, mockFetch } = createMockTransport();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: () => Promise.resolve({}),
      body: null,
    });

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      maxRetries: 0,
      transport,
    });

    await expect(client.get('/fail')).rejects.toThrow('HTTP 500');
  });

  it('should include custom headers', async () => {
    const { transport, mockFetch } = createMockTransport();
    mockFetch.mockResolvedValue(okResponse({}));

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      headers: { Authorization: 'Bearer token123' },
      transport,
    });
    await client.get('/protected');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
      }),
    );
  });

  it('should return raw transport response from fetchRaw', async () => {
    const { transport, mockFetch } = createMockTransport();
    const rawResponse = okResponse({ raw: true });
    mockFetch.mockResolvedValue(rawResponse);

    const client = new HttpClient({ transport });
    const result = await client.fetchRaw('https://example.com/file.stl');

    expect(result).toBe(rawResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/file.stl',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
