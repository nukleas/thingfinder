import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node20',
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: { lib: 'src/lib/index.ts' },
    format: ['esm'],
    target: 'node20',
    clean: false,
    splitting: false,
    sourcemap: true,
    dts: true,
  },
]);
