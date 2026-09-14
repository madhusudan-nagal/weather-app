import 'dotenv/config';
import express from 'express';
import { fetchWeatherData } from './services/weatherService.js';
import { mapWeather } from './services/weatherMapper.js';
import { getCached, setCached } from './cache.js';

const app = express();
const PORT = 3001;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/weather', async (req, res) => {
  const city = req.query.city?.trim();

  if (!city) {
    return res.status(400).json({ message: 'Please enter a city name.' });
  }

  const cached = getCached(city.toLowerCase());
  if (cached) return res.json(cached);

  try {
    const raw = await fetchWeatherData(city, 3);
    const shaped = mapWeather(raw);
    setCached(city.toLowerCase(), shaped);
    res.json(shaped);
  } catch (error) {
    if (error.code === 'CITY_NOT_FOUND') {
      return res.status(404).json({ message: `We couldn't find "${city}".` });
    }
    console.error('Weather request failed:', error.message);
    res.status(502).json({ message: 'Weather service is unavailable. Try again shortly.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});