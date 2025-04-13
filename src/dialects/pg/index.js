const { Pool } = require('pg');
const queryCompiler = require('./query-compiler');
const schemaCompiler = require('./schema-compiler');

/**
 * @param {Object} connectionConfig
 * @returns {Pool}
 */
function createPool(connectionConfig) {
  return new Pool(connectionConfig);
}

/**
 * @param {Pool} pool
 * @returns {Promise<PoolClient>}
 */
async function acquireConnection(pool) {
  return await pool.connect();
}

/**
 * @param {Pool} pool
 * @param {PoolClient} connection
 * @returns {Promise<void>}
 */
async function releaseConnection(pool, connection) {
  if (connection.release) {
    connection.release();
  }
}

/**
 * @param {Pool} pool
 * @returns {Promise<void>}
 */
async function destroyPool(pool) {
  return await pool.end();
}

/**
 * @param {PoolClient} connection
 * @param {string} sql
 * @param {Array} bindings
 * @returns {Promise<Object>}
 */
async function executeQuery(connection, sql, bindings) {
  const result = await connection.query(sql, bindings);
  return result.rows;
}

/**
 * @param {PoolClient} connection
 * @returns {Promise<void>}
 */
async function beginTransaction(connection) {
  await connection.query('BEGIN');
}

/**
 * @param {PoolClient} connection
 * @returns {Promise<void>}
 */
async function commitTransaction(connection) {
  await connection.query('COMMIT');
}

/**
 * @param {PoolClient} connection
 * @returns {Promise<void>}
 */
async function rollbackTransaction(connection) {
  await connection.query('ROLLBACK');
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