import 'dotenv/config';
import express from 'express';
import { fetchWeatherData } from './services/weatherService.js';

const app  = express();
const port = 3001;
console.log('Key loaded:', Boolean(process.env.WEATHER_API_KEY));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});


app.get('/api/weather', async (req, res) => {
  const city = req.query.city;
  const data = await fetchWeatherData(city, 3);
  res.json(data);
});


app.listen(port,() => {
    console.log(`Backend server is running on port ${port}`)
});

