import { ProviderRegistry } from './registry.js';
import { ThangsProvider } from './thangs.js';
import { PrintablesProvider } from './printables.js';
import { ThingiverseProvider } from './thingiverse.js';

let registry: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new ProviderRegistry();
    registry.register(new ThangsProvider());
    registry.register(new PrintablesProvider());
    registry.register(new ThingiverseProvider());
  }
  return registry;
}
