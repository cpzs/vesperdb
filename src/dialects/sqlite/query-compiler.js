/**
 * @param {string} tableName
 * @param {Object} statements
 * @param {Object} bindings
 * @returns {Object}
 */
function compileSelect(tableName, statements, bindings) {
  const parts = ['SELECT'];
  const params = [];

  if (statements.select && statements.select.length) {
    parts.push(statements.select.join(', '));
  } else {
    parts.push('*');
  }

  parts.push(`FROM ${tableName}`);

  if (statements.join && statements.join.length) {
    for (const join of statements.join) {
      const { type, table, first, operator, second } = join;
      let joinClause = '';
      
      switch (type) {
        case 'left':
          joinClause = 'LEFT JOIN';
          break;
        case 'right':
          joinClause = 'LEFT JOIN';
          console.warn('SQLite ne supporte pas RIGHT JOIN, utilisation de LEFT JOIN à la place');
          break;
        case 'full':
          joinClause = 'LEFT JOIN';
          console.warn('SQLite ne supporte pas FULL JOIN, utilisation de LEFT JOIN à la place');
          break;
        default:
          joinClause = 'JOIN';
      }
      
      parts.push(`${joinClause} ${table} ON ${first} ${operator} ${second}`);
    }
  }

  if (statements.where && statements.where.length) {
    const whereClauses = [];
    
    for (let i = 0; i < statements.where.length; i++) {
      const { column, operator, value, boolean } = statements.where[i];
      
      if (i === 0) {
        whereClauses.push(`${column} ${operator} ?`);
      } else {
        whereClauses.push(`${boolean} ${column} ${operator} ?`);
      }
      
      params.push(value);
    }
    
    parts.push(`WHERE ${whereClauses.join(' ')}`);
  }

  if (statements.groupBy && statements.groupBy.length) {
    parts.push(`GROUP BY ${statements.groupBy.join(', ')}`);
  }

  if (statements.having && statements.having.length) {
    const havingClauses = [];
    
    for (let i = 0; i < statements.having.length; i++) {
      const { column, operator, value, boolean } = statements.having[i];
      
      if (i === 0) {
        havingClauses.push(`${column} ${operator} ?`);
      } else {
        havingClauses.push(`${boolean} ${column} ${operator} ?`);
      }
      
      params.push(value);
    }
    
    parts.push(`HAVING ${havingClauses.join(' ')}`);
  }

  if (statements.orderBy && statements.orderBy.length) {
    const orders = statements.orderBy.map(order => `${order.column} ${order.direction.toUpperCase()}`);
    parts.push(`ORDER BY ${orders.join(', ')}`);
  }

  if (statements.limit !== null && statements.limit !== undefined) {
    parts.push(`LIMIT ?`);
    params.push(statements.limit);
    
    if (statements.offset !== null && statements.offset !== undefined) {
      parts.push(`OFFSET ?`);
      params.push(statements.offset);
    }
  }

  return {
    sql: parts.join(' '),
    bindings: params
  };
}

/**
 * @param {string} tableName
 * @param {Object|Array} data
 * @returns {Object}
 */
function compileInsert(tableName, data) {
  const rows = Array.isArray(data) ? data : [data];
  if (!rows.length) {
    throw new Error('Aucune donnée à insérer');
  }

  const columns = Object.keys(rows[0]);
  const paramPlaceholders = [];
  const params = [];

  for (const row of rows) {
    const rowParams = [];
    for (const column of columns) {
      rowParams.push('?');
      params.push(row[column]);
    }
    paramPlaceholders.push(`(${rowParams.join(', ')})`);
  }

  const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${paramPlaceholders.join(', ')}`;

  return {
    sql,
    bindings: params
  };
}

/**
 * @param {string} tableName
 * @param {Object} data
 * @param {Array} whereStatements
 * @param {Array} whereBindings
 * @returns {Object}
 */
function compileUpdate(tableName, data, whereStatements, whereBindings) {
  if (!data || Object.keys(data).length === 0) {
    throw new Error('Aucune donnée à mettre à jour');
  }

  const columns = Object.keys(data);
  const params = [];

  const setClauses = columns.map(column => {
    params.push(data[column]);
    return `${column} = ?`;
  });

  let sql = `UPDATE ${tableName} SET ${setClauses.join(', ')}`;

  if (whereStatements && whereStatements.length) {
    const whereClauses = [];
    
    for (let i = 0; i < whereStatements.length; i++) {
      const { column, operator, value, boolean } = whereStatements[i];
      
      if (i === 0) {
        whereClauses.push(`${column} ${operator} ?`);
      } else {
        whereClauses.push(`${boolean} ${column} ${operator} ?`);
      }
      
      params.push(value);
    }
    
    sql += ` WHERE ${whereClauses.join(' ')}`;
  }

  return {
    sql,
    bindings: params
  };
}

/**
 * @param {string} tableName
 * @param {Array} whereStatements
 * @param {Array} whereBindings
 * @returns {Object}
 */
function compileDelete(tableName, whereStatements, whereBindings) {
  const params = [];

  let sql = `DELETE FROM ${tableName}`;
  if (whereStatements && whereStatements.length) {
    const whereClauses = [];
    
    for (let i = 0; i < whereStatements.length; i++) {
      const { column, operator, value, boolean } = whereStatements[i];
      
      if (i === 0) {
        whereClauses.push(`${column} ${operator} ?`);
      } else {
        whereClauses.push(`${boolean} ${column} ${operator} ?`);
      }
      
      params.push(value);
    }
    
    sql += ` WHERE ${whereClauses.join(' ')}`;
  }

  return {
    sql,
    bindings: params
  };
}

module.exports = {
  compileSelect,
  compileInsert,
  compileUpdate,
  compileDelete
}; 