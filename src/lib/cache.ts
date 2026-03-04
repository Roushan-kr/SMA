import { logger } from "./logger.js";

interface CacheEntry<T> {
  value: T;
  expiry: number;
  size: number;
}

export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private currentSize = 0;
  private readonly maxSize: number; // in bytes

  constructor(maxSizeMB: number = 50) {
    this.maxSize = maxSizeMB * 1024 * 1024;
    
    // Explicitly binding for use in other context
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.del = this.del.bind(this);
    
    // Background cleanup every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Set a value in cache with TTL (in seconds)
   */
  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    this.cleanup(); // Clean before setting if needed

    const stringified = JSON.stringify(value);
    const size = stringified.length * 2; // Rough estimate for UTF-16

    // If a single entry is larger than max size, don't cache
    if (size > this.maxSize) return;

    // Remove old entry if exists to update size correctly
    this.del(key);

    // Evict if over capacity
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.del(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
      size
    });
    this.currentSize += size;
  }

  /**
   * Get a value from cache. Returns null if expired or missing.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.del(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Remove a key
   */
  del(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
    }
  }

  /**
   * Flush all
   */
  flush(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.del(key);
      }
    }
  }

  getStats() {
    return {
      keys: this.cache.size,
      sizeBytes: this.currentSize,
      sizeMB: (this.currentSize / (1024 * 1024)).toFixed(2) + " MB",
      maxSizeMB: (this.maxSize / (1024 * 1024)).toFixed(0) + " MB"
    };
  }
}

export const serverCache = new MemoryCache(50);
