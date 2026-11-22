import { ProviderRegistry } from './registry.js';
import { ThangsProvider } from './thangs.js';
import { PrintablesProvider } from './printables.js';
import { ThingiverseProvider } from './thingiverse.js';
import { SketchfabProvider } from './sketchfab.js';
import { MyMiniFactoryProvider } from './myminifactory.js';
import { Cults3dProvider } from './cults3d.js';
import { PolyhavenProvider } from './polyhaven.js';
import { PolypizzaProvider } from './polypizza.js';
import { StlfinderProvider } from './stlfinder.js';

let registry: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new ProviderRegistry();
    registry.register(new ThangsProvider());
    registry.register(new PrintablesProvider());
    registry.register(new ThingiverseProvider());
    registry.register(new SketchfabProvider());
    registry.register(new MyMiniFactoryProvider());
    registry.register(new Cults3dProvider());
    registry.register(new PolyhavenProvider());
    registry.register(new PolypizzaProvider());
    registry.register(new StlfinderProvider());
  }
  return registry;
}

/** Comma-separated names of every registered source, for help text. */
export function sourceNames(): string {
  return getRegistry().getAll().map(p => p.name).join(', ');
}
