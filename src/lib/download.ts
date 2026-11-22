import { getRegistry } from '../providers/index.js';
import { ProviderError } from '../errors.js';
import { downloadFiles } from '../download/manager.js';
import { filterByFormat } from '../download/formats.js';

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

  const files = filterByFormat(await provider.getFiles(modelId), options?.formats);

  const downloaded = await downloadFiles(files, options?.outputDir, (url) => provider.fetchFile(url));

  return { files: downloaded };
}
