// pathTable.js - Routing tables for Reticulum
// Stores next-hop information for destinations

const EventEmitter = require('events');

class PathTable extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.paths = new Map(); // destination -> path info
        this.maxPaths = options.maxPaths || 10000;
        this.pathTimeout = options.pathTimeout || 5 * 60 * 1000; // 5 minutes
        this.announceInterval = options.announceInterval || 60 * 1000; // 1 minute
        
        // Statistics
        this.stats = {
            totalPaths: 0,
            totalLookups: 0,
            totalMisses: 0,
            lastCleanup: Date.now()
        };
    }

    /**
     * Add or update a path
     */
    addPath(destination, nextHop, interfaceId, metric = 1) {
        const destKey = destination.address || destination;
        
        const pathInfo = {
            destination: destKey,
            nextHop: nextHop, // Next hop node ID
            interface: interfaceId, // Interface to use
            metric: metric, // Path metric (cost)
            hops: metric,
            lastSeen: Date.now(),
            expires: Date.now() + this.pathTimeout,
            validated: false
        };
        
        const existing = this.paths.get(destKey);
        
        if (!existing || metric < existing.metric) {
            this.paths.set(destKey, pathInfo);
            this.stats.totalPaths = this.paths.size;
            
            this.emit('path-added', pathInfo);
            return true;
        }
        
        return false;
    }

    /**
     * Get path for destination
     */
    getPath(destination) {
        const destKey = destination.address || destination;
        this.stats.totalLookups++;
        
        const path = this.paths.get(destKey);
        
        if (!path) {
            this.stats.totalMisses++;
            return null;
        }
        
        // Check if path is expired
        if (Date.now() > path.expires) {
            this.paths.delete(destKey);
            this.stats.totalPaths = this.paths.size;
            return null;
        }
        
        // Update last seen
        path.lastSeen = Date.now();
        
        return path;
    }

    /**
     * Check if destination is known
     */
    hasPath(destination) {
        return this.getPath(destination) !== null;
    }

    /**
     * Remove path
     */
    removePath(destination) {
        const destKey = destination.address || destination;
        const removed = this.paths.delete(destKey);
        
        if (removed) {
            this.stats.totalPaths = this.paths.size;
            this.emit('path-removed', destKey);
        }
        
        return removed;
    }

    /**
     * Update path metric
     */
    updateMetric(destination, newMetric) {
        const path = this.getPath(destination);
        
        if (path) {
            path.metric = newMetric;
            path.lastSeen = Date.now();
            this.emit('path-updated', path);
        }
    }

    /**
     * Get all paths
     */
    getAllPaths() {
        return Array.from(this.paths.values());
    }

    /**
     * Get paths for a specific interface
     */
    getPathsForInterface(interfaceId) {
        return this.getAllPaths().filter(p => p.interface === interfaceId);
    }

    /**
     * Get nearest paths (lowest metric)
     */
    getNearestPaths(count = 10) {
        return this.getAllPaths()
            .sort((a, b) => a.metric - b.metric)
            .slice(0, count);
    }

    /**
     * Cleanup expired paths
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, path] of this.paths) {
            if (now > path.expires) {
                this.paths.delete(key);
                cleaned++;
            }
        }
        
        this.stats.totalPaths = this.paths.size;
        this.stats.lastCleanup = now;
        
        if (cleaned > 0) {
            this.emit('cleanup', { cleaned, remaining: this.paths.size });
        }
        
        return cleaned;
    }

    /**
     * Get path table statistics
     */
    getStats() {
        return {
            ...this.stats,
            paths: this.paths.size,
            oldest: this.getOldestPath(),
            newest: this.getNewestPath()
        };
    }

    /**
     * Get oldest path
     */
    getOldestPath() {
        let oldest = null;
        
        for (const path of this.paths.values()) {
            if (!oldest || path.lastSeen < oldest.lastSeen) {
                oldest = path;
            }
        }
        
        return oldest;
    }

    /**
     * Get newest path
     */
    getNewestPath() {
        let newest = null;
        
        for (const path of this.paths.values()) {
            if (!newest || path.lastSeen > newest.lastSeen) {
                newest = path;
            }
        }
        
        return newest;
    }

    /**
     * Export path table to JSON
     */
    toJSON() {
        return {
            paths: Array.from(this.paths.entries()).map(([key, path]) => ({
                destination: key,
                nextHop: path.nextHop,
                interface: path.interface,
                metric: path.metric,
                hops: path.hops,
                lastSeen: path.lastSeen,
                expires: path.expires,
                validated: path.validated
            })),
            stats: this.stats
        };
    }

    /**
     * Import path table from JSON
     */
    static fromJSON(json) {
        const table = new PathTable();
        
        if (json.paths) {
            for (const pathData of json.paths) {
                table.paths.set(pathData.destination, {
                    destination: pathData.destination,
                    nextHop: pathData.nextHop,
                    interface: pathData.interface,
                    metric: pathData.metric,
                    hops: pathData.hops,
                    lastSeen: pathData.lastSeen,
                    expires: pathData.expires,
                    validated: pathData.validated
                });
            }
        }
        
        if (json.stats) {
            table.stats = { ...table.stats, ...json.stats };
        }
        
        return table;
    }

    /**
     * Start periodic cleanup
     */
    startCleanup(interval = 60 * 1000) {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, interval);
        
        return this;
    }

    /**
     * Stop periodic cleanup
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Destroy path table
     */
    destroy() {
        this.stopCleanup();
        this.paths.clear();
        this.removeAllListeners();
    }
}

module.exports = PathTable;
