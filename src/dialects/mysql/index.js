const mysql = require('mysql');
const queryCompiler = require('./query-compiler');
const schemaCompiler = require('./schema-compiler');

/**
 * @param {Object} connectionConfig
 * @returns {Pool}
 */
function createPool(connectionConfig) {
  return mysql.createPool(connectionConfig);
}

/**
 * @param {Pool} pool
 * @returns {Promise<Connection>}
 */
async function acquireConnection(pool) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) return reject(err);
      resolve(connection);
    });
  });
}

/**
 * @param {Pool} pool
 * @param {Connection} connection
 * @returns {Promise<void>}
 */
async function releaseConnection(pool, connection) {
  if (connection && connection.release) {
    connection.release();
  }
  return Promise.resolve();
}

/**
 * @param {Pool} pool
 * @returns {Promise<void>}
 */
async function destroyPool(pool) {
  return new Promise((resolve, reject) => {
    pool.end(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * @param {Connection} connection
 * @param {string} sql
 * @param {Array} bindings
 * @returns {Promise<Object>}
 */
async function executeQuery(connection, sql, bindings) {
  return new Promise((resolve, reject) => {
    connection.query(sql, bindings, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

/**
 * @param {Connection} connection
 * @returns {Promise<void>}
 */
async function beginTransaction(connection) {
  return new Promise((resolve, reject) => {
    connection.beginTransaction(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * @param {Connection} connection
 * @returns {Promise<void>}
 */
async function commitTransaction(connection) {
  return new Promise((resolve, reject) => {
    connection.commit(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * @param {Connection} connection
 * @returns {Promise<void>}
 */
async function rollbackTransaction(connection) {
  return new Promise((resolve, reject) => {
    connection.rollback(err => {
      if (err) return reject(err);
      resolve();
    });
  });
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