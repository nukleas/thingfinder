import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getStore } from '../config/store.js';

interface ProviderState {
  lastRequestAt?: number;
  cooldownUntil?: number;
  consecutiveFailures?: number;
}

interface StateFile {
  providers: Record<string, ProviderState>;
}

function statePath(): string | null {
  const override = process.env.THINGFINDER_STATE_DIR;
  if (override) return join(override, 'state.json');
  try {
    return join(dirname(getStore().path), 'state.json');
  } catch {
    // config store unavailable (e.g. mocked): state is best-effort
    return null;
  }
}

function load(): StateFile {
  const path = statePath();
  if (!path) return { providers: {} };
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StateFile>;
    if (parsed.providers) return { providers: parsed.providers };
  } catch {
    // missing or corrupt state file: start fresh
  }
  return { providers: {} };
}

function save(state: StateFile): void {
  const path = statePath();
  if (!path) return;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state), 'utf8');
  } catch {
    // state is best-effort; never break a search over bookkeeping
  }
}

export interface GuardVerdict {
  ok: boolean;
  retryInMs: number;
  reason: string;
}

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export function cooldownBaseMs(cooldownMinutes: number | undefined): number {
  return cooldownMinutes && cooldownMinutes > 0
    ? cooldownMinutes * 60 * 1000
    : DEFAULT_COOLDOWN_MS;
}

/**
 * Check the persistent rate guard for a provider before issuing a request.
 * Returns ok:false while a backoff cooldown is active.
 */
export function checkGuard(name: string, minIntervalMs: number): GuardVerdict {
  const state = load().providers[name] ?? {};
  const now = Date.now();

  if (state.cooldownUntil && state.cooldownUntil > now) {
    const retryInMs = state.cooldownUntil - now;
    return {
      ok: false,
      retryInMs,
      reason: `cooling down after ${state.consecutiveFailures ?? 1} consecutive failure(s)`,
    };
  }

  const sinceLast = state.lastRequestAt ? now - state.lastRequestAt : Infinity;
  if (sinceLast < minIntervalMs) {
    return {
      ok: false,
      retryInMs: minIntervalMs - sinceLast,
      reason: 'minimum interval between requests',
    };
  }

  return { ok: true, retryInMs: 0, reason: '' };
}

export function markRequest(name: string): void {
  const file = load();
  const state = file.providers[name] ?? {};
  state.lastRequestAt = Date.now();
  file.providers[name] = state;
  save(file);
}

export function markSuccess(name: string): void {
  const file = load();
  const state = file.providers[name] ?? {};
  state.consecutiveFailures = 0;
  state.cooldownUntil = undefined;
  file.providers[name] = state;
  save(file);
}

/**
 * Record a rate-limit-ish failure. Cooldown grows exponentially
 * (base * 2^(failures-1)) up to MAX_COOLDOWN_MS.
 */
export function markFailure(name: string, baseCooldownMs: number): number {
  const file = load();
  const state = file.providers[name] ?? {};
  state.consecutiveFailures = (state.consecutiveFailures ?? 0) + 1;
  const cooldown = Math.min(
    baseCooldownMs * 2 ** (state.consecutiveFailures - 1),
    MAX_COOLDOWN_MS,
  );
  state.cooldownUntil = Date.now() + cooldown;
  file.providers[name] = state;
  save(file);
  return cooldown;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 120) return `${totalSeconds}s`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 120) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}
