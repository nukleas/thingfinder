import { getRegistry } from '../providers/index.js';
import { ProviderError } from '../errors.js';
import { downloadFiles } from '../download/manager.js';

export interface DownloadOptions {
  outputDir?: string;
  formats?: string[];
}

export interface DownloadResult {
  files: string[];
}

export async function downloadModel(
  modelId: string,
  source: string,
  options?: DownloadOptions,
): Promise<DownloadResult> {
  const registry = getRegistry();
  const provider = registry.getProvider(source);

  if (!provider) {
    throw new ProviderError(source, `Unknown source: ${source}`);
  }

  if (provider.isBrowseOnly) {
    throw new ProviderError(source, `${source} is browse-only and does not support downloads`);
  }

  let files = await provider.getFiles(modelId);

  if (options?.formats?.length) {
    const fmts = new Set(options.formats.map(f => f.toLowerCase().replace(/^\./, '')));
    files = files.filter(f => fmts.has(f.format.toLowerCase()));
  }

  const downloaded = await downloadFiles(files, options?.outputDir, (url) => provider.fetchFile(url));

  return { files: downloaded };
}
