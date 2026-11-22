import { createRequire } from 'node:module';

// Read from the package root's package.json at runtime (src/ and dist/ are both
// one level below it), so the CLI/MCP version can never drift from the package.
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export const VERSION = pkg.version;
