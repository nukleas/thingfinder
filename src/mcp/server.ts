import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listSources } from '../lib/sources.js';
import { searchModels } from '../lib/search.js';
import { listFiles } from '../lib/files.js';
import { downloadModel } from '../lib/download.js';

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

  server.registerTool(
    'list_files',
    {
      title: 'List Model Files',
      description: 'List downloadable files for a specific 3D model. Use after search_models to inspect what files are available before downloading.',
      inputSchema: z.object({
        modelId: z.string().describe('Model ID from search results'),
        source: z.string().describe('Source provider name (e.g. "thangs", "printables")'),
      }),
    },
    async ({ modelId, source }) => {
      try {
        const files = await listFiles(modelId, source);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(files, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true as const,
          content: [{ type: 'text' as const, text: (error as Error).message }],
        };
      }
    },
  );

  server.registerTool(
    'download_files',
    {
      title: 'Download Model Files',
      description: 'Download files for a 3D model to the local filesystem. Returns the paths of downloaded files.',
      inputSchema: z.object({
        modelId: z.string().describe('Model ID from search results'),
        source: z.string().describe('Source provider name'),
        outputDir: z.string().optional().describe('Directory to save files. Default: configured download dir or current dir'),
        formats: z.array(z.string()).optional().describe('Only download these formats (e.g. ["stl", "3mf"])'),
      }),
    },
    async ({ modelId, source, outputDir, formats }) => {
      try {
        const result = await downloadModel(modelId, source, { outputDir, formats });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true as const,
          content: [{ type: 'text' as const, text: (error as Error).message }],
        };
      }
    },
  );

  return server;
}
