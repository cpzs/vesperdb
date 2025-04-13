class Client {
  constructor(config) {
    this.config = config;
    this.dialect = config.client || 'pg';
    this.dialectModule = this._loadDialect(this.dialect);
    this.connectionPool = null;
    this._initialize();
  }

  /**
   * @param {string} dialect
   * @returns {Object}
   * @private
   */
  _loadDialect(dialect) {
    try {
      return require(`./dialects/${dialect}/index`);
    } catch (err) {
      throw new Error(`Dialecte '${dialect}' non supporté ou introuvable.`);
    }
  }

  /**
   * @private
   */
  _initialize() {
    if (this.dialectModule.createPool) {
      this.connectionPool = this.dialectModule.createPool(this.config.connection);
    }
  }

  /**
   * @returns {Promise<Object>}
   */
  async acquireConnection() {
    if (!this.connectionPool) {
      throw new Error('Le pool de connexions n\'est pas initialisé');
    }
    
    return await this.dialectModule.acquireConnection(this.connectionPool);
  }

  /**
   * @param {Object} connection
   * @returns {Promise<void>}
   */
  async releaseConnection(connection) {
    if (!this.connectionPool) return;
    
    return await this.dialectModule.releaseConnection(this.connectionPool, connection);
  }

  /**
   * @param {string} sql
   * @param {Array} bindings
   * @returns {Promise<Object>}
   */
  async query(sql, bindings = []) {
    const connection = await this.acquireConnection();
    
    try {
      const result = await this.dialectModule.executeQuery(connection, sql, bindings);
      return result;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * @param {string} sql
   * @param {Array} bindings
   * @returns {Object}
   */
  raw(sql, bindings) {
    return {
      sql,
      bindings,
      execute: async () => await this.query(sql, bindings)
    };
  }

  /**
   * @param {Function} callback
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    const connection = await this.acquireConnection();
    
    try {
      await this.dialectModule.beginTransaction(connection);
    
      const trxClient = Object.create(this);
      trxClient.acquireConnection = async () => connection;
      trxClient.releaseConnection = async () => {};
      
      const result = await callback(trxClient);
      
      await this.dialectModule.commitTransaction(connection);
      return result;
    } catch (error) {
      await this.dialectModule.rollbackTransaction(connection);
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.connectionPool && this.dialectModule.destroyPool) {
      await this.dialectModule.destroyPool(this.connectionPool);
      this.connectionPool = null;
    }
  }
}

module.exports = Client; 