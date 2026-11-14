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

// Dot-separated keys (e.g. `thingiverse.apiKey`) are resolved by conf's
// dot-prop support against the nested schema declared in schema.ts.
export function getConfigValue<K extends ConfigKey>(
  key: K,
): K extends 'preferredFormats' ? string[] : string {
  const s = getStore();
  const value = s.get(key as never);
  return value as K extends 'preferredFormats' ? string[] : string;
}

export function setConfigValue(key: ConfigKey, value: string): void {
  const s = getStore();
  if (key === 'preferredFormats') {
    s.set(key as never, value.split(',').map(v => v.trim()) as never);
  } else {
    s.set(key as never, value as never);
  }
}

/** Positive-number config lookup; unset/0/invalid => undefined. */
export function getConfigNumber(key: ConfigKey): number | undefined {
  const raw = getConfigValue(key);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
