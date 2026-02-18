import { describe, it, expect, vi, afterEach } from 'vitest';
import { NativeTransport } from '../../../src/http/transport.js';

describe('NativeTransport', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should delegate to globalThis.fetch', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve({ data: 'test' }),
      body: null,
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const transport = new NativeTransport();
    const response = await transport.fetch('https://example.com', { method: 'GET' });

    expect(response).toBe(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com', { method: 'GET' });
  });

  it('should pass headers and body through', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve({}),
      body: null,
    });

    const transport = new NativeTransport();
    await transport.fetch('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"value"}',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"value"}',
    });
  });
});

describe('ImpitTransport', () => {
  it('should be importable', async () => {
    // ImpitTransport requires native binary — just verify the module exports it
    const mod = await import('../../../src/http/transport.js');
    expect(mod.ImpitTransport).toBeDefined();
  });
});
