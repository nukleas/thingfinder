import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/providers/index.js', async () => {
  const { ProviderRegistry } = await vi.importActual<typeof import('../../../src/providers/registry.js')>('../../../src/providers/registry.js');
  const registry = new ProviderRegistry();
  registry.register({
    name: 'thangs',
    search: vi.fn().mockResolvedValue([]),
    getFiles: vi.fn().mockResolvedValue([]),
    resolveUrl: vi.fn().mockReturnValue(null),
    isAvailable: vi.fn().mockReturnValue(true),
    fetchFile: vi.fn(),
  });
  registry.register({
    name: 'cults3d',
    isBrowseOnly: true,
    search: vi.fn().mockResolvedValue([]),
    getFiles: vi.fn().mockResolvedValue([]),
    resolveUrl: vi.fn().mockReturnValue(null),
    isAvailable: vi.fn().mockReturnValue(false),
    fetchFile: vi.fn(),
  });
  return { getRegistry: () => registry };
});

import { createServer } from '../../../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

describe('MCP Server', () => {
  it('should handle list_sources tool', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({ name: 'list_sources', arguments: {} });

    expect(result.content).toHaveLength(1);
    const content = result.content[0];
    expect(content).toHaveProperty('type', 'text');
    const parsed = JSON.parse((content as { type: 'text'; text: string }).text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ name: 'thangs', available: true, isBrowseOnly: false });
    expect(parsed[1]).toEqual({ name: 'cults3d', available: false, isBrowseOnly: true });
  });
});
