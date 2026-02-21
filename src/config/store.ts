import Conf from 'conf';
import { configSchema, type ConfigKey, type ThingfinderConfig } from './schema.js';

let store: Conf<ThingfinderConfig> | null = null;

export function getStore(): Conf<ThingfinderConfig> {
  store ??= new Conf<ThingfinderConfig>({
      projectName: 'thingfinder',
      schema: configSchema,
    });
  return store;
}

export function getConfigValue<K extends ConfigKey>(key: K): ThingfinderConfig[K] {
  return getStore().get(key);
}

export function setConfigValue(key: ConfigKey, value: string): void {
  const s = getStore();
  if (key === 'preferredFormats') {
    s.set(key, value.split(',').map(v => v.trim()));
  } else {
    s.set(key, value);
  }
}
