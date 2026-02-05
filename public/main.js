const state = {
  token: localStorage.getItem('token'),
  user: null,
  symbol: 'AAPL',
  portfolio: null,
  leaderboard: []
};

const statusEl = document.getElementById('status');
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const logoutBtn = document.getElementById('logoutBtn');

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function setStatus(message) {
  statusEl.textContent = message;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderTradingView(symbol) {
  document.getElementById('tvChart').innerHTML = '';
  // eslint-disable-next-line no-new
  new TradingView.widget({
    autosize: true,
    symbol,
    interval: '15',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    container_id: 'tvChart'
  });
}

function renderTrades(trades) {
  const table = document.getElementById('tradesTable');
  if (!trades.length) {
    table.innerHTML = '<p class="text-slate-400">No trades yet.</p>';
    return;
  }

  const rows = trades
    .map(
      (trade) => `<tr class="border-b border-slate-800">
        <td class="p-2">${new Date(trade.executedAt).toLocaleString()}</td>
        <td class="p-2 uppercase">${trade.side}</td>
        <td class="p-2">${trade.symbol}</td>
        <td class="p-2">${trade.quantity}</td>
        <td class="p-2">${formatCurrency(trade.price)}</td>
      </tr>`
    )
    .join('');

  table.innerHTML = `<table class="w-full text-sm"><thead><tr class="text-left border-b border-slate-700"><th class="p-2">Time</th><th class="p-2">Side</th><th class="p-2">Symbol</th><th class="p-2">Qty</th><th class="p-2">Price</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboard');
  if (!state.leaderboard.length) {
    container.innerHTML = '<p class="text-slate-400">No players yet.</p>';
    return;
  }

  container.innerHTML = state.leaderboard
    .map(
      (entry, index) => `<div class="flex justify-between border-b border-slate-800 py-1">
      <span>${index + 1}. ${entry.username}</span>
      <span>${formatCurrency(entry.equity)} (${entry.pnl >= 0 ? '+' : ''}${formatCurrency(entry.pnl)})</span>
    </div>`
    )
    .join('');
}

function renderPortfolio() {
  if (!state.portfolio || !state.user) return;
  document.getElementById('welcomeText').textContent = `Logged in as ${state.user.username}. Starting balance: $100,000`;
  document.getElementById('cashValue').textContent = formatCurrency(state.portfolio.cash);

  const positionsValue = state.portfolio.positions.reduce((sum, pos) => sum + Number(pos.quantity) * Number(pos.lastPrice || 0), 0);
  const equity = Number(state.portfolio.cash) + positionsValue;
  document.getElementById('equityValue').textContent = formatCurrency(equity);
}

async function loadNewsAndProfile() {
  const data = await api(`/api/market/news?symbol=${encodeURIComponent(state.symbol)}`);
  const info = data.profile || {};
  document.getElementById('companyInfo').innerHTML = `
    <p><strong>${info.companyName || state.symbol}</strong></p>
    <p>${info.sector || ''} ${info.industry ? `• ${info.industry}` : ''}</p>
    <p class="text-slate-300">${info.description ? `${info.description.slice(0, 280)}...` : 'No profile available.'}</p>
    ${info.website ? `<a href="${info.website}" class="text-cyan-400" target="_blank">${info.website}</a>` : ''}
  `;

  const newsHtml = (data.news || [])
    .map(
      (item) => `<a class="block border border-slate-800 rounded p-2 hover:border-slate-600" href="${item.link}" target="_blank">
      <p class="font-medium">${item.title}</p>
      <p class="text-xs text-slate-400">${item.publisher} • ${new Date(item.providerPublishTime * 1000).toLocaleString()}</p>
    </a>`
    )
    .join('');
  document.getElementById('newsList').innerHTML = newsHtml || '<p class="text-slate-400">No latest news.</p>';
}

async function loadUserData() {
  const me = await api('/api/me');
  state.user = me.user;
  state.portfolio = me.portfolio;

  const trades = await api('/api/trades');
  renderTrades(trades);

  state.leaderboard = await api('/api/leaderboard');
  renderLeaderboard();
  renderPortfolio();
}

async function bootstrapApp() {
  if (!state.token) {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    renderTradingView(state.symbol);
    return;
  }

  try {
    await loadUserData();
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    renderTradingView(state.symbol);
    await loadNewsAndProfile();
    setStatus('Connected. Live prices are used for paper trade execution.');
  } catch (error) {
    setStatus(error.message);
    localStorage.removeItem('token');
    state.token = null;
    await bootstrapApp();
  }
}

document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    state.token = data.token;
    localStorage.setItem('token', data.token);
    setStatus('Registration successful. Paper account funded with $100,000.');
    await bootstrapApp();
  } catch (error) {
    setStatus(error.message);
  }
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    state.token = data.token;
    localStorage.setItem('token', data.token);
    setStatus('Login successful.');
    await bootstrapApp();
  } catch (error) {
    setStatus(error.message);
  }
});

document.getElementById('tradeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    symbol: state.symbol,
    side: form.get('side'),
    quantity: Number(form.get('quantity'))
  };

  try {
    await api('/api/trades', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setStatus(`Trade executed: ${payload.side.toUpperCase()} ${payload.quantity} ${state.symbol}`);
    await loadUserData();
  } catch (error) {
    setStatus(error.message);
  }
});

document.getElementById('loadSymbolBtn').addEventListener('click', async () => {
  state.symbol = document.getElementById('symbolInput').value.toUpperCase().trim() || 'AAPL';
  renderTradingView(state.symbol);
  try {
    await loadNewsAndProfile();
    setStatus(`Loaded ${state.symbol}`);
  } catch (error) {
    setStatus(error.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  localStorage.removeItem('token');
  state.token = null;
  state.user = null;
  state.portfolio = null;
  setStatus('Logged out.');
  await bootstrapApp();
});

renderTradingView(state.symbol);
bootstrapApp();
setInterval(async () => {
  if (!state.token) return;
  try {
    state.leaderboard = await api('/api/leaderboard');
    renderLeaderboard();
  } catch {
    // ignore background refresh errors
  }
}, 15000);
