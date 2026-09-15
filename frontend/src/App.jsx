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

/** "2 min ago", "3 h ago", "yesterday" - how stale the chip snapshot is. */
function timeAgo(isoString) {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
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
  const [recent, setRecent] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);

  const isCelsius = unit === 'C';
  const activeDay = weather?.forecast?.[selectedDay];
  const canSuggest = city.trim().length >= 3;

  // Debounced autocomplete. The cleanup cancels the previous timer, so typing
  // "london" fires one request instead of six.
  useEffect(() => {
    if (!canSuggest) return;

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
  }, [city, canSuggest]);

  // Recent searches exist before the user does anything, so this genuinely is
  // a "sync with the server" job rather than a response to an event.
  useEffect(() => {
    loadRecent();
  }, []);

  // Close the chip menu on an outside click or Escape.
  //
  // The cleanup is what matters here: without it every open would leave a
  // listener attached that never gets removed - a real leak, and the same
  // mechanism as the debounce above.
  useEffect(() => {
    if (!openMenu) return;

    const onDown = (event) => {
      if (!event.target.closest('.chip-menu, .chip-more')) setOpenMenu(null);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  async function loadRecent() {
    try {
      const response = await fetch('/api/recent');
      if (!response.ok) return;
      setRecent(await response.json());
    } catch {
      // History is an enhancement. If it fails, the app carries on without it.
    }
  }

  async function removeRecent(query) {
    // Optimistic update: drop it from the UI immediately, then tell the
    // server. A delete is very unlikely to fail, and waiting for a round trip
    // before the chip disappears feels broken.
    setRecent((list) => list.filter((item) => item.query !== query));
    setOpenMenu(null);

    try {
      await fetch(`/api/recent/${encodeURIComponent(query)}`, { method: 'DELETE' });
    } catch {
      loadRecent(); // failed, so put the real list back
    }
  }

  async function clearAllRecent() {
    setRecent([]);
    setOpenMenu(null);

    try {
      await fetch('/api/recent', { method: 'DELETE' });
    } catch {
      loadRecent();
    }
  }

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
    setOpenMenu(null);

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
      loadRecent(); // the history just changed; nothing waits on this
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

          {showSuggestions && canSuggest && suggestions.length > 0 && (
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

      {recent.length > 0 && (
        <nav className="recent" aria-label="Recent searches">
          <span className="recent-label">Recent</span>

          <ul>
            {recent.map((item) => (
              <li key={item.query}>
                {/* A container, not a button - a button cannot legally contain
                    another button, so the chip body and the menu trigger are
                    siblings inside a div. */}
                <div className={openMenu === item.query ? 'chip menu-open' : 'chip'}>
                  <button
                    type="button"
                    className="chip-body"
                    onClick={() => {
                      setCity(item.displayName);
                      loadWeather(item.displayName);
                    }}
                  >
                    <img src={`https:${item.icon}`} alt="" className="chip-icon" />

                    <span className="chip-text">
                      <span className="chip-name">{item.displayName}</span>
                      <span className="chip-meta">{timeAgo(item.lastSearched)}</span>
                    </span>

                    <span className="chip-temp">
                      {Math.round(isCelsius ? item.tempC : item.tempF)}°
                    </span>
                  </button>

                  <button
                    type="button"
                    className="chip-more"
                    aria-label={`Options for ${item.displayName}`}
                    aria-expanded={openMenu === item.query}
                    onClick={() =>
                      setOpenMenu((open) => (open === item.query ? null : item.query))
                    }
                  >
                    <span aria-hidden="true">⋮</span>
                  </button>

                  {openMenu === item.query && (
                    <div className="chip-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => removeRecent(item.query)}
                      >
                        Remove location
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={clearAllRecent}
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </nav>
      )}

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