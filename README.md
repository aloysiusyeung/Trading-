# Trading Game (Paper Trading + Leaderboard)

A multi-user paper-trading game inspired by TradingView paper trading:

- Every new user starts with **$100,000** virtual cash.
- Login/register accounts with persisted trade history.
- Place buy/sell paper trades against live market quotes.
- View a real-time leaderboard across all players.
- Embedded TradingView chart for any symbol.
- Company profile + latest news.

## Tech stack

- Node.js + Express backend
- File-based JSON storage (`data/db.json`)
- Yahoo Finance market data via `yahoo-finance2`
- TradingView chart widget on frontend
- Vanilla JS + Tailwind CSS (CDN)

## Run locally

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`.

## API overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/trades`
- `POST /api/trades`
- `GET /api/leaderboard`
- `GET /api/market/quote?symbol=AAPL`
- `GET /api/market/chart?symbol=AAPL&range=1d&interval=5m`
- `GET /api/market/news?symbol=AAPL`

## Notes

- This is paper trading only; no real brokerage integration.
- Market data and news are fetched from Yahoo Finance APIs through `yahoo-finance2`.
- TradingView is used for chart visualization.
