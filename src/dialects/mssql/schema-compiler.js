/**
 * @type {Object}
 */
const DATA_TYPES = {
  integer: 'INT',
  bigInteger: 'BIGINT',
  text: 'NVARCHAR(MAX)',
  string: (length = 255) => `NVARCHAR(${length})`,
  float: 'FLOAT',
  decimal: (precision = 8, scale = 2) => `DECIMAL(${precision}, ${scale})`,
  boolean: 'BIT',
  date: 'DATE',
  datetime: 'DATETIME2',
  timestamp: 'DATETIME2',
  binary: 'VARBINARY(MAX)',
  json: 'NVARCHAR(MAX)',
  uuid: 'UNIQUEIDENTIFIER'
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
    constraintDefinitions.push(
      `CONSTRAINT [PK_${tableName}] PRIMARY KEY (${constraints.primaryKey.join(', ')})`
    );
  }
  
  if (constraints.unique && constraints.unique.length) {
    for (let i = 0; i < constraints.unique.length; i++) {
      const uniqueColumns = constraints.unique[i];
      constraintDefinitions.push(
        `CONSTRAINT [UQ_${tableName}_${i}] UNIQUE (${uniqueColumns.join(', ')})`
      );
    }
  }
  
  if (constraints.foreignKeys && constraints.foreignKeys.length) {
    for (let i = 0; i < constraints.foreignKeys.length; i++) {
      const fk = constraints.foreignKeys[i];
      constraintDefinitions.push(
        `CONSTRAINT [FK_${tableName}_${fk.column}_${i}] ` +
        `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referenceTable} ` +
        `(${fk.referenceColumn}) ON DELETE CASCADE`
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
    alterStatements.push(`ALTER TABLE ${tableName} ADD ${compileColumn(column)}`);
  }
  
  if (constraints.primaryKey && constraints.primaryKey.length) {
    alterStatements.push(
      `ALTER TABLE ${tableName} ADD CONSTRAINT [PK_${tableName}] ` +
      `PRIMARY KEY (${constraints.primaryKey.join(', ')})`
    );
  }
  
  if (constraints.unique && constraints.unique.length) {
    for (let i = 0; i < constraints.unique.length; i++) {
      const uniqueColumns = constraints.unique[i];
      alterStatements.push(
        `ALTER TABLE ${tableName} ADD CONSTRAINT [UQ_${tableName}_${i}] ` +
        `UNIQUE (${uniqueColumns.join(', ')})`
      );
    }
  }
  
  if (constraints.foreignKeys && constraints.foreignKeys.length) {
    for (let i = 0; i < constraints.foreignKeys.length; i++) {
      const fk = constraints.foreignKeys[i];
      alterStatements.push(
        `ALTER TABLE ${tableName} ADD CONSTRAINT [FK_${tableName}_${fk.column}_${i}] ` +
        `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referenceTable} ` +
        `(${fk.referenceColumn}) ON DELETE CASCADE`
      );
    }
  }
  
  if (constraints.index && constraints.index.length) {
    for (let i = 0; i < constraints.index.length; i++) {
      const idx = constraints.index[i];
      const indexName = idx.name || `IX_${tableName}_${i}`;
      alterStatements.push(
        `CREATE INDEX [${indexName}] ON ${tableName}(${idx.columns.join(', ')})`
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
    sql: `IF OBJECT_ID('${tableName}', 'U') IS NOT NULL DROP TABLE ${tableName}`,
    bindings: []
  };
}

/**
 * @param {string} tableName
 * @returns {Object}
 */
function compileTableExists(tableName) {
  return {
    sql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?`,
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
    sql: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME = ?`,
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
    parts.push(DATA_TYPES[column.type] || 'NVARCHAR(255)');
  }
  
  if (column.autoIncrement) {
    parts.push('IDENTITY(1,1)');
  }
  
  if (!column.nullable) {
    parts.push('NOT NULL');
  } else {
    parts.push('NULL');
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