import { MetaSearchProvider } from './metasearch.js';

export class YeggiProvider extends MetaSearchProvider {
  constructor() {
    super({
      name: 'yeggi',
      searchUrl: q => `https://www.yeggi.com/q/${q}/`,
      selfHost: /yeggi\.com$/,
      // The aggressive one: space requests 20 s apart, 15-minute base cooldown.
      defaultMinIntervalSeconds: 20,
      defaultCooldownMinutes: 15,
      retryDelayMs: 20_000,
      // Yeggi's challenge rarely clears past a minute — fail fast, back off.
      solverTimeoutMs: 60_000,
    });
  }
}
