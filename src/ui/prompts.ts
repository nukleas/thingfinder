import { select, checkbox } from '@inquirer/prompts';
import type { SearchResult, ModelFile } from '../providers/types.js';

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + '\u2026';
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes >= 1_000_000) return ` (${(bytes / 1_000_000).toFixed(1)} MB)`;
  if (bytes >= 1_000) return ` (${(bytes / 1_000).toFixed(1)} KB)`;
  return ` (${bytes} B)`;
}

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
    checked: ['stl', '3mf'].includes(f.format.toLowerCase()),
  }));

  const selected = await checkbox<ModelFile>({
    message: 'Select files to download:',
    choices,
  });

  return selected;
}
