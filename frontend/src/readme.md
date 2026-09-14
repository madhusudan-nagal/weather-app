# Weather App

Search for a city or use your current location to see current weather and a three-day forecast. Toggle between °C and °F.

## Tech stack

- **Frontend:** React (Vite), plain CSS
- **Backend:** Node.js + Express
- **Weather data:** WeatherAPI.com

**Why WeatherAPI.com:** one endpoint returns location, current conditions, and forecast together, and accepts either a city name or coordinates. OpenWeatherMap's free plan needs separate calls for current and forecast plus a geocoding call, and its One Call 3.0 tier requires credit card details.

**Why a backend at all:** the API key must never reach the browser. The backend also reshapes the provider's ~3,000-line response into a small, clean shape and caches results for 60 seconds.

## Setup

Requires Node.js 18+.

```bash
git clone <your-repo-url>
cd weather-app
```

**Backend:**

```bash
cd backend
npm install
cp .env.example .env
node --watch src/server.js
```

Get a free key at weatherapi.com and add it to `backend/.env`:

```
WEATHER_API_KEY=your_key_here
```

**Frontend**, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` requests to the backend on port 3001.

## Environment variables

| Variable | Location | Purpose |
|---|---|---|
| `WEATHER_API_KEY` | `backend/.env` | WeatherAPI key, server-side only |

`.env` is gitignored and never committed. `.env.example` is committed with the variable name and no value.

## Features

- City search with a semantic, accessible form
- Current weather: temperature, condition, humidity, wind speed
- Three-day forecast laid out with CSS Grid
- "Use my location" via the browser Geolocation API
- °C / °F toggle
- Four UI states: empty, loading, success, error
- Loading spinner, fade-in animation, hover transitions
- Responsive layout

## API

`GET /api/weather?city=<name|lat,lon>`

| Status | When |
|---|---|
| 200 | Success |
| 400 | City missing or empty |
| 404 | City not recognised |
| 502 | Provider failed or timed out |

All errors return JSON with a `message` field, which the frontend displays directly.

## Failure cases

| Problem | Handling |
|---|---|
| Empty or whitespace city | Validated before any provider call → 400 |
| City not found | Provider returns 400; mapped to a 404 |
| Provider down or bad key | 502. Real cause logged server-side only |
| Provider hanging | `AbortController` with a 5 second timeout |
| Backend not running | `fetch` rejects; frontend shows a network error |
| Location denied / unavailable / timeout | Each geolocation error code gets its own message |
| No geolocation support | Feature-checked before calling |

## Not finished

- No automated tests
- Forecast dates show as ISO strings rather than day names
- Cache entries expire on read but unused keys are never evicted
- No production build or deployment

## AI usage

AI (Claude) was used as a teacher, debugger, and code reviewer, not as the builder. The pattern was: explain the concept, I write the code, I run it, I test it, I commit it. It checked current provider free tiers, explained React state and derived values, gave hints rather than fixes when debugging, and pushed back when a design decision was wrong.

## Hardest part

A Git mistake. `.gitignore` was written before the first commit so `node_modules/` and `.env` would never enter history, but committing the backend swallowed ~3,000 `node_modules` files anyway.

The file existed with the correct name, so the cause wasn't obvious. `ls -la` gave it away: 4 bytes. The editor had never written the contents to disk, so Git had no rules to apply.

Fixed by rewriting the file with `printf` from the terminal, verifying with `wc -c`, then `git reset --mixed HEAD~1` to drop the commit while leaving all files on disk.

It mattered because `.gitignore` only governs files Git isn't already tracking — ignoring a secret after committing it does nothing, since the value stays in history. Nothing had been pushed, so this cost five minutes instead of an afternoon.