# Changelog

## 0.2.0

Most of this release was contributed by [@Whatsmename](https://github.com/Whatsmename).

### Added

- Poly Haven source (no auth) and Poly Pizza source (API key).
- STLFinder and Yeggi meta-search sources (opt-in). They need a FlareSolverr
  endpoint (`flaresolverr.url`) or a `cf_clearance` cookie, and use a persistent
  per-site rate guard with exponential backoff.
- `--version` and the MCP `serverInfo` now report the real package version.

### Fixed

- The MCP server no longer writes progress text to stdout, which corrupted the
  JSON-RPC stream during `download_files`. Info messages and the progress bar
  now go to stderr.
- Printables files report their real format, so `--format stl` no longer
  also downloads `.3mf` files.
- The `preferredFormats` setting (default `stl,3mf`) is now used: `--all`,
  MCP and library downloads take those formats, falling back to every file
  when a model has none. The interactive picker pre-ticks them.

### Changed

- Upgraded every dependency to its current major version. `npm audit` reports
  0 vulnerabilities.
- Requires Node.js `^22.22.2 || ^24.15.0 || >=26`.
- CLI info lines ("No results found.", "Downloaded N file(s)", tips) now print
  to stderr; the results table stays on stdout.
- `config list` masks `cfClearance` cookies as well as API keys.
