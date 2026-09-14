# Weather App

Search for a city or use your location. Shows current weather and a three-day forecast. You can switch between °C and °F.


## Tech stack

- **Frontend:** React (Vite), plain CSS
- **Backend:** Node.js + Express
- **Weather data:** WeatherAPI.com

**Why WeatherAPI.com:** one endpoint returns location, current weather, and forecast together. It also accepts a city name or coordinates in the same parameter. OpenWeatherMap's free plan needs three calls to get the same data, and its One Call 3.0 tier asks for credit card details.

**Why there is a backend:** the API key must not reach the browser. The backend also trims the provider's large response into a small shape, and caches results for 60 seconds.

## Setup

You need Node.js 18 or newer.

```bash
git clone <your-repo-url> eg : gitHub.com/user/repo/
cd weather-app
```

**Backend:**

```bash
cd backend
npm install
cp .env.example .env
node --watch src/server.js
```

Get a free key at weatherapi.com and put it in `backend/.env`:

```
WEATHER_API_KEY=your_key_here
```

**Frontend**, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite sends `/api` requests to the backend on port 3001.

## Environment variables

| Variable | Location | Purpose |
|---|---|---|
| `WEATHER_API_KEY` | `backend/.env` | WeatherAPI key. Backend only. |

`.env` is in `.gitignore` and is never committed. `.env.example` is committed. It has the variable name but no value.

## Features

- City search using a form with a label and a submit button
- Current weather: temperature, condition, humidity, wind speed
- Three-day forecast, laid out with CSS Grid
- "Use my location" button, using the Geolocation API 
- °C / °F toggle
- Four UI states: empty, loading, success, error
- Loading spinner, fade-in animation, hover effects
- Responsive layout for small screens

## API

`GET /api/weather?city=<name or lat,lon>`

| Status | When |
|---|---|
| 200 | Success |
| 400 | City is missing or empty |
| 404 | City was not found |
| 502 | Provider failed or timed out |

Every error returns JSON with a `message` field. The frontend shows that message on screen.

## Failure cases

| Problem | How it is handled |
|---|---|
| Empty city | Checked before calling the provider. Returns 400. |
| City not found | Provider returns 400. Backend turns it into a 404. |
| Provider down or bad key | Returns 502. The real reason is only logged on the server. |
| Provider too slow | `AbortController` cancels the request after 5 seconds. |
| Backend not running | `fetch` fails. Frontend shows a network error. |
| Location denied, unavailable, or timed out | Each geolocation error code gets its own message. |
| Browser has no geolocation | Checked before calling. |

## Not finished

- No automated tests
- Forecast dates show as `2026-09-14` instead of day names
- Cache entries expire when read, but unused keys are never removed
- No production build or deployment

## AI usage

I used AI (Claude) as a teacher, debugger, and code reviewer. Not as the builder. The pattern was: it explains the concept, I write the code, I run it, I test it, I commit it.

It checked the current free tiers of both providers, explained React state and derived values, gave hints instead of fixes when I was stuck, and pushed back when a design decision was wrong.

## What I found hard

**JavaScript.** I had not written much plain JS for a while, so the start was slow. Async took the most thinking. The main thing I learned is that `fetch` does not fail on a 404 or a 500. It succeeds, and you have to check `response.ok` yourself. It only fails on a network error. That is why the error handling has two separate paths.

**React.** State was the part I had to sit with. Not the syntax, but the idea: `setSomething(...)` does not just change a variable. It tells React the component is out of date, and React re-renders it. The °C / °F toggle is where this became clear. My first idea was to store the shown temperature in state. That is wrong, because then there are two sources of truth that can go out of sync. The temperature is derived: if you know `unit` and `weather`, you can calculate it. So it is calculated during render instead of stored.

**CSS.** This was the area I knew least. It took a few tries to see when Grid is right and when Flexbox is right. Flexbox is for one direction, like the search form row. Grid is for two directions, like the forecast cards. `position: absolute` also confused me until I understood that it positions against the nearest *positioned* parent. That is why each forecast card needs `position: relative`, so the icon sits in the corner of the card and not the corner of the page.

**The hardest single problem was a Git mistake.** I wrote `.gitignore` before the first commit so that `node_modules/` and `.env` would never go into history. But when I committed the backend, Git added around 3,000 `node_modules` files anyway.

The file existed and had the right name, so the cause was not obvious. `ls -la` showed the answer: the file was 4 bytes. The editor had never saved the content, so Git had no rules to follow.

I fixed it by writing the file again with `printf` in the terminal, checking the size with `wc -c`, then running `git reset --mixed HEAD~1`. That removes the commit but leaves all the files on disk.

This mattered because `.gitignore` only works on files Git is not already tracking. If you commit a secret and then ignore it, the secret stays in the history. Nothing had been pushed yet, so this took five minutes. Ten commits later it would have taken much longer.
