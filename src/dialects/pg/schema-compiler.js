/**
 * @type {Object}
 */
const DATA_TYPES = {
  integer: 'INTEGER',
  bigInteger: 'BIGINT',
  text: 'TEXT',
  string: (length = 255) => `VARCHAR(${length})`,
  float: 'FLOAT',
  decimal: (precision = 8, scale = 2) => `DECIMAL(${precision}, ${scale})`,
  boolean: 'BOOLEAN',
  date: 'DATE',
  datetime: 'TIMESTAMP',
  timestamp: 'TIMESTAMP',
  binary: 'BYTEA',
  json: 'JSONB',
  uuid: 'UUID'
};

/**
 * @param {string} tableName
 * @param {Array} columns
 * @param {Object} constraints
 * @returns {Object}
 */
function compileCreateTable(tableName, columns, constraints) {
  const columnDefinitions = [];
  const constraintDefinitions = [];
  
  for (const column of columns) {
    columnDefinitions.push(compileColumn(column));
  }
  
  if (constraints.primaryKey && constraints.primaryKey.length) {
    constraintDefinitions.push(`PRIMARY KEY (${constraints.primaryKey.join(', ')})`);
  }
  
  if (constraints.unique && constraints.unique.length) {
    for (let i = 0; i < constraints.unique.length; i++) {
      const uniqueColumns = constraints.unique[i];
      constraintDefinitions.push(`UNIQUE (${uniqueColumns.join(', ')})`);
    }
  }
  
  if (constraints.foreignKeys && constraints.foreignKeys.length) {
    for (const fk of constraints.foreignKeys) {
      constraintDefinitions.push(
        `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referenceTable}(${fk.referenceColumn})`
      );
    }
  }
  
  const allDefinitions = [...columnDefinitions, ...constraintDefinitions];
  const sql = `CREATE TABLE ${tableName} (${allDefinitions.join(', ')})`;
  
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
    alterStatements.push(`ALTER TABLE ${tableName} ADD COLUMN ${compileColumn(column)}`);
  }
  
  if (constraints.primaryKey && constraints.primaryKey.length) {
    alterStatements.push(
      `ALTER TABLE ${tableName} ADD PRIMARY KEY (${constraints.primaryKey.join(', ')})`
    );
  }
  
  if (constraints.unique && constraints.unique.length) {
    for (let i = 0; i < constraints.unique.length; i++) {
      const uniqueColumns = constraints.unique[i];
      alterStatements.push(
        `ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_unique_${i} UNIQUE (${uniqueColumns.join(', ')})`
      );
    }
  }
  
  if (constraints.foreignKeys && constraints.foreignKeys.length) {
    for (let i = 0; i < constraints.foreignKeys.length; i++) {
      const fk = constraints.foreignKeys[i];
      alterStatements.push(
        `ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_fk_${i} ` +
        `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referenceTable}(${fk.referenceColumn})`
      );
    }
  }
  
  if (constraints.index && constraints.index.length) {
    for (let i = 0; i < constraints.index.length; i++) {
      const idx = constraints.index[i];
      const indexName = idx.name || `${tableName}_idx_${i}`;
      alterStatements.push(
        `CREATE INDEX ${indexName} ON ${tableName}(${idx.columns.join(', ')})`
      );
    }
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
    sql: `SELECT table_name FROM information_schema.tables WHERE table_name = $1`,
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
    sql: `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    bindings: [tableName, columnName]
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
    if (column.type === 'string') {
      parts.push(DATA_TYPES[column.type](column.length));
    } else if (column.type === 'decimal') {
      parts.push(DATA_TYPES[column.type](column.precision, column.scale));
    }
  } else {
    parts.push(DATA_TYPES[column.type] || 'TEXT');
  }
  
  if (column.autoIncrement) {
    parts[1] = 'SERIAL';
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