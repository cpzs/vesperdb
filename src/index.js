const Client = require('./client');
const QueryBuilder = require('./query-builder');
const SchemaBuilder = require('./schema-builder');
const { configValidator } = require('./utils/config-validator');
const { createSchema, TYPES } = require('./schema/validator');
const { createJsonOperations } = require('./json/json-operations');
const { configureCacheMiddleware } = require('./cache/query-cache');

/**
 * @param {Object} config
 * @returns {Object}
 */
function vesperDB(config = {}) {
  configValidator(config);

  const client = new Client(config);
  const instance = function(tableName) {
    return new QueryBuilder(client, tableName);
  };

  instance.client = client;
  instance.queryBuilder = QueryBuilder;
  instance.schemaBuilder = SchemaBuilder;
  instance.schema = new SchemaBuilder(client);
  instance.Schema = {
    create: createSchema,
    TYPES
  };
  
  instance.json = createJsonOperations(instance);
  if (config.cache && config.cache.enabled) {
    configureCacheMiddleware(instance, config.cache.options || {});
  }
  
  instance.transaction = function(cb) {
    return client.transaction(cb);
  };
  
  instance.raw = function(sql, bindings) {
    return client.raw(sql, bindings);
  };

  return instance;
}

module.exports = vesperDB; 