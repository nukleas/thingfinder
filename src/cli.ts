import { Command } from 'commander';
import { createSearchCommand } from './commands/search.js';
import { createDownloadCommand } from './commands/download.js';
import { createConfigCommand } from './commands/config.js';
import { setVerbose } from './logger.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('thingfinder')
    .description('Search and download 3D printing files from multiple sources')
    .version('0.1.0')
    .option('-v, --verbose', 'Enable verbose logging')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.verbose) {
        setVerbose(true);
      }
    });

  program.addCommand(createSearchCommand());
  program.addCommand(createDownloadCommand());
  program.addCommand(createConfigCommand());

  return program;
}
