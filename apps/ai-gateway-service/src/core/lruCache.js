/**
 * LRU Cache — High-performance in-memory cache
 *
 * Implementation strategy:
 *   JavaScript's Map preserves insertion order.  When an entry is
 *   accessed we delete-and-re-set it, which moves it to the *end* of
 *   the iteration order (most-recently-used).  The *first* key returned
 *   by map.keys() is therefore always the least-recently-used entry and
 *   can be evicted in O(1).  This avoids the complexity of a manual
 *   doubly-linked list while keeping all operations at O(1).
 *
 * TTL support:
 *   Every entry stores an absolute expiry timestamp.  On get() the
 *   timestamp is compared against Date.now(); expired entries are
 *   transparently evicted and treated as misses.  Per-entry TTL can
 *   override the cache-wide default at set() time.
 *
 * wrap() helper:
 *   Produces a cache-through wrapper around any (async) function.  On
 *   invocation the cache is consulted first; on miss the real function
 *   runs and its result is stored before being returned.  An optional
 *   keyGen function controls how arguments map to cache keys.
 *
 * @module core/lruCache
 */

// =============================================================================
// Core LRU Cache
// =============================================================================

/**
 * @template K, V
 */
export class LRUCache {
  /**
   * @param {Object} [options]
   * @param {number} [options.capacity=1000]  — max entries before eviction
   * @param {number} [options.ttl=300000]     — default time-to-live in ms (5 min)
   * @param {number} [options.maxValueSize=5242880] — max serialized value size in bytes (5 MB)
   */
  constructor(options = {}) {
    /** @type {number} */
    this.capacity = options.capacity || 1000;

    /** @type {number} Default TTL in milliseconds */
    this.ttl = options.ttl || 300_000;

    /** @type {number} Maximum serialized value size in bytes (default 5 MB) */
    this.maxValueSize = options.maxValueSize || 5 * 1024 * 1024;

    /**
     * Internal store — Map preserves insertion order which we exploit
     * for O(1) LRU eviction.  Values are { value: V, expiry: number }.
     * @type {Map<K, { value: V, expiry: number }>}
     * @private
     */
    this._map = new Map();

    /** @type {number} Cumulative cache hits */
    this.hits = 0;

    /** @type {number} Cumulative cache misses */
    this.misses = 0;

    /** @type {number} Cumulative evictions (capacity + TTL) */
    this.evictions = 0;
  }

  // ---------------------------------------------------------------------------
  // Core operations — all O(1)
  // ---------------------------------------------------------------------------

  /**
   * Retrieve a value by key.
   *
   * On hit the entry is moved to the most-recently-used position and
   * its TTL is *not* reset (TTL is absolute from set-time).  Expired
   * entries are transparently evicted and counted as a miss.
   *
   * @param {K} key
   * @returns {V | undefined}
   */
  get(key) {
    const entry = this._map.get(key);

    if (entry === undefined) {
      this.misses++;
      return undefined;
    }

    // TTL check — expired entries are evicted on access.
    if (entry.expiry !== 0 && Date.now() > entry.expiry) {
      this._map.delete(key);
      this.misses++;
      this.evictions++;
      return undefined;
    }

    // Move to MRU position: delete then re-insert with same value.
    this._map.delete(key);
    this._map.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * Store a value, evicting the LRU entry if at capacity.
   *
   * @param {K}      key
   * @param {V}      value
   * @param {number} [ttl] — per-entry TTL override in ms (uses default if omitted)
   * @returns {LRUCache} this (for chaining)
   */
  set(key, value, ttl) {
    // Validate key to prevent cache poisoning
    if (key === null || key === undefined) return this;
    const keyStr = String(key);
    if (keyStr.length > 1024) return this; // reject overly long keys

    // Prevent cache poisoning via oversized values (memory exhaustion)
    if (this.maxValueSize > 0) {
      const estimatedSize = typeof value === "string"
        ? Buffer.byteLength(value, "utf-8")
        : (value !== null && typeof value === "object")
          ? Buffer.byteLength(JSON.stringify(value), "utf-8")
          : 0;
      if (estimatedSize > this.maxValueSize) {
        // Silently reject oversized values to avoid DoS
        return this;
      }
    }

    // If the key already exists, delete first so re-insert goes to MRU end.
    if (this._map.has(key)) {
      this._map.delete(key);
    }

    // Evict LRU entries until we have room.
    while (this._map.size >= this.capacity) {
      const lruKey = this._map.keys().next().value;
      this._map.delete(lruKey);
      this.evictions++;
    }

    const effectiveTtl = ttl !== undefined ? ttl : this.ttl;
    const expiry = effectiveTtl > 0 ? Date.now() + effectiveTtl : 0;

    this._map.set(key, { value, expiry });

    return this;
  }

  /**
   * Check whether a non-expired entry exists for the given key.
   * Does *not* promote the entry to MRU (unlike get()).
   *
   * @param {K} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this._map.get(key);
    if (entry === undefined) return false;

    if (entry.expiry !== 0 && Date.now() > entry.expiry) {
      this._map.delete(key);
      this.evictions++;
      return false;
    }
    return true;
  }

  /**
   * Delete an entry by key.
   *
   * @param {K} key
   * @returns {boolean} true if the key existed
   */
  delete(key) {
    return this._map.delete(key);
  }

  /**
   * Remove all entries and reset statistics.
   *
   * @returns {void}
   */
  clear() {
    this._map.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Current number of entries (including any that may have expired
   * but haven't been accessed yet — use purgeExpired() to clean those).
   *
   * @returns {number}
   */
  size() {
    return this._map.size;
  }

  /**
   * Iterate over all non-expired keys in LRU-to-MRU order.
   *
   * @yields {K}
   */
  *keys() {
    const now = Date.now();
    for (const [key, entry] of this._map) {
      if (entry.expiry !== 0 && now > entry.expiry) {
        // Lazy eviction during iteration.
        this._map.delete(key);
        this.evictions++;
        continue;
      }
      yield key;
    }
  }

  /**
   * Iterate over all non-expired [key, value] pairs in LRU-to-MRU order.
   *
   * @yields {[K, V]}
   */
  *entries() {
    const now = Date.now();
    for (const [key, entry] of this._map) {
      if (entry.expiry !== 0 && now > entry.expiry) {
        this._map.delete(key);
        this.evictions++;
        continue;
      }
      yield [key, entry.value];
    }
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  /**
   * Return aggregate cache statistics.
   *
   * @returns {{
   *   size: number,
   *   capacity: number,
   *   hitRate: number,
   *   hits: number,
   *   misses: number,
   *   evictions: number,
   *   ttl: number
   * }}
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this._map.size,
      capacity: this.capacity,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      ttl: this.ttl,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Eagerly remove all expired entries.  Normally not required — expired
   * entries are lazily evicted on access — but useful for periodic
   * cleanup in long-running processes.
   *
   * @returns {number} number of entries purged
   */
  purgeExpired() {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this._map) {
      if (entry.expiry !== 0 && now > entry.expiry) {
        this._map.delete(key);
        purged++;
        this.evictions++;
      }
    }
    return purged;
  }

  /**
   * Wrap an (async) function with cache-through semantics.
   *
   * The returned function checks the cache before invoking the real
   * function.  On a miss the real function's result is awaited and
   * stored before being returned.
   *
   * @template T
   * @param {(...args: any[]) => T | Promise<T>} fn — the function to cache
   * @param {Object}   [options]
   * @param {Function} [options.keyGen]  — (args) => string; defaults to JSON.stringify(args)
   * @param {number}   [options.ttl]     — per-entry TTL override in ms
   * @param {string}   [options.prefix]  — key prefix for namespace isolation
   * @returns {(...args: any[]) => Promise<T>}
   *
   * @example
   *   const fetchUser = cache.wrap(
   *     async (id) => db.users.findById(id),
   *     { keyGen: (args) => `user:${args[0]}`, ttl: 60_000 }
   *   );
   *   const user = await fetchUser(42); // cached after first call
   */
  wrap(fn, options = {}) {
    const cache = this;
    const keyGen = options.keyGen || ((args) => JSON.stringify(args));
    const ttl = options.ttl;
    const prefix = options.prefix || "";

    return async function cachedWrapper(...args) {
      const rawKey = keyGen(args);
      const key = prefix ? `${prefix}:${rawKey}` : rawKey;

      // Fast path — cache hit.
      if (cache.has(key)) {
        return cache.get(key);
      }

      // Slow path — execute, store, return.
      const result = await fn(...args);
      cache.set(key, result, ttl);
      return result;
    };
  }
}

// =============================================================================
// Pre-configured factory functions
// =============================================================================

/**
 * Create a cache tuned for HTTP/API response caching.
 *
 * Defaults: capacity 500, TTL 10 minutes.
 *
 * @param {Object} [overrides] — merged over defaults
 * @returns {LRUCache}
 */
export function createResponseCache(overrides = {}) {
  return new LRUCache({
    capacity: 500,
    ttl: 600_000, // 10 minutes
    ...overrides,
  });
}

/**
 * Create a cache tuned for provider metadata and health status.
 *
 * Defaults: capacity 100, TTL 1 minute (providers change state quickly).
 *
 * @param {Object} [overrides]
 * @returns {LRUCache}
 */
export function createProviderCache(overrides = {}) {
  return new LRUCache({
    capacity: 100,
    ttl: 60_000, // 1 minute
    ...overrides,
  });
}

/**
 * Create a cache tuned for knowledge / RAG retrieval results.
 *
 * Defaults: capacity 2000, TTL 30 minutes.
 *
 * @param {Object} [overrides]
 * @returns {LRUCache}
 */
export function createKnowledgeCache(overrides = {}) {
  return new LRUCache({
    capacity: 2000,
    ttl: 1_800_000, // 30 minutes
    ...overrides,
  });
}

/**
 * Create a cache tuned for model metadata and capability descriptors.
 *
 * Defaults: capacity 500, TTL 60 minutes (models rarely change at runtime).
 *
 * @param {Object} [overrides]
 * @returns {LRUCache}
 */
export function createModelCache(overrides = {}) {
  return new LRUCache({
    capacity: 500,
    ttl: 3_600_000, // 60 minutes
    ...overrides,
  });
}

export default LRUCache;
