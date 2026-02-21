# thingfinder

[![CI](https://github.com/nukleas/thingfinder/actions/workflows/ci.yml/badge.svg)](https://github.com/nukleas/thingfinder/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/thingfinder)](https://www.npmjs.com/package/thingfinder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CLI tool, library, and MCP server for searching and downloading 3D printing files across multiple repositories.

Search Thingiverse, Printables, and Thangs from a single command. No more opening three browser tabs. Use it from the terminal, import it as a library, or connect it to AI agents via MCP.

## Install

```bash
npm install -g thingfinder
```

Or run directly:

```bash
npx thingfinder search "benchy"
```

Requires Node.js >= 20.

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

| Source | Auth Required | Notes |
|--------|--------------|-------|
| **Thangs** | No | Aggregates models from 90+ sites. Works out of the box. |
| **Printables** | No | Prusa's model repository. Search + direct download. |
| **Thingiverse** | Yes (API key) | Requires an app token from [thingiverse.com/apps/create](https://www.thingiverse.com/apps/create). |

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
# Build first
npm run build

# Add to Claude Code project config (~/.claude.json)
claude mcp add thingfinder node /path/to/thingfinder/dist/mcp.js
```

Or manually add to your project's `mcpServers` in `~/.claude.json`:

```json
{
  "mcpServers": {
    "thingfinder": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/thingfinder/dist/mcp.js"]
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
- Sources without configured auth are silently skipped

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

## License

MIT
