import { createWriteStream } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { DownloadError } from '../errors.js';
import { createProgressBar } from '../ui/progress.js';
import type { FetchFileFn } from '../providers/types.js';

export interface DownloadProgress {
  filename: string;
  bytesDownloaded: number;
  totalBytes: number | null;
}

export async function downloadFile(
  url: string,
  destPath: string,
  showProgress = true,
  customFetch?: FetchFileFn,
): Promise<void> {
  const partialPath = destPath + '.partial';
  const filename = destPath.split('/').pop() ?? 'file';

  let response: { ok: boolean; status: number; statusText: string; headers: { get(name: string): string | null }; body: ReadableStream<Uint8Array> | null };
  try {
    if (customFetch) {
      response = await customFetch(url);
    } else {
      response = await fetch(url, { headers: { Accept: '*/*' } });
    }
  } catch (error) {
    throw new DownloadError(url, `Failed to connect: ${(error as Error).message}`);
  }

  if (!response.ok) {
    throw new DownloadError(url, `HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new DownloadError(url, 'Response has no body');
  }

  const totalBytes = parseInt(response.headers.get('content-length') ?? '0', 10) || null;
  const writeStream = createWriteStream(partialPath);

  let bar: ReturnType<typeof createProgressBar> | null = null;
  if (showProgress && totalBytes) {
    bar = createProgressBar(filename);
    bar.start(totalBytes, 0);
  }

  try {
    let bytesDownloaded = 0;
    const reader = response.body.getReader();
    const nodeReadable = new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        bytesDownloaded += value.byteLength;
        bar?.update(bytesDownloaded);
        this.push(Buffer.from(value));
      },
    });

    await pipeline(nodeReadable, writeStream);
    bar?.stop();

    // Rename .partial to final name
    await rename(partialPath, destPath);
  } catch (error) {
    bar?.stop();
    // Leave .partial file for retry
    throw new DownloadError(url, `Download interrupted: ${(error as Error).message}`);
  }
}

export async function cleanupPartial(destPath: string): Promise<void> {
  try {
    await unlink(destPath + '.partial');
  } catch {
    // Ignore if not exists
  }
}
