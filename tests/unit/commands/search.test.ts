import { describe, it, expect } from 'vitest';
import { formatResultsTable } from '../../../src/ui/table.js';
import type { SearchResult } from '../../../src/providers/types.js';

describe('formatResultsTable', () => {
  it('should format results into a readable table', () => {
    const results: SearchResult[] = [
      {
        id: '1',
        name: '3DBenchy',
        creator: 'CreativeTools',
        url: 'https://example.com/1',
        likes: 5000,
        downloads: 120000,
        source: 'thangs',
      },
      {
        id: '2',
        name: 'A Very Long Model Name That Should Be Truncated At Some Point',
        creator: 'SomeUserWithALongName',
        url: 'https://example.com/2',
        likes: 100,
        downloads: 500,
        source: 'printables',
      },
    ];

    const table = formatResultsTable(results);
    expect(table).toContain('3DBenchy');
    expect(table).toContain('CreativeTools');
    expect(table).toContain('thangs');
    expect(table).toContain('5.0k');
    expect(table).toContain('120.0k');
    expect(table).toContain('printables');
  });

  it('should return "No results found" for empty results', () => {
    const table = formatResultsTable([]);
    expect(table).toBe('No results found.');
  });

  it('should format millions correctly', () => {
    const results: SearchResult[] = [{
      id: '1',
      name: 'Popular Model',
      creator: 'User',
      url: 'https://example.com/1',
      likes: 1500000,
      downloads: 2000000,
      source: 'test',
    }];

    const table = formatResultsTable(results);
    expect(table).toContain('1.5M');
    expect(table).toContain('2.0M');
  });
});
