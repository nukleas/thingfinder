import { describe, it, expect } from 'vitest';
import { createProgram } from '../../src/cli.js';

describe('CLI', () => {
  it('should create program with all commands', () => {
    const program = createProgram();
    expect(program.name()).toBe('thingfinder');

    const commandNames = program.commands.map(c => c.name());
    expect(commandNames).toContain('search');
    expect(commandNames).toContain('download');
    expect(commandNames).toContain('config');
  });

  it('should have version set', () => {
    const program = createProgram();
    expect(program.version()).toBe('0.1.0');
  });

  it('should have verbose option', () => {
    const program = createProgram();
    const verboseOption = program.options.find(o => o.long === '--verbose');
    expect(verboseOption).toBeDefined();
  });
});
