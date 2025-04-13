const sqlite3 = require('sqlite3').verbose();
const queryCompiler = require('./query-compiler');
const schemaCompiler = require('./schema-compiler');
const path = require('path');
const fs = require('fs');

/**
 * @param {Object} connectionConfig
 * @returns {sqlite3.Database}
 */
function createPool(connectionConfig) {
  let filename = connectionConfig.filename || 'vesper.sqlite';
  if (filename !== ':memory:') {
    const ext = path.extname(filename);
    if (!ext) {
      filename += '.sqlite';
    } else if (ext !== '.sqlite') {
      filename = filename.replace(ext, '.sqlite');
    }
    
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    connectionConfig.filename = filename;
  }
  
  return new sqlite3.Database(filename, (err) => {
    if (err) {
      console.error(err.message);
      throw err;
    }
  });
}

/**
 * @param {sqlite3.Database} db
 * @returns {Promise<sqlite3.Database>}
 */
async function acquireConnection(db) {
  return db;
}

/**
 * @param {sqlite3.Database} db
 * @param {sqlite3.Database} connection
 * @returns {Promise<void>}
 */
async function releaseConnection(db, connection) {
  return Promise.resolve();
}

/**
 * @param {sqlite3.Database} db
 * @returns {Promise<void>}
 */
async function destroyPool(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * @param {sqlite3.Database} db
 * @param {string} sql
 * @param {Array} bindings
 * @returns {Promise<Object[]>}
 */
async function executeQuery(db, sql, bindings = []) {
  return new Promise((resolve, reject) => {
    const firstWord = sql.trim().split(' ')[0].toUpperCase();
    
    if (firstWord === 'SELECT') {
      db.all(sql, bindings, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    } else if (firstWord === 'INSERT') {
      db.run(sql, bindings, function(err) {
        if (err) return reject(err);
        resolve([this.lastID]);
      });
    } else {
      db.run(sql, bindings, function(err) {
        if (err) return reject(err);
        resolve({ rowCount: this.changes });
      });
    }
  });
}

/**
 * @param {sqlite3.Database} db
 * @returns {Promise<void>}
 */
async function beginTransaction(db) {
  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * @param {sqlite3.Database} db
 * @returns {Promise<void>}
 */
async function commitTransaction(db) {
  return new Promise((resolve, reject) => {
    db.run('COMMIT', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * @param {sqlite3.Database} db
 * @returns {Promise<void>}
 */
async function rollbackTransaction(db) {
  return new Promise((resolve, reject) => {
    db.run('ROLLBACK', (err) => {
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