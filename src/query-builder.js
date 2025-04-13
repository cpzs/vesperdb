class QueryBuilder {
  constructor(client, tableName) {
    this.client = client;
    this.tableName = tableName;
    this.statements = {
      select: null,
      where: [],
      join: [],
      orderBy: [],
      limit: null,
      offset: null,
      groupBy: [],
      having: []
    };
    this.bindings = {
      select: [],
      where: [],
      join: [],
      orderBy: [],
      groupBy: [],
      having: []
    };
  }

  /**
   * @param  {...string} columns
   * @returns {QueryBuilder}
   */
  select(...columns) {
    this.statements.select = columns.length ? columns : ['*'];
    return this;
  }

  /**
   * @param {string|Object|Function} column
   * @param {string} operator
   * @param {any} value
   * @returns {QueryBuilder}
   */
  where(column, operator, value) {
    if (typeof column === 'object') {
      const entries = Object.entries(column);
      for (const [key, val] of entries) {
        this.where(key, '=', val);
      }
      return this;
    }

    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }

    this.statements.where.push({
      column,
      operator,
      value,
      boolean: 'AND'
    });

    if (value !== undefined) {
      this.bindings.where.push(value);
    }

    return this;
  }

  /**
   * @param {string} column
   * @param {string} operator
   * @param {any} value
   * @returns {QueryBuilder}
   */
  orWhere(column, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }

    this.statements.where.push({
      column,
      operator,
      value,
      boolean: 'OR'
    });

    if (value !== undefined) {
      this.bindings.where.push(value);
    }

    return this;
  }

  /**
   * @param {number} limit
   * @returns {QueryBuilder}
   */
  limit(limit) {
    this.statements.limit = limit;
    return this;
  }

  /**
   * @param {number} offset
   * @returns {QueryBuilder}
   */
  offset(offset) {
    this.statements.offset = offset;
    return this;
  }

  /**
   * @param {string} column
   * @param {string} direction
   * @returns {QueryBuilder}
   */
  orderBy(column, direction = 'asc') {
    this.statements.orderBy.push({
      column,
      direction: direction.toLowerCase()
    });
    return this;
  }

  /**
   * @param {string} table
   * @param {string} first
   * @param {string} operator
   * @param {string} second
   * @returns {QueryBuilder}
   */
  join(table, first, operator, second) {
    this.statements.join.push({
      type: 'inner',
      table,
      first,
      operator,
      second
    });
    return this;
  }

  /**
   * @param {string} table
   * @param {string} first
   * @param {string} operator
   * @param {string} second
   * @returns {QueryBuilder}
   */
  leftJoin(table, first, operator, second) {
    this.statements.join.push({
      type: 'left',
      table,
      first,
      operator,
      second
    });
    return this;
  }

  /**
   * @returns {Object}
   * @private
   */
  _toSQL() {
    const dialectModule = this.client.dialectModule;
    return dialectModule.queryCompiler.compileSelect(this.tableName, this.statements, this.bindings);
  }

  /**
   * @returns {Promise<Array>}
   */
  async get() {
    const { sql, bindings } = this._toSQL();
    return await this.client.query(sql, bindings);
  }

  /**
   * @returns {Promise<Object>}
   */
  async first() {
    const limitedQuery = this.limit(1);
    const results = await limitedQuery.get();
    return results.length ? results[0] : null;
  }

  /**
   * @param {Object|Array} data
   * @returns {Promise<Array>}
   */
  async insert(data) {
    const dialectModule = this.client.dialectModule;
    const { sql, bindings } = dialectModule.queryCompiler.compileInsert(this.tableName, data);
    return await this.client.query(sql, bindings);
  }

  /**
   * @param {Object} data
   * @returns {Promise<number>}
   */
  async update(data) {
    const dialectModule = this.client.dialectModule;
    const { sql, bindings } = dialectModule.queryCompiler.compileUpdate(
      this.tableName, 
      data, 
      this.statements.where, 
      this.bindings.where
    );
    const result = await this.client.query(sql, bindings);
    return result.rowCount || 0;
  }

  /**
   * @returns {Promise<number>}
   */
  async delete() {
    const dialectModule = this.client.dialectModule;
    const { sql, bindings } = dialectModule.queryCompiler.compileDelete(
      this.tableName, 
      this.statements.where, 
      this.bindings.where
    );
    const result = await this.client.query(sql, bindings);
    return result.rowCount || 0;
  }
}

module.exports = QueryBuilder; 