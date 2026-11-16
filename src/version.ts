import { createRequire } from 'node:module';

// Resolved from the package root's package.json at build time (esbuild inlines it),
// so the CLI/MCP version can never drift from the published version.
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export const VERSION = pkg.version;
