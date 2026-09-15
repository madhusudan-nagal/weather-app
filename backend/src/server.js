import 'dotenv/config';
import express from 'express';
import { fetchWeatherData, searchCities } from './services/weatherService.js';
import { mapWeather } from './services/weatherMapper.js';
import { getCached, setCached } from './cache.js';
import { connectDb, closeDb } from './db.js';
import { getCachedFromDb, setCachedInDb } from './repositories/cacheRepository.js';
import {
  upsertRecent,
  listRecent,
  removeRecent,
  clearRecent,
} from './repositories/recentRepository.js';

const app = express();
const PORT = 3001;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/cities', async (req, res) => {
  const q = req.query.q?.trim();

  if (!q || q.length < 3) {
    return res.json([]);
  }

  const results = await searchCities(q);

  res.json(
    results.slice(0, 5).map((city) => ({
      id: city.id,
      name: city.name,
      region: city.region,
      country: city.country,
    }))
  );
});

app.get('/api/weather', async (req, res) => {
  const city = req.query.city?.trim();

  if (!city) {
    return res.status(400).json({ message: 'Please enter a city name.' });
  }

  const key = city.toLowerCase();

  // Tier 1: in-memory. Microseconds, but per-process and lost on restart.
  const memoryHit = getCached(key);
  if (memoryHit) {
    await upsertRecent({ query: key, weather: memoryHit });
    return res.json(memoryHit);
  }

  // Tier 2: database. Milliseconds, but survives a restart and would be
  // shared across several server instances behind a load balancer.
  const dbHit = await getCachedFromDb(key);
  if (dbHit) {
    setCached(key, dbHit); // warm tier 1 so the next hit is instant
    await upsertRecent({ query: key, weather: dbHit });
    return res.json(dbHit);
  }

  // Tier 3: the provider.
  try {
    const raw = await fetchWeatherData(city, 3);
    const shaped = mapWeather(raw);

    setCached(key, shaped);
    setCachedInDb(key, shaped);                    // not awaited
    await upsertRecent({ query: key, weather: shaped }); // not awaited

    res.json(shaped);
  } catch (error) {
    if (error.code === 'CITY_NOT_FOUND') {
      return res.status(404).json({
        message: `We couldn't find "${city}". Check the spelling and try again.`,
      });
    }

    console.error('Weather request failed:', error.message);
    res.status(502).json({
      message: 'Weather service is unavailable right now. Please try again shortly.',
    });
  }
});

// ── Recent searches ──────────────────────────────────────────────────────────

app.get('/api/recent', async (req, res) => {
  res.json(await listRecent());
});

// DELETE rather than GET, because this changes state. The HTTP method should
// say what the request does - a GET is expected to be safe and repeatable.
app.delete('/api/recent/:query', async (req, res) => {
  const removed = await removeRecent(req.params.query);

  if (!removed) {
    return res.status(404).json({ message: 'Not in recent searches.' });
  }

  // 204 No Content: it worked and there is nothing to send back.
  res.status(204).end();
});

app.delete('/api/recent', async (req, res) => {
  await clearRecent();
  res.status(204).end();
});

// ── Startup ──────────────────────────────────────────────────────────────────

/**
 * Connect the database before accepting traffic, so the first request does not
 * race the connection. If it fails the server still starts - recent searches
 * are an enhancement, not a requirement.
 */
async function start() {
  await connectDb();

  const server = app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });

  // Release the connection pool on Ctrl+C rather than leaving Atlas to time
  // the sockets out.
  const shutdown = async () => {
    server.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();