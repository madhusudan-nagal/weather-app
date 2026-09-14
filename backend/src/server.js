import 'dotenv/config';
import express from 'express';
import { fetchWeatherData, searchCities } from './services/weatherService.js';
import { mapWeather } from './services/weatherMapper.js';
import { getCached, setCached } from './cache.js';


const app = express();
const PORT = 3001;


//pulling in the city search results from the cities.json file
app.get('/api/cities', async (req, res) => {
const q = req.query.q?.trim();


  if (!q || q.length < 3) {
    return res.json([]);
  }
const results = await searchCities(q);

  res.json(
    results.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      region: c.region,
      country: c.country,
    }))
  );
});


//starting the health check endpoint and the weather endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

//weather endpoint that fetches weather data for a given city
app.get('/api/weather', async (req, res) => {
  const city = req.query.city?.trim();


//checking if the city parameter is provided, if not return a 400 error
 if (!city) {
  return res.status(400).json({ message: 'Please enter a city name.' });
}

  const cached = getCached(city.toLowerCase());
  if (cached) return res.json(cached);

  //fetching weather data from the weather service and mapping it to the desired format, caching the result, and returning it as a JSON response
  try {
    const raw = await fetchWeatherData(city, 3);
    const shaped = mapWeather(raw);
    setCached(city.toLowerCase(), shaped);
    res.json(shaped);
  } catch (error) {
    if (error.code === 'CITY_NOT_FOUND') {
  return res.status(404).json({
    message: `We couldn't find "${city}". Check the spelling and try again.`
  });
}
    console.error('Weather request failed:', error.message);
    res.status(502).json({
  message: 'Weather service is unavailable right now. Please try again shortly.'
});
  }
});

//starting the server and listening on the specified port
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});