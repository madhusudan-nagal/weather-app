import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Connect once at startup and keep the client for the life of the process.
 *
 * The driver maintains a connection pool internally, so one shared client is
 * correct. Creating a client per request would open and tear down TCP
 * connections constantly - the same mistake as new-ing a pg Pool inside a
 * route handler.
 */
export async function connectDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('MONGODB_URI not set - search history disabled');
    return null;
  }

  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    await client.connect();
    db = client.db(process.env.MONGODB_DB || 'weather_app');
    await createIndexes();

    console.log('MongoDB connected');
    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    db = null;
    return null;
  }
}

/**
 * Indexes are created at startup rather than by hand, so a fresh database
 * needs no setup. createIndex is idempotent - calling it on an existing
 * index does nothing.
 */
async function createIndexes() {
  // recent_searches: one document per city, not an append-only log.
  //
  // The unique index on `query` IS the de-duplication - a second search for
  // the same city updates the existing document instead of inserting a new
  // one. That is the job an in-memory hash map would do, except this one
  // survives a restart, which is the whole point of the feature.
  await db.collection('recent_searches').createIndex({ query: 1 }, { unique: true });
  await db.collection('recent_searches').createIndex({ lastSearched: -1 });

  // weather_cache: the TTL index makes MongoDB delete each document 15
  // minutes after createdAt, with no code and no scheduled job. Postgres has
  // no equivalent without pg_cron.
  await db.collection('weather_cache').createIndex({ key: 1 }, { unique: true });
  await db.collection('weather_cache').createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 900 }
  );
}

/** Returns null when unavailable, so the app still works without a database. */
export function getDb() {
  return db;
}

export async function closeDb() {
  await client?.close();
  client = null;
  db = null;
}