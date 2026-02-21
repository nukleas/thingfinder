import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listSources } from '../lib/sources.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'thingfinder',
    version: '0.1.0',
  });

  server.registerTool(
    'list_sources',
    {
      title: 'List Sources',
      description: 'List all available 3D model sources and their status',
    },
    () => {
      const sources = listSources();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(sources, null, 2) }],
      };
    },
  );

  return server;
}
