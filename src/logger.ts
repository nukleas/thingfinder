let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function isVerbose(): boolean {
  return verbose;
}

export const logger = {
  info(message: string) {
    // stdout is reserved for machine-readable results and JSON-RPC (MCP);
    // progress text goes to stderr so the stdio transport stays clean.
    console.error(message);
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
