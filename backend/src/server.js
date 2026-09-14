import 'dotenv/config';
import express from 'express';

const app  = express();
const port = 3001;
console.log('Key loaded:', Boolean(process.env.WEATHER_API_KEY));


app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});


app.listen(port,() => {
    console.log(`Backend server is running on port ${port}`)
});

