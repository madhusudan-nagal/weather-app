import { useState } from 'react';
import './App.css';

function errorTitle(status) {
  if (status === 400) return 'Bad Request';
  if (status === 404) return 'Not Found';
  if (status === 502) return 'Service Unavailable';
  return 'Something Went Wrong';
}

export default function App() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unit, setUnit] = useState('C');

  const isCelsius = unit === 'C';

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Your browser does not support location.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
    });
  }

  async function loadWeather(query) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        setError({ status: response.status, message: data.message });
        setWeather(null);
        return null;
      }

      setWeather(data);
      return data;
    } catch {
      setError({ status: null, message: 'Could not reach the server. Is the backend running?' });
      setWeather(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await loadWeather(city);
  }

  async function handleUseLocation() {
    setError(null);

    let position;
    try {
      position = await getPosition();
    } catch (err) {
      let message;
      if (err.code === 1) message = 'Location permission denied. Try searching by city instead.';
      else if (err.code === 2) message = 'Your position is unavailable right now.';
      else if (err.code === 3) message = 'Finding your location took too long.';
      else message = err.message || 'Could not get your location.';

      setError({ status: null, message });
      setWeather(null);
      return;
    }

    const { latitude, longitude } = position.coords;
    const data = await loadWeather(`${latitude},${longitude}`);
    if (data) setCity(data.location.city);
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
        <button type="button" onClick={handleUseLocation}>Use my location</button>

        <button
          type="button"
          role="switch"
          aria-checked={!isCelsius}
          aria-label="Temperature unit"
          className={isCelsius ? 'switch' : 'switch on'}
          onClick={() => setUnit(isCelsius ? 'F' : 'C')}
        >
          <span className="switch-label">°C</span>
          <span className="switch-label">°F</span>
          <span className="switch-knob" />
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Fetching weather…</p>
        </div>
      )}

      {error && !loading && (
        <section className="error-state" role="alert">
          {error.status && <p className="error-code">{error.status}</p>}
          <h2 className="error-title">{errorTitle(error.status)}</h2>
          <p className="error-message">{error.message}</p>
        </section>
      )}

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