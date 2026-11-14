import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkGuard,
  cooldownBaseMs,
  formatDuration,
  markFailure,
  markRequest,
  markSuccess,
} from '../../../src/providers/rate-guard.js';

let stateDir: string;
const prevEnv = process.env.THINGFINDER_STATE_DIR;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), 'tf-state-'));
  process.env.THINGFINDER_STATE_DIR = stateDir;
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
  if (prevEnv === undefined) delete process.env.THINGFINDER_STATE_DIR;
  else process.env.THINGFINDER_STATE_DIR = prevEnv;
});

describe('checkGuard', () => {
  it('allows a fresh provider', () => {
    const verdict = checkGuard('yeggi', 20_000);
    expect(verdict.ok).toBe(true);
  });

  it('enforces the minimum interval between requests', () => {
    markRequest('yeggi');
    const verdict = checkGuard('yeggi', 20_000);
    expect(verdict.ok).toBe(false);
    expect(verdict.retryInMs).toBeGreaterThan(0);
    expect(verdict.retryInMs).toBeLessThanOrEqual(20_000);
    expect(verdict.reason).toContain('minimum interval');
  });

  it('zero minInterval never blocks on spacing', () => {
    markRequest('yeggi');
    expect(checkGuard('yeggi', 0).ok).toBe(true);
  });
});

describe('backoff cooldowns', () => {
  it('blocks after a failure for the base cooldown', () => {
    const cooldown = markFailure('yeggi', 60_000);
    expect(cooldown).toBe(60_000);
    const verdict = checkGuard('yeggi', 0);
    expect(verdict.ok).toBe(false);
    expect(verdict.retryInMs).toBeGreaterThan(0);
    expect(verdict.reason).toContain('failure');
  });

  it('doubles the cooldown per consecutive failure', () => {
    expect(markFailure('yeggi', 60_000)).toBe(60_000);
    expect(markFailure('yeggi', 60_000)).toBe(120_000);
    expect(markFailure('yeggi', 60_000)).toBe(240_000);
  });

  it('caps the cooldown at 2 hours', () => {
    let last = 0;
    for (let i = 0; i < 20; i++) last = markFailure('yeggi', 60_000);
    expect(last).toBe(2 * 60 * 60 * 1000);
  });

  it('resets the streak on success', () => {
    markFailure('yeggi', 60_000);
    markSuccess('yeggi');
    expect(checkGuard('yeggi', 0).ok).toBe(true);
    expect(markFailure('yeggi', 60_000)).toBe(60_000);
  });
});

describe('defaults', () => {
  it('falls back to 15 minutes when unconfigured', () => {
    expect(cooldownBaseMs(undefined)).toBe(15 * 60 * 1000);
  });

  it('honours configured minutes', () => {
    expect(cooldownBaseMs(5)).toBe(5 * 60 * 1000);
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes, hours', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(150_000)).toBe('3m');
    expect(formatDuration(3 * 60 * 60 * 1000)).toBe('3h');
  });
});
