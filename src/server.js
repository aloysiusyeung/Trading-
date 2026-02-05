import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { readDb, updateDb } from './store.js';
import { canExecuteSell, calculatePortfolio, STARTING_CASH } from './portfolio.js';
import { getChart, getCompanyProfile, getNews, getQuote } from './market.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static('public'));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'username, email, password(>=6) required' });
  }

  const db = readDb();
  if (db.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    username,
    email,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  updateDb((data) => {
    data.users.push(user);
  });

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '14d' });
  return res.status(201).json({ token, user: { id: user.id, username, email, startingCash: STARTING_CASH } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find((entry) => entry.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email/password' });
  }

  const valid = await bcrypt.compare(password || '', user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email/password' });
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '14d' });
  return res.json({ token, user: { id: user.id, username: user.username, email: user.email, startingCash: STARTING_CASH } });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const db = readDb();
  const user = db.users.find((entry) => entry.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const portfolio = calculatePortfolio(user.id, db.trades);
  return res.json({
    user: { id: user.id, username: user.username, email: user.email },
    portfolio
  });
});

app.get('/api/market/quote', async (req, res) => {
  const symbol = String(req.query.symbol || 'AAPL').toUpperCase();
  try {
    const quote = await getQuote(symbol);
    return res.json(quote);
  } catch (error) {
    return res.status(400).json({ error: `Could not load quote for ${symbol}`, detail: error.message });
  }
});

app.get('/api/market/chart', async (req, res) => {
  const symbol = String(req.query.symbol || 'AAPL').toUpperCase();
  const range = String(req.query.range || '1d');
  const interval = String(req.query.interval || '5m');

  try {
    const chart = await getChart(symbol, range, interval);
    return res.json(chart);
  } catch (error) {
    return res.status(400).json({ error: `Could not load chart for ${symbol}`, detail: error.message });
  }
});

app.get('/api/market/news', async (req, res) => {
  const symbol = String(req.query.symbol || 'AAPL').toUpperCase();
  try {
    const [news, profile] = await Promise.all([getNews(symbol), getCompanyProfile(symbol)]);
    return res.json({ symbol, profile, news });
  } catch (error) {
    return res.status(400).json({ error: `Could not load news/profile for ${symbol}`, detail: error.message });
  }
});

app.post('/api/trades', authMiddleware, async (req, res) => {
  const { symbol, side, quantity } = req.body;
  const normalizedSymbol = String(symbol || '').toUpperCase();
  const normalizedSide = side === 'sell' ? 'sell' : side === 'buy' ? 'buy' : null;
  const qty = Number(quantity);

  if (!normalizedSymbol || !normalizedSide || !Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'symbol, side(buy/sell), quantity>0 required' });
  }

  const db = readDb();
  const portfolio = calculatePortfolio(req.user.userId, db.trades);

  let quote;
  try {
    quote = await getQuote(normalizedSymbol);
  } catch (error) {
    return res.status(400).json({ error: `Could not fetch live price for ${normalizedSymbol}`, detail: error.message });
  }

  const price = Number(quote.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: 'Invalid live price' });
  }

  const orderValue = price * qty;

  if (normalizedSide === 'buy' && portfolio.cash < orderValue) {
    return res.status(400).json({ error: `Insufficient cash. Available: ${portfolio.cash.toFixed(2)}` });
  }

  if (normalizedSide === 'sell' && !canExecuteSell(portfolio, normalizedSymbol, qty)) {
    return res.status(400).json({ error: 'Insufficient shares to sell' });
  }

  const trade = {
    id: nanoid(),
    userId: req.user.userId,
    symbol: normalizedSymbol,
    side: normalizedSide,
    quantity: qty,
    price,
    executedAt: new Date().toISOString()
  };

  updateDb((data) => {
    data.trades.push(trade);
  });

  const updated = calculatePortfolio(req.user.userId, readDb().trades);
  return res.status(201).json({ trade, portfolio: updated });
});

app.get('/api/trades', authMiddleware, (req, res) => {
  const db = readDb();
  const trades = db.trades
    .filter((trade) => trade.userId === req.user.userId)
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
  return res.json(trades);
});

app.get('/api/leaderboard', async (_req, res) => {
  const db = readDb();
  const entries = await Promise.all(
    db.users.map(async (user) => {
      const portfolio = calculatePortfolio(user.id, db.trades);
      const quotes = await Promise.all(
        portfolio.positions.map(async (position) => {
          try {
            const quote = await getQuote(position.symbol);
            return { symbol: position.symbol, price: quote.regularMarketPrice || 0 };
          } catch {
            return { symbol: position.symbol, price: 0 };
          }
        })
      );

      const priceMap = new Map(quotes.map((item) => [item.symbol, Number(item.price || 0)]));
      const positionsValue = portfolio.positions.reduce((sum, position) => {
        return sum + position.quantity * (priceMap.get(position.symbol) || 0);
      }, 0);

      const equity = portfolio.cash + positionsValue;
      return {
        userId: user.id,
        username: user.username,
        cash: Number(portfolio.cash.toFixed(2)),
        positionsValue: Number(positionsValue.toFixed(2)),
        equity: Number(equity.toFixed(2)),
        pnl: Number((equity - STARTING_CASH).toFixed(2))
      };
    })
  );

  entries.sort((a, b) => b.equity - a.equity);
  return res.json(entries);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Trading game server running on http://localhost:${PORT}`);
});
