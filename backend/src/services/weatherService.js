const BASE_URL = 'https://api.weatherapi.com/v1/forecast.json';

export async function fetchWeatherData(city, days = 3) {
  const url = `${BASE_URL}?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(city)}&days=${days}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (response.status === 400) {
      const err = new Error('City not found');
      err.code = 'CITY_NOT_FOUND';
      throw err;
    }
    if (!response.ok) {
      const err = new Error('Weather provider failed');
      err.code = 'PROVIDER_ERROR';
      throw err;
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('Weather provider timed out');
      err.code = 'PROVIDER_ERROR';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}