let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function isVerbose(): boolean {
  return verbose;
}

export const logger = {
  info(message: string) {
    console.log(message);
  },
  warn(message: string) {
    console.error(`⚠ ${message}`);
  },
  error(message: string) {
    console.error(`✖ ${message}`);
  },
  debug(message: string) {
    if (verbose) {
      console.error(`[debug] ${message}`);
    }
  },
};
