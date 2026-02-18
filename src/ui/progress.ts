import cliProgress from 'cli-progress';

export function createProgressBar(filename: string) {
  const bar = new cliProgress.SingleBar({
    format: `  ${filename} [{bar}] {percentage}% | {value}/{total} bytes`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  return bar;
}
