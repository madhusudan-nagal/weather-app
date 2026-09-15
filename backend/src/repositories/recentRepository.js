import { getDb } from '../db.js';

const COLLECTION = 'recent_searches';
const MAX_KEPT = 5;

/**
 * Record a successful search.
 *
 * One document per city, not an append-only log. De-duplication comes from the
 * unique index on `query` (see db.js) - exactly the job an in-memory hash map
 * would do, except this one survives a restart. That persistence is the point:
 * the user should see their last five cities when they come back tomorrow.
 *
 * A snapshot of the conditions is stored alongside so the chips can show an
 * icon and a temperature without a second request. It is deliberately a
 * snapshot rather than live data - `lastSearched` says how old it is.
 *
 * Never throws. Failing to save history must not break the weather request
 * the user actually asked for.
 */
export async function upsertRecent({ query, weather }) {
  const db = getDb();
  if (!db) return;

  // Key on the resolved place, not on what was typed.
  //
  // "London", "london" and the coordinates 51.51,-0.13 all resolve to the
  // same city, so keying on the raw query would store three chips for one
  // place. City plus country, because there is a London in Ontario too.
  const placeKey = `${weather.location.city}|${weather.location.country}`
    .toLowerCase();

  try {
    await db.collection(COLLECTION).updateOne(
      { query: placeKey },
      {
        $set: {
          displayName: weather.location.city,
          country: weather.location.country,
          tempC: weather.current.tempC,
          tempF: weather.current.tempF,
          condition: weather.current.condition,
          icon: weather.current.icon,
          lastSearched: new Date(),
        },
        $inc: { times: 1 },
        $setOnInsert: { firstSearched: new Date() },
      },
      { upsert: true }
    );

    await trim(db);
  } catch (error) {
    console.error('Recent search write failed:', error.message);
  }
}
/**
 * Keep only the newest MAX_KEPT documents.
 *
 * Trimming on write rather than filtering on read means the collection cannot
 * grow without bound. It is one find plus one delete regardless of how many
 * documents exist, because $nin is given at most five ids.
 */
async function trim(db) {
  const keep = await db.collection(COLLECTION)
    .find({}, { projection: { _id: 1 } })
    .sort({ lastSearched: -1 })
    .limit(MAX_KEPT)
    .toArray();

  if (keep.length < MAX_KEPT) return;

  await db.collection(COLLECTION).deleteMany({
    _id: { $nin: keep.map((doc) => doc._id) },
  });
}

/**
 * The kept cities, newest first.
 *
 * SQL equivalent:
 *   SELECT query, display_name, country, temp_c, temp_f, condition, icon,
 *          times, last_searched
 *   FROM recent_searches
 *   ORDER BY last_searched DESC
 *   LIMIT 5;
 *
 * Served by the { lastSearched: -1 } index, so it is an index scan rather
 * than a collection scan followed by an in-memory sort.
 */
export async function listRecent() {
  const db = getDb();
  if (!db) return [];

  try {
    return await db.collection(COLLECTION)
      .find({}, { projection: { _id: 0, firstSearched: 0 } })
      .sort({ lastSearched: -1 })
      .limit(MAX_KEPT)
      .toArray();
  } catch (error) {
    console.error('Recent search read failed:', error.message);
    return [];
  }
}

/** Remove one city. Returns whether anything was actually deleted. */
export async function removeRecent(query) {
  const db = getDb();
  if (!db) return false;

  try {
    const result = await db.collection(COLLECTION)
      .deleteOne({ query: query.toLowerCase() });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Recent search delete failed:', error.message);
    return false;
  }
}

/** Remove everything. Used by the "clear all" action. */
export async function clearRecent() {
  const db = getDb();
  if (!db) return 0;

  try {
    const result = await db.collection(COLLECTION).deleteMany({});
    return result.deletedCount;
  } catch (error) {
    console.error('Recent search clear failed:', error.message);
    return 0;
  }
}