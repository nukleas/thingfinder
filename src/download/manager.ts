import { basename, join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getConfigValue } from '../config/store.js';
import { logger } from '../logger.js';
import type { TransportResponse } from '../http/transport.js';
import type { ModelFile } from '../providers/types.js';
import { downloadFile } from './stream.js';

export async function downloadFiles(
  files: ModelFile[],
  outputDir: string | undefined,
  fetchFn: (url: string) => Promise<TransportResponse>,
): Promise<string[]> {
  const dir = outputDir ?? (getConfigValue('downloadDir') as string | undefined) ?? '.';
  await mkdir(dir, { recursive: true });

  const downloaded: string[] = [];

  for (const file of files) {
    if (!file.url) {
      logger.warn(`No download URL for ${file.name}, skipping`);
      continue;
    }

    const safeName = basename(file.name);
    if (!safeName || safeName === '.' || safeName === '..') {
      logger.warn(`Invalid filename for ${file.name}, skipping`);
      continue;
    }
    const destPath = join(dir, safeName);
    if (!resolve(destPath).startsWith(resolve(dir))) {
      logger.warn(`Path traversal detected in ${file.name}, skipping`);
      continue;
    }
    if (existsSync(destPath)) {
      logger.warn(`File already exists: ${destPath}, skipping`);
      downloaded.push(destPath);
      continue;
    }

    logger.info(`Downloading ${file.name}...`);
    try {
      await downloadFile(file.url, destPath, true, fetchFn);
      downloaded.push(destPath);
      logger.info(`  Saved to ${destPath}`);
    } catch (error) {
      logger.error(`  Failed to download ${file.name}: ${(error as Error).message}`);
    }
  }

  return downloaded;
}
