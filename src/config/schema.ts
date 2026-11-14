import type { Schema } from 'conf';

// conf >=16 requires nested `properties` in the schema for keys below the
// root; dot-separated key paths (e.g. `thingiverse.apiKey`) are resolved by
// conf's dot-prop support at get/set time, not declared as flat schema keys.
export interface ApiKeySection {
  apiKey: string;
}

export interface BrowserClearanceSection {
  userAgent: string;
  cfClearance: string;
  minIntervalSeconds: number;
  cooldownMinutes: number;
}

export interface FlareSolverrSection {
  url: string;
}

export interface ThingfinderConfig {
  downloadDir: string;
  thingiverse: ApiKeySection;
  sketchfab: ApiKeySection;
  myminifactory: ApiKeySection;
  cults3d: ApiKeySection;
  polypizza: ApiKeySection;
  stlfinder: BrowserClearanceSection;
  yeggi: BrowserClearanceSection;
  flaresolverr: FlareSolverrSection;
  preferredFormats: string[];
}

const apiKeySection = {
  type: 'object',
  properties: {
    apiKey: { type: 'string', default: '' },
  },
  default: { apiKey: '' },
} as const;

const clearanceSection = {
  type: 'object',
  properties: {
    userAgent: { type: 'string', default: '' },
    cfClearance: { type: 'string', default: '' },
    minIntervalSeconds: { type: 'number', default: 0 },
    cooldownMinutes: { type: 'number', default: 0 },
  },
  default: { userAgent: '', cfClearance: '', minIntervalSeconds: 0, cooldownMinutes: 0 },
} as const;

export const configSchema: Schema<ThingfinderConfig> = {
  downloadDir: {
    type: 'string',
    default: '.',
  },
  thingiverse: apiKeySection,
  sketchfab: apiKeySection,
  myminifactory: apiKeySection,
  cults3d: apiKeySection,
  polypizza: apiKeySection,
  stlfinder: clearanceSection,
  yeggi: clearanceSection,
  flaresolverr: {
    type: 'object',
    properties: {
      url: { type: 'string', default: '' },
    },
    default: { url: '' },
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
  'polypizza.apiKey',
  'stlfinder.userAgent',
  'stlfinder.cfClearance',
  'stlfinder.minIntervalSeconds',
  'stlfinder.cooldownMinutes',
  'yeggi.userAgent',
  'yeggi.cfClearance',
  'yeggi.minIntervalSeconds',
  'yeggi.cooldownMinutes',
  'flaresolverr.url',
  'preferredFormats',
] as const;

export type ConfigKey = (typeof configKeys)[number];

export function isValidKey(key: string): key is ConfigKey {
  return (configKeys as readonly string[]).includes(key);
}
