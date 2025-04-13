const SUPPORTED_DIALECTS = ['pg', 'mysql', 'sqlite', 'mssql'];

/**
 * @param {Object} config
 * @throws {Error}
 */
function configValidator(config) {
  if (!config) {
    throw new Error('La configuration est requise');
  }

  if (!config.client) {
    throw new Error('Le client/dialecte est requis dans la configuration');
  }

  if (!SUPPORTED_DIALECTS.includes(config.client)) {
    throw new Error(`Le dialecte '${config.client}' n'est pas supporté. Dialectes supportés: ${SUPPORTED_DIALECTS.join(', ')}`);
  }

  if (!config.connection) {
    throw new Error('La configuration de connexion est requise');
  }

  switch (config.client) {
    case 'pg':
    case 'mysql':
    case 'mssql':
    case 'oracle':
      validateConnectionConfig(config.connection, ['host', 'user', 'password', 'database']);
      break;
    case 'sqlite':
      validateSqliteConfig(config.connection);
      break;
  }

  return true;
}

/**
 * @param {Object} connection
 * @param {Array} requiredFields
 * @throws {Error}
 */
function validateConnectionConfig(connection, requiredFields) {
  for (const field of requiredFields) {
    if (!connection[field] && connection[field] !== 0) {
      throw new Error(`Le champ '${field}' est requis dans la configuration de connexion`);
    }
  }
}

/**
 * @param {Object} connection
 * @throws {Error}
 */
function validateSqliteConfig(connection) {
  if (!connection.filename) {
    throw new Error("Le champ 'filename' est requis pour la connexion SQLite");
  }
}

module.exports = {
  configValidator
}; 