import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The MCP server speaks JSON-RPC over stdout. Any progress text written to
// stdout corrupts the stream for real clients (pydantic JSON parse errors).
// This spawns a real process to prove stdout purity, not just a spy.
describe('logger stdout purity (MCP stdio transport)', () => {
  it('logger.info writes to stderr, leaving stdout clean for JSON-RPC', () => {
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        "import { logger } from './src/logger.ts'; logger.info('download-progress-marker');",
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(child.status).toBe(0);
    expect(child.stdout).toBe('');
    expect(child.stderr).toContain('download-progress-marker');
  });

  it('a download through the library layer writes nothing to stdout', () => {
    // Created by the parent (os.tmpdir() honours TMPDIR, works on Windows)
    // and injected into the child; cleaned up in finally.
    const dir = mkdtempSync(join(tmpdir(), 'tf-stdout-'));
    try {
      const child = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          [
            "import { downloadFiles } from './src/download/manager.ts';",
            `const dir = ${JSON.stringify(dir)};`,
            "const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1,2,3])); c.close(); } });",
            "const fetchFn = async () => ({ ok: true, status: 200, statusText: 'OK', headers: new Headers({ 'content-length': '3' }), body });",
            "const paths = await downloadFiles([{ id: 'x', source: 'test', name: 'x.stl', url: 'https://example.invalid/x.stl' }], dir, fetchFn);",
            "if (paths.length !== 1) process.exit(9);",
          ].join(' '),
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      // The download must succeed (exit 0) while stdout stays byte-clean.
      expect(child.stdout).toBe('');
      expect(child.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
