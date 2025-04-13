const JSON_OPERATIONS = {
  GET: 'get',
  SET: 'set',
  INSERT: 'insert',
  REMOVE: 'remove',
  APPEND: 'append',
  MERGE: 'merge',
  CONTAINS: 'contains',
  EXISTS: 'exists',
  TYPE_OF: 'typeof'
};

/**
 * @param {string|Array} path
 * @returns {string}
 */
function formatJsonPath(path) {
  if (Array.isArray(path)) {
    return path.map(segment => {
      if (typeof segment === 'number' || !isNaN(parseInt(segment))) {
        return `[${segment}]`;
      }
      return segment;
    }).join('.');
  }
  
  return path;
}

class JsonOperations {
  /**
   * @param {Object} vesperdb
   */
  constructor(vesperdb) {
    this.db = vesperdb;
    this.dialect = vesperdb.config.client;
  }

  /**
   * @param {string} table
   * @param {string} column
   * @param {string|Array} path
   * @param {Object} whereConditions
   * @returns {Promise<Array>}
   */
  async get(table, column, path, whereConditions = {}) {
    const jsonPath = formatJsonPath(path);
    
    let query;
    
    switch (this.dialect) {
      case 'pg':
        query = this.db(table)
          .select(this.db.raw(`${column} -> '${jsonPath}' as value`))
          .where(whereConditions);
        break;
        
      case 'mysql':
        query = this.db(table)
          .select(this.db.raw(`JSON_EXTRACT(${column}, '$.${jsonPath}') as value`))
          .where(whereConditions);
        break;
        
      case 'sqlite':
        query = this.db(table)
          .select(this.db.raw(`json_extract(${column}, '$.${jsonPath}') as value`))
          .where(whereConditions);
        break;
        
      case 'mssql':
        query = this.db(table)
          .select(this.db.raw(`JSON_VALUE(${column}, '$.${jsonPath}') as value`))
          .where(whereConditions);
        break;
        
      default:
        throw new Error(`Dialecte non supporté pour les opérations JSON: ${this.dialect}`);
    }
    
    return query;
  }

  /**
   * @param {string} table
   * @param {string} column
   * @param {string|Array} path
   * @param {any} value
   * @param {Object} whereConditions
   * @returns {Promise<number>}
   */
  async set(table, column, path, value, whereConditions = {}) {
    const jsonPath = formatJsonPath(path);
    const jsonValue = JSON.stringify(value);
    
    let query;
    
    switch (this.dialect) {
      case 'pg':
        query = this.db(table)
          .update({
            [column]: this.db.raw(`jsonb_set(${column}, '{${jsonPath}}', '${jsonValue}'::jsonb, true)`)
          })
          .where(whereConditions);
        break;
        
      case 'mysql':
        query = this.db(table)
          .update({
            [column]: this.db.raw(`JSON_SET(${column}, '$.${jsonPath}', CAST('${jsonValue}' AS JSON))`)
          })
          .where(whereConditions);
        break;
        
      case 'sqlite':
        const rows = await this.db(table).select(column).where(whereConditions);
        
        const updates = rows.map(row => {
          let jsonData = row[column];
          
          if (typeof jsonData === 'string') {
            jsonData = JSON.parse(jsonData);
          }
          
          const setNestedValue = (obj, path, value) => {
            const parts = Array.isArray(path) ? path : path.split('.');
            let current = obj;
            
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              
              if (part.endsWith(']')) {
                const match = part.match(/(\w+)\[(\d+)\]/);
                if (match) {
                  const [_, name, index] = match;
                  if (!current[name]) current[name] = [];
                  current = current[name];
                  current[parseInt(index)] = current[parseInt(index)] || {};
                  continue;
                }
              }
              
              if (!current[part]) current[part] = {};
              current = current[part];
            }
            
            const lastPart = parts[parts.length - 1];
            current[lastPart] = value;
            return obj;
          };
          
          const updatedJson = setNestedValue(jsonData, jsonPath, value);
          
          return this.db(table)
            .update({ [column]: JSON.stringify(updatedJson) })
            .where(whereConditions)
            .andWhere(this.db.raw(`ROWID = ${row.ROWID}`));
        });
        
        return Promise.all(updates).then(results => results.length);
        
      case 'mssql':
        query = this.db(table)
          .update({
            [column]: this.db.raw(`JSON_MODIFY(${column}, '$.${jsonPath}', JSON_QUERY('${jsonValue}'))`)
          })
          .where(whereConditions);
        break;
        
      default:
        throw new Error(`Dialecte non supporté pour les opérations JSON: ${this.dialect}`);
    }
    
    return query;
  }

  /**
   * @param {string} table
   * @param {string} column
   * @param {string|Array} path
   * @param {Object} whereConditions
   * @returns {Promise<boolean>}
   */
  async exists(table, column, path, whereConditions = {}) {
    const jsonPath = formatJsonPath(path);
    
    let query;
    
    switch (this.dialect) {
      case 'pg':
        query = this.db(table)
          .select(this.db.raw(`${column} ? '${jsonPath}' as exists`))
          .where(whereConditions)
          .first();
        break;
        
      case 'mysql':
        query = this.db(table)
          .select(this.db.raw(`JSON_CONTAINS_PATH(${column}, 'one', '$.${jsonPath}') as exists`))
          .where(whereConditions)
          .first();
        break;
        
      case 'sqlite':
      case 'mssql':
        query = this.db(table)
          .select(1)
          .whereRaw(`JSON_VALUE(${column}, '$.${jsonPath}') IS NOT NULL`)
          .where(whereConditions)
          .first();
        break;
        
      default:
        throw new Error(`Dialecte non supporté pour les opérations JSON: ${this.dialect}`);
    }
    
    const result = await query;
    return !!result && !!result.exists;
  }

  /**
   * @param {string} table
   * @param {string} column
   * @param {any} value
   * @param {string|Array} path
   * @returns {Object}
   */
  contains(table, column, value, path = null) {
    const jsonValue = JSON.stringify(value);
    
    switch (this.dialect) {
      case 'pg':
        if (path) {
          const jsonPath = formatJsonPath(path);
          return this.db(table).whereRaw(`${column} -> '${jsonPath}' @> '${jsonValue}'::jsonb`);
        } else {
          return this.db(table).whereRaw(`${column} @> '${jsonValue}'::jsonb`);
        }
        
      case 'mysql':
        if (path) {
          const jsonPath = formatJsonPath(path);
          return this.db(table).whereRaw(`JSON_CONTAINS(JSON_EXTRACT(${column}, '$.${jsonPath}'), '${jsonValue}')`);
        } else {
          return this.db(table).whereRaw(`JSON_CONTAINS(${column}, '${jsonValue}')`);
        }
        
      case 'sqlite':
        if (path) {
          const jsonPath = formatJsonPath(path);
          return this.db(table).whereRaw(`EXISTS (
            SELECT 1 FROM json_each(json_extract(${column}, '$.${jsonPath}'))
            WHERE value = json('${jsonValue}')
          )`);
        } else {
          return this.db(table).whereRaw(`EXISTS (
            SELECT 1 FROM json_each(${column})
            WHERE value = json('${jsonValue}')
          )`);
        }
        
      case 'mssql':
        if (path) {
          const jsonPath = formatJsonPath(path);
          return this.db(table).whereRaw(`JSON_VALUE(${column}, '$.${jsonPath}') = '${jsonValue}'`);
        } else {
          return this.db(table).whereRaw(`${column} LIKE '%${jsonValue.replace(/"/g, '\\"')}%'`);
        }
        
      default:
        throw new Error(`Dialecte non supporté pour les opérations JSON: ${this.dialect}`);
    }
  }

  /**
   * @param {string} table
   * @param {string} column
   * @param {Object} value
   * @param {Object} whereConditions
   * @returns {Promise<number>}
   */
  async merge(table, column, value, whereConditions = {}) {
    const jsonValue = JSON.stringify(value);
    
    switch (this.dialect) {
      case 'pg':
        return this.db(table)
          .update({
            [column]: this.db.raw(`${column} || '${jsonValue}'::jsonb`)
          })
          .where(whereConditions);
        
      case 'mysql':
        return this.db(table)
          .update({
            [column]: this.db.raw(`JSON_MERGE_PATCH(${column}, '${jsonValue}')`)
          })
          .where(whereConditions);
        
      case 'sqlite':
      case 'mssql':
        const rows = await this.db(table).select(column).where(whereConditions);
        
        const updates = rows.map(row => {
          let jsonData = row[column];
          
          if (typeof jsonData === 'string') {
            jsonData = JSON.parse(jsonData);
          }
          
          const merged = { ...jsonData, ...value };
          
          return this.db(table)
            .update({ [column]: JSON.stringify(merged) })
            .where(whereConditions)
            .andWhere(this.db.raw(`ROWID = ${row.ROWID}`));
        });
        
        const results = await Promise.all(updates);
        return results.length;
        
      default:
        throw new Error(`Dialecte non supporté pour les opérations JSON: ${this.dialect}`);
    }
  }

  /**
   * @param {string} table
   * @param {string} column
   * @param {string|Array} path
   * @param {Object} whereConditions
   * @returns {Promise<number>}
   */
  async remove(table, column, path, whereConditions = {}) {
    const jsonPath = formatJsonPath(path);
    
    switch (this.dialect) {
      case 'pg':
        return this.db(table)
          .update({
            [column]: this.db.raw(`${column} - '${jsonPath}'`)
          })
          .where(whereConditions);
        
      case 'mysql':
        return this.db(table)
          .update({
            [column]: this.db.raw(`JSON_REMOVE(${column}, '$.${jsonPath}')`)
          })
          .where(whereConditions);
        
      case 'sqlite':
      case 'mssql':
        const rows = await this.db(table).select(column).where(whereConditions);
        
        const updates = rows.map(row => {
          let jsonData = row[column];
          
          if (typeof jsonData === 'string') {
            jsonData = JSON.parse(jsonData);
          }
          
          const removeNestedKey = (obj, path) => {
            const parts = Array.isArray(path) ? path : path.split('.');
            let current = obj;
            
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              
              if (part.endsWith(']')) {
                const match = part.match(/(\w+)\[(\d+)\]/);
                if (match) {
                  const [_, name, index] = match;
                  if (!current[name] || !current[name][parseInt(index)]) return obj;
                  current = current[name][parseInt(index)];
                  continue;
                }
              }
              
              if (!current[part]) return obj;
              current = current[part];
            }
            
            const lastPart = parts[parts.length - 1];
            delete current[lastPart];
            return obj;
          };
          
          const updatedJson = removeNestedKey(jsonData, jsonPath);
          
          return this.db(table)
            .update({ [column]: JSON.stringify(updatedJson) })
            .where(whereConditions)
            .andWhere(this.db.raw(`ROWID = ${row.ROWID}`));
        });
        
        const results = await Promise.all(updates);
        return results.length;
        
      default:
        throw new Error(`Dialecte non supporté pour les opérations JSON: ${this.dialect}`);
    }
  }

  /**
   * @param {string} table
   * @param {string} column
   * @param {string|Array} path
   * @param {any} value
   * @param {Object} whereConditions
   * @returns {Promise<number>}
   */
  async append(table, column, path, value, whereConditions = {}) {
    const jsonPath = formatJsonPath(path);
    const jsonValue = JSON.stringify(value);
    
    switch (this.dialect) {
      case 'pg':
        return this.db(table)
          .update({
            [column]: this.db.raw(`jsonb_set(
              ${column},
              '{${jsonPath}}',
              COALESCE(${column} -> '${jsonPath}', '[]'::jsonb) || '${jsonValue}'::jsonb
            )`)
          })
          .where(whereConditions);
        
      case 'mysql':
        return this.db(table)
          .update({
            [column]: this.db.raw(`JSON_SET(
              ${column},
              '$.${jsonPath}',
              JSON_ARRAY_APPEND(
                COALESCE(JSON_EXTRACT(${column}, '$.${jsonPath}'), JSON_ARRAY()),
                '$', CAST('${jsonValue}' AS JSON)
              )
            )`)
          })
          .where(whereConditions);
        
      case 'sqlite':
      case 'mssql':
        const rows = await this.db(table).select(column).where(whereConditions);
        
        const updates = rows.map(row => {
          let jsonData = row[column];
          
          if (typeof jsonData === 'string') {
            jsonData = JSON.parse(jsonData);
          }
          
          const appendToArray = (obj, path, value) => {
            const parts = Array.isArray(path) ? path : path.split('.');
            let current = obj;
            
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              
              if (part.endsWith(']')) {
                const match = part.match(/(\w+)\[(\d+)\]/);
                if (match) {
                  const [_, name, index] = match;
                  if (!current[name]) current[name] = [];
                  current = current[name];
                  if (!current[parseInt(index)]) current[parseInt(index)] = {};
                  current = current[parseInt(index)];
                  continue;
                }
              }
              
              if (!current[part]) current[part] = {};
              current = current[part];
            }
            
            const lastPart = parts[parts.length - 1];
            
            if (!current[lastPart]) {
              current[lastPart] = [];
            } else if (!Array.isArray(current[lastPart])) {
              current[lastPart] = [current[lastPart]];
            }
            
            current[lastPart].push(value);
            return obj;
          };
          
          const updatedJson = appendToArray(jsonData, jsonPath, value);
          
          return this.db(table)
            .update({ [column]: JSON.stringify(updatedJson) })
            .where(whereConditions)
            .andWhere(this.db.raw(`ROWID = ${row.ROWID}`));
        });
        
        const results = await Promise.all(updates);
        return results.length;
        
      default:
        throw new Error(`Dialecte non supporté pour les opérations JSON: ${this.dialect}`);
    }
  }

  /**
   * @param {string} table
   * @param {string} column
   * @param {string|Array} path
   * @param {Object} whereConditions
   * @returns {Promise<string>}
   */
  async typeOf(table, column, path, whereConditions = {}) {
    const jsonPath = formatJsonPath(path);
    
    let query;
    
    switch (this.dialect) {
      case 'pg':
        query = this.db(table)
          .select(this.db.raw(`
            CASE jsonb_typeof(${column} -> '${jsonPath}')
              WHEN 'object' THEN 'object'
              WHEN 'array' THEN 'array'
              WHEN 'string' THEN 'string'
              WHEN 'number' THEN 'number'
              WHEN 'boolean' THEN 'boolean'
              WHEN 'null' THEN 'null'
              ELSE 'unknown'
            END as type
          `))
          .where(whereConditions)
          .first();
        break;
        
      case 'mysql':
        query = this.db(table)
          .select(this.db.raw(`
            CASE JSON_TYPE(JSON_EXTRACT(${column}, '$.${jsonPath}'))
              WHEN 'OBJECT' THEN 'object'
              WHEN 'ARRAY' THEN 'array'
              WHEN 'STRING' THEN 'string'
              WHEN 'INTEGER' THEN 'number'
              WHEN 'DOUBLE' THEN 'number'
              WHEN 'BOOLEAN' THEN 'boolean'
              WHEN 'NULL' THEN 'null'
              ELSE 'unknown'
            END as type
          `))
          .where(whereConditions)
          .first();
        break;
        
      case 'sqlite':
        query = this.db(table)
          .select(this.db.raw(`
            CASE json_type(json_extract(${column}, '$.${jsonPath}'))
              WHEN 'object' THEN 'object'
              WHEN 'array' THEN 'array'
              WHEN 'text' THEN 'string'
              WHEN 'integer' THEN 'number'
              WHEN 'real' THEN 'number'
              WHEN 'true' THEN 'boolean'
              WHEN 'false' THEN 'boolean'
              WHEN 'null' THEN 'null'
              ELSE 'unknown'
            END as type
          `))
          .where(whereConditions)
          .first();
        break;
        
      case 'mssql':
        query = this.db(table)
          .select(this.db.raw(`
            CASE
              WHEN JSON_VALUE(${column}, '$.${jsonPath}') IS NULL AND 
                   JSON_QUERY(${column}, '$.${jsonPath}') IS NOT NULL THEN
                CASE
                  WHEN JSON_QUERY(${column}, '$.${jsonPath}') LIKE '[%]' THEN 'array'
                  ELSE 'object'
                END
              WHEN ISNUMERIC(JSON_VALUE(${column}, '$.${jsonPath}')) = 1 THEN 'number'
              WHEN JSON_VALUE(${column}, '$.${jsonPath}') IN ('true', 'false') THEN 'boolean'
              WHEN JSON_VALUE(${column}, '$.${jsonPath}') IS NULL THEN 'null'
              ELSE 'string'
            END as type
          `))
          .where(whereConditions)
          .first();
        break;
        
      default:
        throw new Error(`Dialecte non supporté pour les opérations JSON: ${this.dialect}`);
    }
    
    const result = await query;
    return result ? result.type : 'unknown';
  }
}

/**
 * @param {Object} vesperdb
 * @returns {JsonOperations}
 */
function createJsonOperations(vesperdb) {
  return new JsonOperations(vesperdb);
}

module.exports = {
  JSON_OPERATIONS,
  JsonOperations,
  createJsonOperations
}; 