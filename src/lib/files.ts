import { getRegistry } from '../providers/index.js';
import { ProviderError } from '../errors.js';
import type { ModelFile } from '../providers/types.js';

export async function listFiles(modelId: string, source: string): Promise<ModelFile[]> {
  const registry = getRegistry();
  const provider = registry.getProvider(source);

  if (!provider) {
    throw new ProviderError(source, `Unknown source: ${source}`);
  }

  if (provider.isBrowseOnly) {
    throw new ProviderError(source, `${source} is browse-only and does not support file listing`);
  }

  return provider.getFiles(modelId);
}
