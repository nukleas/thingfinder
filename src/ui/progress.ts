import cliProgress from 'cli-progress';

export function createProgressBar(filename: string): cliProgress.SingleBar {
  const bar = new cliProgress.SingleBar({
    format: `  ${filename} [{bar}] {percentage}% | {value}/{total} bytes`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    // Render on stderr: stdout carries CLI results and MCP JSON-RPC.
    // Non-TTY stderr (pipeds/MCP) suppresses bar rendering entirely.
    stream: process.stderr,
  });

  return bar;
}
