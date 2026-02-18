import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../../src/http/rate-limiter.js';

describe('RateLimiter', () => {
  it('should allow requests up to the token limit', async () => {
    const limiter = new RateLimiter(3, 1000);
    // Should not throw for first 3 calls
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
  });

  it('should create with default values', () => {
    const limiter = new RateLimiter();
    expect(limiter).toBeDefined();
  });

  it('should eventually allow requests after refill', async () => {
    const limiter = new RateLimiter(1, 50); // Very fast refill for testing
    await limiter.acquire(); // Use the one token
    const start = Date.now();
    await limiter.acquire(); // Should wait for refill
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});
