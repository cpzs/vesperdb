class SchemaBuilder {
  constructor(client) {
    this.client = client;
    this.dialectModule = client.dialectModule;
  }

  /**
   * @param {string} tableName
   * @param {Function} callback
   * @returns {Promise<void>}
   */
  async createTable(tableName, callback) {
    const tableBuilder = new TableBuilder(tableName);
    callback(tableBuilder);
    
    const { sql, bindings } = this.dialectModule.schemaCompiler.compileCreateTable(
      tableName, 
      tableBuilder.columns,
      tableBuilder.constraints
    );
    
    return await this.client.query(sql, bindings);
  }

  /**
   * @param {string} tableName
   * @param {Function} callback
   * @returns {Promise<void>}
   */
  async alterTable(tableName, callback) {
    const tableBuilder = new TableBuilder(tableName, true);
    callback(tableBuilder);
    
    const { sql, bindings } = this.dialectModule.schemaCompiler.compileAlterTable(
      tableName, 
      tableBuilder.columns,
      tableBuilder.constraints
    );
    
    return await this.client.query(sql, bindings);
  }

  /**
   * @param {string} tableName
   * @returns {Promise<void>}
   */
  async dropTable(tableName) {
    const { sql } = this.dialectModule.schemaCompiler.compileDropTable(tableName);
    return await this.client.query(sql);
  }

  /**
   * @param {string} tableName
   * @returns {Promise<boolean>}
   */
  async hasTable(tableName) {
    const { sql, bindings } = this.dialectModule.schemaCompiler.compileTableExists(tableName);
    const result = await this.client.query(sql, bindings);
    return result.length > 0;
  }

  /**
   * @param {string} tableName
   * @param {string} columnName
   * @returns {Promise<boolean>}
   */
  async hasColumn(tableName, columnName) {
    const { sql, bindings } = this.dialectModule.schemaCompiler.compileColumnExists(tableName, columnName);
    const result = await this.client.query(sql, bindings);
    return result.length > 0;
  }
}

class TableBuilder {
  constructor(tableName, isAlter = false) {
    this.tableName = tableName;
    this.isAlter = isAlter;
    this.columns = [];
    this.constraints = {
      primaryKey: null,
      foreignKeys: [],
      unique: [],
      index: []
    };
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  integer(name) {
    return this._addColumn(name, 'integer');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  text(name) {
    return this._addColumn(name, 'text');
  }

  /**
   * @param {string} name
   * @param {number} length
   * @returns {ColumnBuilder}
   */
  string(name, length = 255) {
    return this._addColumn(name, 'string', { length });
  }

  /**
   * @param {string} name
   * @param {number} precision
   * @param {number} scale
   * @returns {ColumnBuilder}
   */
  decimal(name, precision = 8, scale = 2) {
    return this._addColumn(name, 'decimal', { precision, scale });
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  boolean(name) {
    return this._addColumn(name, 'boolean');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  date(name) {
    return this._addColumn(name, 'date');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  datetime(name) {
    return this._addColumn(name, 'datetime');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  timestamp(name) {
    return this._addColumn(name, 'timestamp');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  increments(name = 'id') {
    const column = this._addColumn(name, 'integer', { autoIncrement: true });
    this.primary(name);
    return column;
  }

  /**
   * @param {string|Array} columns
   * @returns {TableBuilder}
   */
  primary(columns) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.constraints.primaryKey = cols;
    return this;
  }

  /**
   * @param {string} column
   * @param {string} reference
   * @returns {TableBuilder}
   */
  foreign(column, reference) {
    const [refTable, refColumn] = reference.split('.');
    this.constraints.foreignKeys.push({
      column,
      referenceTable: refTable,
      referenceColumn: refColumn
    });
    return this;
  }

  /**
   * @param {string|Array} columns
   * @returns {TableBuilder}
   */
  unique(columns) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.constraints.unique.push(cols);
    return this;
  }

  /**
   * @param {string|Array} columns
   * @param {string} indexName
   * @returns {TableBuilder}
   */
  index(columns, indexName) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.constraints.index.push({
      columns: cols,
      name: indexName
    });
    return this;
  }

  /**
   * @param {string} name
   * @param {string} type
   * @param {Object} options
   * @returns {ColumnBuilder}
   * @private
   */
  _addColumn(name, type, options = {}) {
    const columnBuilder = new ColumnBuilder(name, type, options);
    this.columns.push(columnBuilder);
    return columnBuilder;
  }
}

class ColumnBuilder {
  constructor(name, type, options = {}) {
    this.name = name;
    this.type = type;
    this.nullable = true;
    this.defaultValue = undefined;
    this.autoIncrement = options.autoIncrement || false;
    this.length = options.length;
    this.precision = options.precision;
    this.scale = options.scale;
  }

  /**
   * @returns {ColumnBuilder}
   */
  notNullable() {
    this.nullable = false;
    return this;
  }

  /**
   * @param {any} value
   * @returns {ColumnBuilder}
   */
  defaultTo(value) {
    this.defaultValue = value;
    return this;
  }

  /**
   * @returns {ColumnBuilder}
   */
  increments() {
    this.autoIncrement = true;
    return this;
  }
}

module.exports = SchemaBuilder; 