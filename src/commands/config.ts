import { Command } from 'commander';
import { getStore, getConfigValue, setConfigValue } from '../config/store.js';
import { configKeys, isValidKey } from '../config/schema.js';

export function createConfigCommand(): Command {
  const cmd = new Command('config')
    .description('Manage thingfinder configuration');

  cmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key: string, value: string) => {
      if (!isValidKey(key)) {
        console.error(`Unknown config key: ${key}`);
        console.error(`Valid keys: ${configKeys.join(', ')}`);
        process.exit(1);
      }
      setConfigValue(key, value);
      console.log(`Set ${key} = ${value}`);
    });

  cmd
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      if (!isValidKey(key)) {
        console.error(`Unknown config key: ${key}`);
        console.error(`Valid keys: ${configKeys.join(', ')}`);
        process.exit(1);
      }
      const value = getConfigValue(key);
      const display = typeof value === 'string' ? value : JSON.stringify(value);
      console.log(display !== '' ? display : '(not set)');
    });

  cmd
    .command('list')
    .description('List all configuration values')
    .action(() => {
      const store = getStore();
      for (const key of configKeys) {
        const value = store.get(key);
        const display = key.endsWith('.apiKey') && value
          ? '****' + String(value).slice(-4)
          : String(value) || '(not set)';
        console.log(`${key} = ${display}`);
      }
    });

  cmd
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      console.log(getStore().path);
    });

  return cmd;
}
