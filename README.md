# VesperDB

A flexible, portable, and easy-to-use SQL query builder for Node.js

## Features

- Support for multiple SQL dialects (PostgreSQL, MySQL, SQLite, MSSQL, Oracle)
- Fluent API for query building
- Transactions
- Connection pooling
- Promise API
- Schema building and migrations
- Raw queries

## New Features

### Schema Validation
VesperDB now includes a robust schema validation system that allows you to validate your data before inserting or updating it in the database

```javascript
// Define a validation schema
const userSchema = db.Schema.create({
  type: db.Schema.TYPES.OBJECT,
  properties: {
    id: { type: db.Schema.TYPES.UUID, required: true },
    name: { type: db.Schema.TYPES.STRING, minLength: 2 },
    email: { type: db.Schema.TYPES.EMAIL, required: true }
  }
});

// Validate data with the schema
const result = userSchema.validate(data);
if (result.valid) {
  // Data is valid
} else {
  // Handle errors
  console.error(result.errors);
}

// Use validation in queries
await db('users')
  .insert(data)
  .validateSchema(userSchema)
  .run();
```

### Advanced JSON Operations
VesperDB now offers advanced support for JSON operations, particularly useful with PostgreSQL and its JSONB type.

```javascript
// Get a value from a JSON field
const result = await db.json.get('products', 'details', 'brand', { id: 1 });

// Set a value at a JSON path
await db.json.set('products', 'details', 'specifications.ram', '16GB', { id: 1 });

// Check if a value exists
const exists = await db.json.exists('products', 'details', 'specifications.storage', { id: 1 });

// Add a value to a JSON array
await db.json.append('products', 'details', 'colors', 'red', { id: 1 });

// Merge JSON objects
await db.json.merge('products', 'details', { price: 999, available: true }, { id: 1 });

// Remove a key
await db.json.remove('products', 'details', 'oldField', { id: 1 });

// Search for objects containing a value
const products = await db.json.contains('products', 'details', 'red', 'colors').select().run();
```

### Intelligent Query Cache
VesperDB integrates a caching system that significantly improves the performance of repeated queries

```javascript
// Enable cache during initialization
const db = VesperDB({
  client: 'pg',
  connection: { /* ... */ },
  cache: {
    enabled: true,
    options: {
      max: 500,     // Maximum number of cache entries
      ttl: 60000    // Time to live in milliseconds (1 minute)
    }
  }
});

// SELECT queries are automatically cached
const users = await db('users').select().where('active', true).run();

// Cache is automatically invalidated when data changes
await db('users').update({ active: false }).where('id', 1).run();

// Cache statistics
const stats = db.cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);

// Manually clear the cache
db.cache.clear();

// Invalidate specific entries
db.cache.invalidateByTables(['users']);
```

## Installation

```bash
npm install vesperdb
```

## Basic Usage

```javascript
const vesperDB = require('vesperdb');

// Initialize the connection
const db = vesperDB({
  client: 'pg', // or 'mysql', 'sqlite', 'mssql', 'oracle'
  connection: {
    host: 'localhost',
    user: 'username',
    password: 'password',
    database: 'mydatabase'
  }
});

// SELECT
async function getUsers() {
  return await db('users')
    .select('id', 'name', 'email')
    .where('active', true)
    .orderBy('name', 'asc');
}

// INSERT
async function createUser(user) {
  return await db('users').insert(user);
}

// UPDATE
async function updateUser(id, data) {
  return await db('users')
    .where('id', id)
    .update(data);
}

// DELETE
async function deleteUser(id) {
  return await db('users')
    .where('id', id)
    .delete();
}

// JOIN
async function getPostsWithAuthors() {
  return await db('posts')
    .join('users', 'posts.user_id', '=', 'users.id')
    .select(
      'posts.id',
      'posts.title',
      'users.name as author'
    );
}
```

## Schema and Migrations

```javascript
// Create a table
await db.schema.createTable('users', (table) => {
  table.increments('id');
  table.string('name', 100).notNullable();
  table.string('email', 100).notNullable();
  table.integer('age');
  table.boolean('active').defaultTo(true);
  table.timestamp('created_at').defaultTo(new Date());
  
  // Add indexes
  table.unique('email');
  table.index('name');
});

// Modify a table
await db.schema.alterTable('users', (table) => {
  table.string('phone', 20);
});

// Drop a table
await db.schema.dropTable('users');
```

## Transactions

```javascript
await db.transaction(async (trx) => {
  // All queries use the same transaction
  const userId = await trx('users').insert({
    name: 'John Doe',
    email: 'john@example.com'
  });
  
  await trx('profiles').insert({
    user_id: userId,
    bio: 'My biography...'
  });
  
  // The transaction is automatically committed if no error is thrown
  // In case of error, a rollback is performed
});
```

## Query Building API

### SELECT

```javascript
// SELECT * FROM users
db('users');

// SELECT name, email FROM users
db('users').select('name', 'email');

// SELECT * FROM users WHERE id = 1
db('users').where('id', 1);

// SELECT * FROM users WHERE id = 1 AND active = true
db('users').where('id', 1).where('active', true);

// SELECT * FROM users WHERE id = 1 OR id = 2
db('users').where('id', 1).orWhere('id', 2);

// SELECT * FROM users LIMIT 10 OFFSET 20
db('users').limit(10).offset(20);

// SELECT * FROM users ORDER BY name ASC, age DESC
db('users').orderBy('name', 'asc').orderBy('age', 'desc');
```

### INSERT

```javascript
// INSERT INTO users (name, email) VALUES ('John', 'john@example.com')
db('users').insert({
  name: 'John',
  email: 'john@example.com'
});

// Multiple insertion
db('users').insert([
  { name: 'John', email: 'john@example.com' },
  { name: 'Mary', email: 'mary@example.com' }
]);
```

### UPDATE

```javascript
// UPDATE users SET email = 'new@example.com' WHERE id = 1
db('users')
  .where('id', 1)
  .update({ email: 'new@example.com' });
```

### DELETE

```javascript
// DELETE FROM users WHERE id = 1
db('users')
  .where('id', 1)
  .delete();
```

### JOIN

```javascript
// INNER JOIN
db('posts')
  .join('users', 'posts.user_id', 'users.id')
  .select('posts.*', 'users.name');

// LEFT JOIN
db('posts')
  .leftJoin('comments', 'posts.id', 'comments.post_id')
  .select('posts.*', 'comments.content');
```

## Column Types

VesperDB supports several column types for schema definition:

- `table.increments('id')` - INTEGER AUTO_INCREMENT
- `table.integer('age')` - INTEGER
- `table.text('description')` - TEXT
- `table.string('name', 100)` - VARCHAR(100)
- `table.float('score')` - FLOAT
- `table.decimal('price', 8, 2)` - DECIMAL(8,2)
- `table.boolean('active')` - BOOLEAN
- `table.date('birth_date')` - DATE
- `table.datetime('appointment')` - DATETIME/TIMESTAMP
- `table.timestamp('created_at')` - TIMESTAMP