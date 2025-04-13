const crypto = require('crypto');
const LRUCache = require('lru-cache');

const DEFAULT_CACHE_OPTIONS = {
  max: 500,
  ttl: 1000 * 60 * 5,
  updateAgeOnGet: true,
  allowStale: false,
  noDisposeOnSet: false,
  fetchMethod: null
};

/**
 * @param {string} sql
 * @param {Array} bindings
 * @param {string} dialect
 * @returns {string}
 */
function generateCacheKey(sql, bindings = [], dialect = '') {
  const data = JSON.stringify({ sql, bindings, dialect });
  return crypto.createHash('md5').update(data).digest('hex');
}


class QueryCache {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
    this.cache = new LRUCache(this.options);
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0
    };
    this.tableMap = new Map();
  }

  /**
   * @param {string} sql
   * @param {Array} bindings
   * @param {string} dialect
   * @returns {any|null}
   */
  get(sql, bindings = [], dialect = '') {
    const key = generateCacheKey(sql, bindings, dialect);
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    
    this.stats.misses++;
    return null;
  }

  /**
   * @param {string} sql
   * @param {Array} bindings
   * @param {any} value
   * @param {string} dialect
   * @param {Set} tables
   * @returns {boolean}
   */
  set(sql, bindings = [], value, dialect = '', tables = new Set()) {
    if (!value) return false;
    
    const key = generateCacheKey(sql, bindings, dialect);
    
    if (tables && tables.size > 0) {
      for (const table of tables) {
        if (!this.tableMap.has(table)) {
          this.tableMap.set(table, new Set());
        }
        this.tableMap.get(table).add(key);
      }
    }
    
    this.cache.set(key, value);
    this.stats.sets++;
    
    return true;
  }

  /**
   * @param {string|Array} tables
   * @returns {number}
   */
  invalidateByTables(tables) {
    if (!tables) return 0;
    
    const tableList = Array.isArray(tables) ? tables : [tables];
    let invalidatedCount = 0;
    
    for (const table of tableList) {
      const cacheKeys = this.tableMap.get(table);
      
      if (cacheKeys) {
        for (const key of cacheKeys) {
          if (this.cache.delete(key)) {
            invalidatedCount++;
          }
        }
        
        this.tableMap.delete(table);
      }
    }
    
    this.stats.invalidations += invalidatedCount;
    return invalidatedCount;
  }

  clear() {
    this.cache.clear();
    this.tableMap.clear();
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0
    };
  }

  /**
   * @returns {Object}
   */
  getStats() {
    const { hits, misses, sets, invalidations } = this.stats;
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;
    
    return {
      hits,
      misses,
      sets,
      invalidations,
      total,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      maxSize: this.options.max
    };
  }

  /**
   * @param {string} sql
   * @returns {Set}
   */
  static extractTablesFromQuery(sql) {
    const tables = new Set();
    
    const tableKeywords = [
      'FROM\\s+([\\w\\.]+)',
      'JOIN\\s+([\\w\\.]+)',
      'INTO\\s+([\\w\\.]+)',
      'UPDATE\\s+([\\w\\.]+)',
      'TABLE\\s+([\\w\\.]+)'
    ];
    
    for (const pattern of tableKeywords) {
      const regex = new RegExp(pattern, 'gi');
      let match;
      
      while ((match = regex.exec(sql)) !== null) {
        let tableName = match[1].replace(/[`"'[\]]/g, '');
        
        tableName = tableName.split(/\s+AS\s+/i)[0].trim();
        
        if (tableName.includes('.')) {
          tableName = tableName.split('.')[1];
        }
        
        if (tableName) {
          tables.add(tableName.toLowerCase());
        }
      }
    }
    
    return tables;
  }
}

/**
 * @param {Object} vesperdb
 * @param {Object} options
 */
function configureCacheMiddleware(vesperdb, options = {}) {
  const queryCache = new QueryCache(options);
  
  vesperdb.on('query', (query) => {
    if (query.method === 'select') {
      const cachedResult = queryCache.get(query.sql, query.bindings, vesperdb.config.client);
      
      if (cachedResult) {
        query.__cachedResult = cachedResult;
        return cachedResult;
      }
    }
  });
  
  vesperdb.on('query:response', (response, query) => {
    if (query.__cachedResult) {
      return query.__cachedResult;
    }
    
    if (query.method === 'select') {
      const tables = QueryCache.extractTablesFromQuery(query.sql);
      queryCache.set(query.sql, query.bindings, response, vesperdb.config.client, tables);
    }
    else if (['insert', 'update', 'delete'].includes(query.method)) {
      const tables = QueryCache.extractTablesFromQuery(query.sql);
      queryCache.invalidateByTables(Array.from(tables));
    }
    
    return response;
  });
  
  vesperdb.cache = queryCache;
  
  return vesperdb;
}

module.exports = {
  QueryCache,
  configureCacheMiddleware
}; 