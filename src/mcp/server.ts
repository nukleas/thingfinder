import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listSources } from '../lib/sources.js';
import { searchModels } from '../lib/search.js';

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

  server.registerTool(
    'search_models',
    {
      title: 'Search 3D Models',
      description: 'Search for 3D printable models across multiple sources (Thangs, Printables, Thingiverse, Sketchfab, MyMiniFactory, Cults3D)',
      inputSchema: z.object({
        query: z.string().describe('Search query (e.g. "raspberry pi case", "cable clip")'),
        source: z.string().optional().describe('Limit to a specific source (thangs, printables, thingiverse, sketchfab, myminifactory, cults3d)'),
        sort: z.enum(['relevant', 'popular', 'newest']).optional().describe('Sort order. Default: relevant'),
        limit: z.number().optional().describe('Max results per source. Default: 20'),
      }),
    },
    async ({ query, source, sort, limit }) => {
      const result = await searchModels(query, {
        sources: source ? [source] : undefined,
        sort,
        limit,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  return server;
}
