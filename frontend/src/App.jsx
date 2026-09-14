import { useState, useEffect } from 'react';
import './App.css';

function errorTitle(status) {
  if (status === 400) return 'Bad Request';
  if (status === 404) return 'Not Found';
  if (status === 502) return 'Service Unavailable';
  return 'Something Went Wrong';
}

function dayLabel(dateString) {
  return new Date(dateString).toLocaleDateString('en-GB', { weekday: 'short' });
}

export default function App() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unit, setUnit] = useState('C');
  const [selectedDay, setSelectedDay] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isCelsius = unit === 'C';
  const activeDay = weather?.forecast?.[selectedDay];

  useEffect(() => {
    if (city.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(city)}`);
        if (!response.ok) return;
        setSuggestions(await response.json());
      } catch {
        setSuggestions([]);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [city]);

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
    setShowSuggestions(false);

    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        setError({ status: response.status, message: data.message });
        setWeather(null);
        return null;
      }

      setWeather(data);
      setSelectedDay(0);
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
    setShowSuggestions(false);

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

        <div className="search-wrap">
          <input
            id="city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="e.g. London"
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions && suggestions.length > 0}
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul className="suggestions" role="listbox">
              {suggestions.map((s) => (
                <li key={s.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => {
                      setCity(s.name);
                      setShowSuggestions(false);
                      loadWeather(s.name);
                    }}
                  >
                    <strong>{s.name}</strong>
                    <span>{s.region ? `${s.region}, ` : ''}{s.country}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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

            <div className="current-details">
              <div>
                <span>Humidity</span>
                <strong>{weather.current.humidity}%</strong>
              </div>
              <div>
                <span>Wind</span>
                <strong>{weather.current.windKph} kph</strong>
              </div>
              <div>
                <span>Feels like</span>
                <strong>
                  {isCelsius ? weather.current.feelsLikeC : weather.current.feelsLikeF}°
                </strong>
              </div>
              <div>
                <span>Local time</span>
                <strong>{weather.location.localTime.slice(11, 16)}</strong>
              </div>
            </div>
          </section>

          <section className="day-tabs" aria-label="Choose a day">
            {weather.forecast.map((day, index) => (
              <button
                key={day.date}
                type="button"
                className={index === selectedDay ? 'day-tab active' : 'day-tab'}
                onClick={() => setSelectedDay(index)}
              >
                {index === 0 ? 'Today' : dayLabel(day.date)}
              </button>
            ))}
          </section>

          {activeDay && (
            <section className="hourly" aria-label="Hourly forecast">
              {activeDay.hours.map((hour) => (
                <article key={hour.time} className="hour-card">
                  <p className="hour-time">{hour.time.slice(11, 16)}</p>
                  <img src={`https:${hour.icon}`} alt={hour.condition} />
                  <p className="hour-temp">{isCelsius ? hour.tempC : hour.tempF}°</p>
                </article>
              ))}
            </section>
          )}
        </div>
      )}
    </main>
  );
}