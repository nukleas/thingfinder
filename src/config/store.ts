import Conf from 'conf';
import { configSchema, type ThingfinderConfig } from './schema.js';

let store: Conf<ThingfinderConfig> | null = null;

export function getStore(): Conf<ThingfinderConfig> {
  if (!store) {
    store = new Conf<ThingfinderConfig>({
      projectName: 'thingfinder',
      schema: configSchema,
    });
  }
  return store;
}

export function getConfigValue(key: string): unknown {
  return getStore().get(key as keyof ThingfinderConfig);
}

export function setConfigValue(key: string, value: unknown) {
  const s = getStore();
  if (key === 'preferredFormats' && typeof value === 'string') {
    s.set(key as keyof ThingfinderConfig, value.split(',').map(v => v.trim()) as never);
  } else {
    s.set(key as keyof ThingfinderConfig, value as never);
  }
}
