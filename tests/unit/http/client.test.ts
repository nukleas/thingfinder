import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../../src/http/client.js';

describe('HttpClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should create with default options', () => {
    const client = new HttpClient();
    expect(client).toBeDefined();
  });

  it('should make GET requests with query params', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      headers: new Headers(),
    });

    const client = new HttpClient({ baseUrl: 'https://api.example.com' });
    const result = await client.get<{ data: string }>('/search', { q: 'hello' });

    expect(result).toEqual({ data: 'test' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.example.com/search?q=hello'),
      expect.any(Object),
    );
  });

  it('should make POST requests with JSON body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: true }),
      headers: new Headers(),
    });

    const client = new HttpClient({ baseUrl: 'https://api.example.com' });
    const result = await client.post<{ result: boolean }>('/data', { key: 'value' });

    expect(result).toEqual({ result: true });
  });

  it('should throw on non-OK responses after retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      maxRetries: 0,
    });

    await expect(client.get('/fail')).rejects.toThrow('HTTP 500');
  });

  it('should include custom headers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      headers: new Headers(),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      headers: { Authorization: 'Bearer token123' },
    });
    await client.get('/protected');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
      }),
    );
  });
});
