import Conf from 'conf';
import { configSchema, isNumericKey, type ConfigKey, type ThingfinderConfig } from './schema.js';

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
  return value;
}

export function setConfigValue(key: ConfigKey, value: string): void {
  const s = getStore();
  if (key === 'preferredFormats') {
    s.set(key as never, value.split(',').map(v => v.trim()) as never);
  } else if (isNumericKey(key)) {
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n) || n < 0) {
      throw new Error(`${key} must be a non-negative number (got "${value}")`);
    }
    s.set(key as never, n as never);
  } else {
    s.set(key as never, value as never);
  }
}

/** Positive-number config lookup; unset/0/invalid => undefined. */
export function getConfigNumber(key: ConfigKey): number | undefined {
  const n = Number(getStore().get(key as never));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
