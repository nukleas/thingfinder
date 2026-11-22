import { describe, it, expect, vi } from 'vitest';
import type { ModelFile } from '../../../src/providers/types.js';

vi.mock('../../../src/config/store.js', () => ({
  getConfigValue: () => ['stl', '3mf'],
}));

const { filterByFormat } = await import('../../../src/download/formats.js');

const file = (format: string): ModelFile => ({ id: format, name: `part.${format}`, url: '', format });
const mixed = [file('stl'), file('3mf'), file('bgcode'), file('step')];

describe('filterByFormat', () => {
  it('defaults to the preferred formats (STL and 3MF)', () => {
    expect(filterByFormat(mixed).map(f => f.format)).toEqual(['stl', '3mf']);
  });

  it('falls back to every file when none are preferred', () => {
    const gltfOnly = [file('glb'), file('gltf')];
    expect(filterByFormat(gltfOnly)).toEqual(gltfOnly);
  });

  it('filters strictly by explicit formats, case and dot insensitive', () => {
    expect(filterByFormat(mixed, ['.3MF']).map(f => f.format)).toEqual(['3mf']);
    expect(filterByFormat([file('glb')], ['stl'])).toEqual([]);
  });
});
