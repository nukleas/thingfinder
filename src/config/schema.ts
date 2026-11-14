import type { Schema } from 'conf';

// conf >=16 requires nested `properties` in the schema for keys below the
// root; dot-separated key paths (e.g. `thingiverse.apiKey`) are resolved by
// conf's dot-prop support at get/set time, not declared as flat schema keys.
export interface ApiKeySection {
  apiKey: string;
}

export interface ThingfinderConfig {
  downloadDir: string;
  thingiverse: ApiKeySection;
  sketchfab: ApiKeySection;
  myminifactory: ApiKeySection;
  cults3d: ApiKeySection;
  preferredFormats: string[];
}

export const configSchema: Schema<ThingfinderConfig> = {
  downloadDir: {
    type: 'string',
    default: '.',
  },
  thingiverse: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', default: '' },
    },
    default: { apiKey: '' },
  },
  sketchfab: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', default: '' },
    },
    default: { apiKey: '' },
  },
  myminifactory: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', default: '' },
    },
    default: { apiKey: '' },
  },
  cults3d: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', default: '' },
    },
    default: { apiKey: '' },
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
