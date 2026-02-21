import type { Schema } from 'conf';

export interface ThingfinderConfig {
  downloadDir: string;
  'thingiverse.apiKey': string;
  'sketchfab.apiKey': string;
  'myminifactory.apiKey': string;
  'cults3d.apiKey': string;
  preferredFormats: string[];
}

export const configSchema: Schema<ThingfinderConfig> = {
  downloadDir: {
    type: 'string',
    default: '.',
  },
  'thingiverse.apiKey': {
    type: 'string',
    default: '',
  },
  'sketchfab.apiKey': {
    type: 'string',
    default: '',
  },
  'myminifactory.apiKey': {
    type: 'string',
    default: '',
  },
  'cults3d.apiKey': {
    type: 'string',
    default: '',
  },
  preferredFormats: {
    type: 'array',
    items: { type: 'string' },
    default: ['stl', '3mf'],
  },
};

export const configKeys = [
  'downloadDir',
  'thingiverse.apiKey',
  'sketchfab.apiKey',
  'myminifactory.apiKey',
  'cults3d.apiKey',
  'preferredFormats',
] as const;

export type ConfigKey = (typeof configKeys)[number];

export function isValidKey(key: string): key is ConfigKey {
  return (configKeys as readonly string[]).includes(key);
}
