import { ProviderRegistry } from './registry.js';
import { ThangsProvider } from './thangs.js';
import { PrintablesProvider } from './printables.js';
import { ThingiverseProvider } from './thingiverse.js';
import { SketchfabProvider } from './sketchfab.js';
import { MyMiniFactoryProvider } from './myminifactory.js';
import { Cults3dProvider } from './cults3d.js';

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
  }
  return registry;
}
