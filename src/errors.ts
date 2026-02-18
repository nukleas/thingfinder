export class ThingfinderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ThingfinderError';
  }
}

export class ProviderError extends ThingfinderError {
  constructor(
    public readonly provider: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`[${provider}] ${message}`, options);
    this.name = 'ProviderError';
  }
}

export class AuthError extends ProviderError {
  constructor(provider: string, message?: string) {
    super(provider, message ?? 'Authentication required. Run: thingfinder config set <provider>.apiKey <key>');
    this.name = 'AuthError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(
    provider: string,
    public readonly retryAfterMs?: number,
  ) {
    super(provider, `Rate limited${retryAfterMs ? `. Retry after ${Math.ceil(retryAfterMs / 1000)}s` : ''}`);
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends ThingfinderError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

export class DownloadError extends ThingfinderError {
  constructor(
    public readonly url: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DownloadError';
  }
}
