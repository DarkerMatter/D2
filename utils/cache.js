// utils/cache.js

// A simple in-memory cache object
const cache = {};
// Set the Time-To-Live for cache entries to 5 minutes (in milliseconds)
const TTL = 5 * 60 * 1000;

/**
 * Retrieves an entry from the cache if it exists and is not expired.
 * @param {string} key The key for the cache entry.
 * @returns {any | null} The cached data or null if not found or expired.
 */
function get(key) {
    const entry = cache[key];
    // Check if the entry exists and if the current time is within the TTL
    if (entry && (Date.now() - entry.timestamp < TTL)) {
        console.log(`[Cache] HIT for key: ${key}`);
        return entry.data;
    }
    console.log(`[Cache] MISS for key: ${key}`);
    return null;
}

/**
 * Adds or updates an entry in the cache.
 * @param {string} key The key for the cache entry.
 * @param {any} data The data to be stored.
 */
function set(key, data) {
    console.log(`[Cache] SET for key: ${key}`);
    cache[key] = {
        data,
        timestamp: Date.now()
    };
}

/**
 * NEW: Clears all entries from the in-memory cache.
 */
function clear() {
    console.log('[Cache] CLEARED');
    // A simple way to clear the object
    for (const key in cache) {
        delete cache[key];
    }
}

module.exports = { get, set, clear };