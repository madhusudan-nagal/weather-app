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
    <main className="app">
      <header>
        <h1>Weather</h1>
      </header>

      <form onSubmit={handleSubmit}>
        <label htmlFor="city">City</label>
        <input
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. London"
        />
        <button type="submit">Search</button>
        <button type="button" onClick={() => setUnit(isCelsius ? 'F' : 'C')}>
          Show °{isCelsius ? 'F' : 'C'}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Fetching weather…</p>
        </div>
      )}

      {error && !loading && <p className="error" role="alert">{error}</p>}

      {!loading && !error && !weather && (
        <p className="empty">Search for a city to see its weather.</p>
      )}

      {weather && !loading && (
        <div className="results">
          <section className="current">
            <h2>{weather.location.city}, {weather.location.country}</h2>
            <div className="temp-row">
              <img src={`https:${weather.current.icon}`} alt={weather.current.condition} />
              <span className="temp">
                {isCelsius ? weather.current.tempC : weather.current.tempF}°{unit}
              </span>
            </div>
            <p>{weather.current.condition}</p>
            <p className="meta">
              Humidity {weather.current.humidity}% · Wind {weather.current.windKph} kph
            </p>
          </section>

          <section className="forecast">
            {weather.forecast.map((day) => (
              <article key={day.date} className="forecast-card">
                <img src={`https:${day.icon}`} alt={day.condition} />
                <h3>{day.date}</h3>
                <p className="range">
                  {isCelsius ? day.maxTempC : day.maxTempF}° / {isCelsius ? day.minTempC : day.minTempF}°
                </p>
                <p>{day.condition}</p>
              </article>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}