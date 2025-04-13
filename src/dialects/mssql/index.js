const sql = require('mssql');
const queryCompiler = require('./query-compiler');
const schemaCompiler = require('./schema-compiler');

let globalConnectionPool = null;

/**
 * @param {Object} connectionConfig
 * @returns {sql.ConnectionPool}
 */
async function createPool(connectionConfig) {
  const mssqlConfig = {
    user: connectionConfig.user,
    password: connectionConfig.password,
    server: connectionConfig.host,
    database: connectionConfig.database,
    port: connectionConfig.port || 1433,
    options: {
      encrypt: connectionConfig.encrypt !== false,
      trustServerCertificate: connectionConfig.trustServerCertificate || false,
      enableArithAbort: true
    },
    pool: {
      max: connectionConfig.pool?.max || 10,
      min: connectionConfig.pool?.min || 0,
      idleTimeoutMillis: connectionConfig.pool?.idleTimeoutMillis || 30000
    }
  };

  const pool = new sql.ConnectionPool(mssqlConfig);
  await pool.connect();
  
  globalConnectionPool = pool;
  
  return pool;
}

/**
 * @param {sql.ConnectionPool} pool
 * @returns {Promise<sql.ConnectionPool>}
 */
async function acquireConnection(pool) {
  return pool;
}

/**
 * @param {sql.ConnectionPool} pool
 * @param {sql.ConnectionPool} connection
 * @returns {Promise<void>}
 */
async function releaseConnection(pool, connection) {
  return Promise.resolve();
}

/**
 * @param {sql.ConnectionPool} pool
 * @returns {Promise<void>}
 */
async function destroyPool(pool) {
  if (pool && pool.close) {
    await pool.close();
    globalConnectionPool = null;
  }
  return Promise.resolve();
}

/**
 * @param {sql.ConnectionPool} pool
 * @param {string} sql
 * @param {Array} bindings
 * @returns {Promise<Object>}
 */
async function executeQuery(pool, sqlQuery, bindings = []) {
  const request = pool.request();
  
  bindings.forEach((value, index) => {
    request.input(`p${index}`, value);
  });
  
  let paramIndex = 0;
  const formattedSql = sqlQuery.replace(/\?/g, () => `@p${paramIndex++}`);
  
  const result = await request.query(formattedSql);
  
  const firstWord = sqlQuery.trim().split(' ')[0].toUpperCase();
  
  if (firstWord === 'SELECT') {
    return result.recordset;
  } else if (firstWord === 'INSERT') {
    if (result.recordset && result.recordset.length > 0) {
      return [result.recordset[0].id];
    }
    return [];
  } else {
    return { rowCount: result.rowsAffected[0] || 0 };
  }
}

/**
 * @param {sql.ConnectionPool} pool
 * @returns {Promise<sql.Transaction>}
 */
async function beginTransaction(pool) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  
  return transaction;
}

/**
 * @param {sql.Transaction} transaction
 * @returns {Promise<void>}
 */
async function commitTransaction(transaction) {
  if (transaction && transaction.commit) {
    await transaction.commit();
  }
  return Promise.resolve();
}

/**
 * @param {sql.Transaction} transaction
 * @returns {Promise<void>}
 */
async function rollbackTransaction(transaction) {
  if (transaction && transaction.rollback) {
    await transaction.rollback();
  }
  return Promise.resolve();
}

module.exports = {
  createPool,
  acquireConnection,
  releaseConnection,
  destroyPool,
  executeQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  queryCompiler,
  schemaCompiler
}; 