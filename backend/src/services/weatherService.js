const BASE_URL = 'https://api.weatherapi.com/v1/forecast.json';
export async function fetchWeatherData(city, days = 3) {
    const url = `${BASE_URL}?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(city)}&days=${days}`;
    const response = await fetch(url);
    const data = await response.json();

    return data;
}
