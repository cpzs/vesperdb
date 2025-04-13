/**
 * @type {Object}
 */
const DATA_TYPES = {
  integer: 'INTEGER',
  bigInteger: 'INTEGER',
  text: 'TEXT',
  string: (length = 255) => `TEXT`,
  float: 'REAL',
  decimal: 'REAL',
  boolean: 'INTEGER',
  date: 'TEXT',
  datetime: 'TEXT',
  timestamp: 'TEXT',
  binary: 'BLOB',
  json: 'TEXT',
  uuid: 'TEXT'
};

/**
 * @param {string} tableName
 * @param {Array} columns
 * @param {Object} constraints
 * @returns {Object}
 */
function compileCreateTable(tableName, columns, constraints) {
  const columnDefinitions = [];
  
  for (const column of columns) {
    let definition = compileColumn(column);
    
    if (constraints.primaryKey && 
        constraints.primaryKey.length === 1 && 
        constraints.primaryKey[0] === column.name) {
      definition += ' PRIMARY KEY';
      
      if (column.autoIncrement) {
        definition += ' AUTOINCREMENT';
      }
    }
    
    columnDefinitions.push(definition);
  }
  
  if (constraints.primaryKey && constraints.primaryKey.length > 1) {
    columnDefinitions.push(`PRIMARY KEY (${constraints.primaryKey.join(', ')})`);
  }
  
  if (constraints.unique && constraints.unique.length) {
    for (let i = 0; i < constraints.unique.length; i++) {
      const uniqueColumns = constraints.unique[i];
      columnDefinitions.push(`UNIQUE (${uniqueColumns.join(', ')})`);
    }
  }
  
  if (constraints.foreignKeys && constraints.foreignKeys.length) {
    for (const fk of constraints.foreignKeys) {
      columnDefinitions.push(
        `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referenceTable} ` +
        `(${fk.referenceColumn}) ON DELETE CASCADE`
      );
    }
  }
  
  const sql = `CREATE TABLE ${tableName} (${columnDefinitions.join(', ')})`;
  
  return {
    sql,
    bindings: []
  };
}

/**
 * @param {string} tableName
 * @param {Array} columns
 * @param {Object} constraints
 * @returns {Object}
 */
function compileAlterTable(tableName, columns, constraints) {
  const alterStatements = [];
  const bindings = [];
  
  for (const column of columns) {
    if (!column.nullable && column.defaultValue === undefined) {
      console.warn(`SQLite ne peut pas ajouter une colonne NOT NULL sans valeur par défaut: ${column.name}`);
      column.nullable = true;
    }
    
    alterStatements.push(`ALTER TABLE ${tableName} ADD COLUMN ${compileColumn(column)}`);
  }
  
  if ((constraints.primaryKey && constraints.primaryKey.length) || 
      (constraints.unique && constraints.unique.length) ||
      (constraints.foreignKeys && constraints.foreignKeys.length) ||
      (constraints.index && constraints.index.length)) {
    console.warn('SQLite ne permet pas d\'ajouter des contraintes avec ALTER TABLE directement. ' +
                'Considérez recréer la table avec les nouvelles contraintes.');
  }
  
  if (constraints.index && constraints.index.length) {
    for (let i = 0; i < constraints.index.length; i++) {
      const idx = constraints.index[i];
      const indexName = idx.name || `${tableName}_idx_${i}`;
      alterStatements.push(
        `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${idx.columns.join(', ')})`
      );
    }
  }
  
  if (alterStatements.length === 0) {
    throw new Error('Aucune modification valide pour SQLite');
  }
  
  return {
    sql: alterStatements.join('; '),
    bindings
  };
}

/**
 * @param {string} tableName
 * @returns {Object}
 */
function compileDropTable(tableName) {
  return {
    sql: `DROP TABLE IF EXISTS ${tableName}`,
    bindings: []
  };
}

/**
 * @param {string} tableName
 * @returns {Object}
 */
function compileTableExists(tableName) {
  return {
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    bindings: [tableName]
  };
}

/**
 * @param {string} tableName
 * @param {string} columnName
 * @returns {Object}
 */
function compileColumnExists(tableName, columnName) {
  return {
    sql: `PRAGMA table_info(${tableName})`,
    bindings: []
  };
}

/**
 * @param {ColumnBuilder} column
 * @returns {string}
 * @private
 */
function compileColumn(column) {
  const parts = [column.name];
  
  if (typeof DATA_TYPES[column.type] === 'function') {
    parts.push(DATA_TYPES[column.type](column.length));
  } else {
    parts.push(DATA_TYPES[column.type] || 'TEXT');
  }
  
  if (!column.nullable) {
    parts.push('NOT NULL');
  }
  
  if (column.defaultValue !== undefined) {
    if (typeof column.defaultValue === 'string') {
      parts.push(`DEFAULT '${column.defaultValue}'`);
    } else if (column.defaultValue === null) {
      parts.push('DEFAULT NULL');
    } else {
      parts.push(`DEFAULT ${column.defaultValue}`);
    }
  }
  
  return parts.join(' ');
}

module.exports = {
  compileCreateTable,
  compileAlterTable,
  compileDropTable,
  compileTableExists,
  compileColumnExists
}; 