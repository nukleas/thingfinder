import { select, checkbox } from '@inquirer/prompts';
import type { SearchResult, ModelFile } from '../providers/types.js';
import { truncate, formatSize } from './format.js';
import { isPreferred } from '../download/formats.js';

export async function selectModel(results: SearchResult[]): Promise<SearchResult | null> {
  const choices: Array<{ name: string; value: SearchResult | null; description: string }> = results.map(r => ({
    name: `[${r.source}] ${truncate(r.name, 50)} by ${r.creator}`,
    value: r,
    description: r.url,
  }));

  choices.push({
    name: 'Cancel',
    value: null,
    description: 'Exit without downloading',
  });

  const answer = await select<SearchResult | null>({
    message: 'Select a model to download:',
    choices,
    pageSize: 15,
  });

  return answer;
}

export async function selectFiles(files: ModelFile[]): Promise<ModelFile[]> {
  if (files.length === 0) return [];
  if (files.length === 1) return files;

  const choices = files.map(f => ({
    name: `${f.name}${formatSize(f.size)} [${f.format}]`,
    value: f,
    checked: isPreferred(f),
  }));

  const selected = await checkbox<ModelFile>({
    message: 'Select files to download:',
    choices,
  });

  return selected;
}
