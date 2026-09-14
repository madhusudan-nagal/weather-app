import { useState } from 'react';

export default function App() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unit, setUnit] = useState('C');  
  const isCelsius = unit === 'C';

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.message);
        setWeather(null);
        return;
      }

      setWeather(data);
    } catch {
      setError('Could not reach the server. Is the backend running?');
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header><h1>Weather</h1></header>

      <form onSubmit={handleSubmit}>
        <label htmlFor="city">City</label>
        <input
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. London"
        />
        <button type="submit">Search</button>
      </form>

      {loading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !weather && <p>Search for a city to see its weather.</p>}

      {weather && !loading && (
        <section>
          <h2>{weather.location.city}, {weather.location.country}</h2>
          <p>{weather.current.tempC}°C — {weather.current.condition}</p>
          <p>Humidity {weather.current.humidity}% · Wind {weather.current.windKph} kph</p>
        </section>
      )}
    </main>
  );
}