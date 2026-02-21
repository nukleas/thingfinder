import { Command } from 'commander';
import { getRegistry } from '../providers/index.js';
import { HttpClient } from '../http/client.js';
import { downloadFiles } from '../download/manager.js';
import { downloadFile } from '../download/stream.js';
import { selectFiles } from '../ui/prompts.js';
import { createSpinner } from '../ui/spinner.js';
import { logger } from '../logger.js';
import { basename, join } from 'node:path';
import { getConfigValue } from '../config/store.js';

export function createDownloadCommand(): Command {
  return new Command('download')
    .description('Download files from a 3D model URL')
    .argument('<url>', 'Model URL or direct file URL')
    .option('-o, --output <dir>', 'Download directory')
    .option('-a, --all', 'Download all files without prompting')
    .option('-f, --format <formats...>', 'Only download these file formats (e.g. stl 3mf)')
    .action(async (url: string, options: { output?: string; all?: boolean; format?: string[] }) => {
      const outputDir = options.output ?? getConfigValue('downloadDir');

      // Check if it's a direct file URL
      if (/\.(stl|3mf|obj|step|gcode|zip)$/i.test(url)) {
        const filename = basename(new URL(url).pathname) || 'download';
        const destPath = join(outputDir, filename);
        const client = new HttpClient({ providerName: 'direct' });
        logger.info(`Downloading ${filename}...`);
        await downloadFile(url, destPath, true, (u) => client.fetchRaw(u));
        logger.info(`Saved to ${destPath}`);
        return;
      }

      // Try to resolve URL to a provider
      const registry = getRegistry();
      const resolved = registry.resolveUrl(url);

      if (!resolved) {
        logger.error('Could not match URL to any known provider.');
        logger.info('Supported: thingiverse.com, printables.com, thangs.com, sketchfab.com, myminifactory.com, cults3d.com');
        logger.info('You can also provide a direct .stl/.3mf file URL.');
        process.exit(1);
      }

      const { provider, modelId } = resolved;
      logger.debug(`Resolved to ${provider.name} model ${modelId}`);

      if (provider.isBrowseOnly) {
        logger.info(`${provider.name} does not support direct downloads.`);
        logger.info(`Opening ${url} in browser...`);
        const { exec } = await import('node:child_process');
        const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${cmd} ${JSON.stringify(url)}`);
        return;
      }

      const spinner = createSpinner(`Fetching files from ${provider.name}...`);
      spinner.start();
      const files = await provider.getFiles(modelId);
      spinner.stop();

      let filtered = files;
      if (options.format?.length) {
        const fmts = new Set(options.format.map(f => f.toLowerCase().replace(/^\./, '')));
        filtered = files.filter(f => fmts.has(f.format.toLowerCase()));
      }

      if (filtered.length === 0) {
        logger.info('No downloadable files found.');
        return;
      }

      let filesToDownload = filtered;
      if (!options.all && filtered.length > 1) {
        filesToDownload = await selectFiles(files);
        if (filesToDownload.length === 0) {
          logger.info('No files selected.');
          return;
        }
      }

      const downloaded = await downloadFiles(filesToDownload, outputDir, (u) => provider.fetchFile(u));
      console.log();
      logger.info(`Downloaded ${downloaded.length} file(s)`);
    });
}
