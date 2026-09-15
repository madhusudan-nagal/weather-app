import { getDb } from '../db.js';

/**
 * Database-backed cache - the second tier behind the in-memory Map.
 *
 * Expiry is handled by the TTL index in db.js, so there is no cleanup code
 * here. The read still checks age because the TTL sweeper runs roughly once
 * a minute, so a document can briefly outlive its TTL.
 */
const MAX_AGE_MS = 900_000; // 15 minutes, matching expireAfterSeconds

export async function getCachedFromDb(key) {
  const db = getDb();
  if (!db) return null;

  try {
    const doc = await db.collection('weather_cache').findOne({ key });
    if (!doc) return null;
    if (Date.now() - doc.createdAt.getTime() > MAX_AGE_MS) return null;
    return doc.payload;
  } catch (error) {
    console.error('Cache read failed:', error.message);
    return null;
  }
}

export async function setCachedInDb(key, payload) {
  const db = getDb();
  if (!db) return;

  try {
    // upsert: insert if new, replace if the key exists. Equivalent to
    // INSERT ... ON CONFLICT (key) DO UPDATE in Postgres.
    await db.collection('weather_cache').updateOne(
      { key },
      { $set: { key, payload, createdAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    console.error('Cache write failed:', error.message);
  }
}