# Weather App

Search for a city or use your location. Shows current weather and a three-day forecast. You can switch between °C and °F.


## Tech stack

- **Frontend:** React (Vite), plain CSS
- **Backend:** Node.js + Express
- **Weather data:** WeatherAPI.com
- **Database:** MongoDB Atlas (official driver, no ODM)

**Why WeatherAPI.com:** one endpoint returns location, current weather, and forecast together. It also accepts a city name or coordinates in the same parameter. OpenWeatherMap's free plan needs three calls to get the same data, and its One Call 3.0 tier asks for credit card details.

**Why there is a backend:** the API key must not reach the browser. The backend also trims the provider's large response into a small shape, caches results, and stores the recent search list.

**Why MongoDB:** the recent-search list is one document per city with a nested weather snapshot, needs no joins, and expires cached entries on a schedule. A TTL index does that last part with no code, which Postgres cannot do without `pg_cron`. I chose the official driver rather than Mongoose because fewer abstractions means I can explain every line.

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

| Variable | Location | Purpose | Required |
|---|---|---|---|
| `WEATHER_API_KEY` | `backend/.env` | WeatherAPI key. Backend only. | Yes |
| `MONGODB_URI` | `backend/.env` | Atlas connection string. **Contains a password** — as sensitive as the API key. | No |
| `MONGODB_DB` | `backend/.env` | Database name. Defaults to `weather_app`. | No |

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
- Last five searched cities as clickable cards, persisted in MongoDB, each with
  its condition icon, temperature and a menu to remove it

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
| MongoDB unreachable | Connection fails with a 5 second timeout, a warning is logged, and the app runs without the chips or the second cache tier. |
| A database read or write fails | Caught in the repository and logged. Returns `[]`, `false` or nothing rather than throwing. |

## The database layer

Two collections, four indexes, and no ODM.

### `recent_searches`

One document per city, not an append-only log.

```js
{
  query: "london|united kingdom",   // the de-duplication key
  displayName: "London",
  country: "United Kingdom",
  tempC: 21, tempF: 69.8,
  condition: "Sunny",
  icon: "//cdn.weatherapi.com/...",
  times: 3,
  lastSearched: ISODate("..."),
  firstSearched: ISODate("...")
}
```

**De-duplication is a unique index on `query`.** A second search for the same
city updates the existing document rather than inserting — the job an in-memory
hash map would do, except this survives a restart, which is the point of the
feature.

**The key is the resolved place, not the raw query.** `city|country`, lowercased.
Typing "London", clicking an autocomplete suggestion, and using Locate me all
produce different inputs but the same city, so keying on the input stored three
entries for one place. The country is included because there is a London in
Ontario too.

**The write is one `updateOne` with three operators.** `$set` overwrites the
snapshot, `$inc` adds to the search count atomically so two simultaneous
requests cannot lose one, and `$setOnInsert` records the first-ever search only
on creation. Equivalent to `INSERT ... ON CONFLICT DO UPDATE`.

The list is trimmed to five on write rather than filtered on read, so the
collection cannot grow without bound. That costs one find and one delete, and
neither scales with collection size.

### `weather_cache`

The second of three cache tiers.

| Tier | Store | TTL | Survives restart | Shared between processes |
|---|---|---|---|---|
| 1 | In-memory `Map` | 60 s | No | No |
| 2 | MongoDB | 15 min | Yes | Yes |
| 3 | The provider | — | — | — |

A database hit also warms tier 1, or every request after a restart would keep
hitting the database for the same city.

**Expiry is a TTL index** — `{ createdAt: 1 }` with `expireAfterSeconds: 900`.
MongoDB deletes each document itself, with no scheduled job. The read path still
checks the age, because the TTL sweeper runs roughly once a minute and a
document can briefly outlive its TTL.

Both tiers store the **trimmed** response, so a hit skips the network call and
the transform, and uses about a hundredth of the memory.

### Indexes

| Collection | Index | Purpose |
|---|---|---|
| `recent_searches` | `{ query: 1 }` unique | De-duplication |
| `recent_searches` | `{ lastSearched: -1 }` | Newest-first reads without an in-memory sort |
| `weather_cache` | `{ key: 1 }` unique | One entry per city |
| `weather_cache` | `{ createdAt: 1 }` TTL 900s | Automatic expiry |

Created at startup rather than by hand, so a fresh database needs no setup.
`createIndex` is idempotent.

To confirm an index is actually used rather than assumed:

```js
db.recent_searches.find({ query: 'london|united kingdom' }).explain('executionStats')
```

`winningPlan.stage` should read `IXSCAN`, not `COLLSCAN`.

### Failing gracefully

Every repository function starts with `if (!db) return` and catches its own
errors. Recent searches are an enhancement, not a requirement — a failure to
write history must not break the weather request the user actually asked for.

## Not finished

- No automated tests. `weatherMapper.js` is a pure function, so it is the
  obvious first target — no mocking, no server, no network
- Neither cache tier has a size limit. LRU eviction would be the next step
- Recent searches are global rather than per user. That is a `userId` field and
  a compound unique index on `{ userId: 1, query: 1 }`
- The Atlas IP allowlist is `0.0.0.0/0` for development. Production would
  allowlist the server's address only
- No production build or deployment
- No keyboard navigation in the autocomplete

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
