# thingfinder

[![CI](https://github.com/nukleas/thingfinder/actions/workflows/ci.yml/badge.svg)](https://github.com/nukleas/thingfinder/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/thingfinder)](https://www.npmjs.com/package/thingfinder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CLI tool, library, and MCP server for searching and downloading 3D printing files.

Search **Thangs**, **Printables**, **Thingiverse**, and more from a single command. No more opening a dozen browser tabs.

## Quick Start

```bash
# Run instantly with npx (no install needed)
npx thingfinder search "benchy"

# Or install globally
npm install -g thingfinder
```

Requires Node.js 22.22+, 24.15+, or 26+.

## Why thingfinder?

- **One search, multiple sources** - Query every configured source simultaneously
- **Terminal-native** - Fits into scripting and automation workflows
- **No browser needed** - Search and download without leaving your terminal
- **Interactive or scripted** - Use `-i` for interactive file selection, or `--all` for batch downloads

## Usage

### Search

```bash
# Search all available sources
thingfinder search "benchy"

# Search a specific source
thingfinder search "dragon" --source printables

# Limit results per source
thingfinder search "vase" --limit 5

# Sort by popularity or newest
thingfinder search "gear" --sort popular

# Interactive mode: select a model, pick files, download
thingfinder search "benchy" -i

# Filter to specific file formats in interactive mode
thingfinder search "benchy" -i --format stl 3mf
```

### Download

```bash
# Download from a model URL
thingfinder download https://www.printables.com/model/3161-3d-benchy

# Download all files without prompting
thingfinder download https://www.thingiverse.com/thing:763622 --all

# Download to a specific directory
thingfinder download https://thangs.com/m/1234567 -o ~/prints

# Download a direct file URL
thingfinder download https://example.com/model.stl

# Only download STL files
thingfinder download https://www.printables.com/model/3161 --format stl
```

### Config

```bash
# Set default download directory
thingfinder config set downloadDir ~/prints

# Set Thingiverse API key
thingfinder config set thingiverse.apiKey YOUR_KEY

# Set preferred file formats
thingfinder config set preferredFormats stl,3mf

# View a config value
thingfinder config get downloadDir

# List all config
thingfinder config list

# Show config file path
thingfinder config path
```

## Sources

| Source | Auth Required | Type | Notes |
|--------|--------------|------|-------|
| **Thangs** | No | Search + download | Aggregates models from 90+ sites. Works out of the box. |
| **Printables** | No | Search + download | Prusa's model repository. Search + direct download. |
| **Poly Haven** | No | Search + download | CC0 models/materials with direct CDN download links (blend, fbx, gltf, obj, usd + textures). |
| **Thingiverse** | Yes (API key) | Search + download | Requires an app token from [thingiverse.com/apps/create](https://www.thingiverse.com/apps/create). |
| **Sketchfab** | Yes (API token) | Search + download | Free API token from Sketchfab account settings. |
| **MyMiniFactory** | Yes (API key) | Search + download | Free API key from MyMiniFactory developer settings. |
| **Cults3D** | Yes (API key) | Search only | Cults3D's API does not allow downloading other users' files. |
| **Poly Pizza** | Yes (API key) | Search + download | Free low-poly CC0/CC-BY models (GLB). Free API key from [poly.pizza/settings/api](https://poly.pizza/settings/api). |
| **STLFinder** | Opt-in* | Search only | Meta-search across 3D sites; links out to the source site. |
| **Yeggi** | Opt-in* | Search only | Meta-search across 3D sites; links out to the source site. |

\* STLFinder and Yeggi sit behind Cloudflare bot challenges that plain HTTP
clients cannot pass, so they are **off until you configure them**. The
recommended way is a **FlareSolverr** endpoint on your network (a headless
browser that solves the challenge and returns the page):

```bash
thingfinder config set flaresolverr.url http://your-host:8192/v1
```

Searches then go through the solver automatically (a temporary browser per
request, clear verdicts when a solver times out or the site's backend is down).

> **Use at your own risk.** Getting past a site's bot protection may go against
> its terms of service, and the site may rate-limit or block your IP or
> account. Turning these sources on means you accept that risk.

**Rate limiting & backoff.** These two sources share a persistent per-site
guard (state file next to your config). Yeggi defaults to a minimum of 20 s
between requests; after a blocked attempt (403/challenge/solver timeout/site
500) the provider retries once, then cools down — 15 minutes for yeggi, 5 for
STLFinder — doubling per repeat up to 2 hours. During cooldown the source
fails instantly with `Rate limited. Retry after Xs` and the other sources
proceed. Tune per site:

```bash
thingfinder config set yeggi.minIntervalSeconds 60
thingfinder config set yeggi.cooldownMinutes     30
thingfinder config set yeggi.solverTimeoutSeconds 60
thingfinder config set stlfinder.minIntervalSeconds 5
```

Yeggi's defaults are deliberately conservative (20 s spacing, 15-minute base
cooldown, 60 s solver challenge budget — its challenge rarely clears past a
minute, so it fails fast and backs off). STLFinder keeps the full 120 s
budget.

Without a solver, these two sources only work with a `cf_clearance` cookie +
User-Agent copied from your own browser **on the same network**:

```bash
thingfinder config set stlfinder.cfClearance <cookie value>
thingfinder config set stlfinder.userAgent  "<the User-Agent that got the cookie>"
thingfinder config set yeggi.cfClearance     <cookie value>
thingfinder config set yeggi.userAgent       "<the User-Agent that got the cookie>"
```

Without either, these two sources are skipped.

### Poly Pizza Setup

Create an app at [poly.pizza/settings/api](https://poly.pizza/settings/api) (free account) and copy its API key, then:

```bash
thingfinder config set polypizza.apiKey YOUR_KEY
# or: export THINGFINDER_POLYPIZZA_API_KEY=YOUR_KEY
```

### Thingiverse Setup

1. Create an account at [thingiverse.com](https://www.thingiverse.com)
2. Go to [thingiverse.com/apps/create](https://www.thingiverse.com/apps/create)
3. Create a "Web App" and copy your App Token
4. Configure thingfinder:

```bash
thingfinder config set thingiverse.apiKey YOUR_APP_TOKEN
```

Or set the environment variable:

```bash
export THINGFINDER_THINGIVERSE_API_KEY=YOUR_APP_TOKEN
```

## Options

```
Usage: thingfinder [options] [command]

Options:
  -V, --version             output the version number
  -v, --verbose             Enable verbose logging
  -h, --help                display help for command

Commands:
  search [options] <query>  Search for 3D models across multiple sources
  download [options] <url>  Download files from a 3D model URL
  config                    Manage thingfinder configuration
```

### Search Options

| Flag | Description |
|------|-------------|
| `-i, --interactive` | Select and download files interactively |
| `-s, --source <sources...>` | Only search specific sources |
| `--sort <order>` | Sort: `relevant`, `popular`, `newest` |
| `-n, --limit <count>` | Max results per source (default: 20) |
| `-o, --output <dir>` | Download directory |
| `-f, --format <formats...>` | Filter files by format (e.g. `stl 3mf`) |

### Download Options

| Flag | Description |
|------|-------------|
| `-o, --output <dir>` | Download directory |
| `-a, --all` | Download all files without prompting |
| `-f, --format <formats...>` | Only download these file formats |

## MCP Server

Thingfinder includes a [Model Context Protocol](https://modelcontextprotocol.io/) server, allowing AI agents (Claude, etc.) to search and download 3D models.

### Setup with Claude Code

```bash
# After a global install (npm install -g thingfinder):
claude mcp add thingfinder thingfinder-mcp

# Or from a local clone:
npm run build
claude mcp add thingfinder node /path/to/thingfinder/dist/mcp.js
```

Or manually add to your project's `mcpServers` in `~/.claude.json`:

```json
{
  "mcpServers": {
    "thingfinder": {
      "type": "stdio",
      "command": "thingfinder-mcp"
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `list_sources` | List all available 3D model providers and their status |
| `search_models` | Search for models across providers (with optional source, sort, limit) |
| `list_files` | List downloadable files for a specific model |
| `download_files` | Download model files (with optional format filtering) |

## Library

Use thingfinder programmatically in your own Node.js projects:

```bash
npm install thingfinder
```

```typescript
import { searchModels, listFiles, downloadModel, listSources } from 'thingfinder/lib';

// List available providers
const sources = listSources();

// Search for models
const { results, errors } = await searchModels('benchy', {
  sources: ['printables'],
  sort: 'popular',
  limit: 5,
});

// List files for a model
const files = await listFiles('694802', 'printables');

// Download model files
const { files: downloaded } = await downloadModel('694802', 'printables', {
  outputDir: './downloads',
  formats: ['stl', '3mf'],
});
```

## Error Handling

- If a source fails, others still return results
- Rate limits (429) are retried with backoff
- Network errors retry 3 times with exponential backoff
- Failed downloads are saved as `.partial` files for retry
- Sources that are not configured (API key, solver) are skipped

## Development

```bash
# Install dependencies
npm install

# Run in development
npx tsx src/index.ts search "benchy"

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## Acknowledgements

- [@Whatsmename](https://github.com/Whatsmename) contributed the Poly Haven,
  Poly Pizza, STLFinder, and Yeggi sources, the FlareSolverr meta-search and
  rate guard, the MCP stdout fix, and the 0.2.0 dependency upgrade.
- The Poly Haven and Poly Pizza providers are adapted from
  [pikalover6/3dfetch](https://github.com/pikalover6/3dfetch) (MIT).

## License

MIT
