# Contributing to thingfinder

Thanks for your interest in contributing! Here's how to get started.

## Prerequisites

- Node.js >= 20
- npm

## Setup

```bash
git clone https://github.com/nukleas/thingfinder.git
cd thingfinder
npm install
```

## Development Workflow

```bash
# Run in development mode
npm run dev -- search "benchy"

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run typecheck

# Build
npm run build
```

## Adding a New Provider

1. Create a new file in `src/providers/` that implements the `SourceProvider` interface
2. Register the provider in `src/providers/index.ts`
3. Add tests for the new provider

## Pull Request Guidelines

- Make sure `npm run lint` passes with no errors
- Make sure `npm test` passes
- Make sure `npm run typecheck` passes
- Describe what your PR changes and why

## Reporting Issues

- Use the [bug report template](https://github.com/nukleas/thingfinder/issues/new?template=bug_report.md) for bugs
- Use the [feature request template](https://github.com/nukleas/thingfinder/issues/new?template=feature_request.md) for feature ideas
- Include reproduction steps when reporting bugs
