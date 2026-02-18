import { Command } from 'commander';
import { getRegistry } from '../providers/index.js';
import { formatResultsTable } from '../ui/table.js';
import { selectModel, selectFiles } from '../ui/prompts.js';
import { downloadFiles } from '../download/manager.js';
import { createSpinner } from '../ui/spinner.js';
import { logger } from '../logger.js';
import type { SearchResult } from '../providers/types.js';

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createSearchCommand(): Command {
  return new Command('search')
    .description('Search for 3D models across multiple sources')
    .argument('<query>', 'Search query')
    .option('-i, --interactive', 'Interactive mode: select and download files')
    .option('-s, --source <sources...>', 'Only search specific sources (thangs, printables, thingiverse)')
    .option('--sort <order>', 'Sort order: relevant, popular, newest', 'relevant')
    .option('-n, --limit <count>', 'Max results per source', '20')
    .option('-o, --output <dir>', 'Download directory')
    .option('-f, --format <formats...>', 'Preferred file formats (e.g. stl 3mf)')
    .action(async (query: string, options: {
      interactive?: boolean;
      source?: string[];
      sort?: string;
      limit?: string;
      output?: string;
      format?: string[];
    }) => {
      const registry = getRegistry();
      const available = registry.getAvailable();

      if (available.length === 0) {
        logger.error('No providers available. Configure at least one source.');
        logger.info('Thangs and Printables work without configuration.');
        process.exit(1);
      }

      const spinner = createSpinner(`Searching for "${query}"...`);
      spinner.start();

      const { results, errors } = await registry.searchAll(
        {
          query,
          pageSize: parseInt(options.limit ?? '20', 10),
          sort: (options.sort as 'relevant' | 'popular' | 'newest') ?? 'relevant',
        },
        options.source,
      );

      spinner.stop();

      if (errors.length > 0) {
        for (const e of errors) {
          logger.warn(`${e.provider}: ${e.error.message}`);
        }
      }

      const deduplicated = deduplicateResults(results);

      if (deduplicated.length === 0) {
        logger.info('No results found.');
        return;
      }

      if (options.interactive) {
        await interactiveMode(deduplicated, options.output, options.format);
      } else {
        console.log();
        console.log(formatResultsTable(deduplicated));
        console.log();
        console.log(`${deduplicated.length} results from ${available.length} source(s)`);
      }
    });
}

async function interactiveMode(results: SearchResult[], outputDir?: string, formats?: string[]) {
  const selected = await selectModel(results);
  if (!selected) return;

  const registry = getRegistry();
  const provider = registry.getProvider(selected.source);
  if (!provider) {
    logger.error(`Provider ${selected.source} not found`);
    return;
  }

  const spinner = createSpinner('Fetching file list...');
  spinner.start();
  let files = await provider.getFiles(selected.id);
  spinner.stop();

  if (formats?.length) {
    const fmts = new Set(formats.map(f => f.toLowerCase().replace(/^\./, '')));
    files = files.filter(f => fmts.has(f.format.toLowerCase()));
  }

  if (files.length === 0) {
    logger.info('No downloadable files found for this model.');
    return;
  }

  const selectedFiles = await selectFiles(files);
  if (selectedFiles.length === 0) {
    logger.info('No files selected.');
    return;
  }

  const downloaded = await downloadFiles(selectedFiles, outputDir, provider.fetchFile);
  console.log();
  logger.info(`Downloaded ${downloaded.length} file(s)`);
}
