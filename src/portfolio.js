export const STARTING_CASH = 100000;

export function calculatePortfolio(userId, trades) {
  const userTrades = trades.filter((trade) => trade.userId === userId);
  let cash = STARTING_CASH;
  const positions = new Map();

  for (const trade of userTrades) {
    const qty = Number(trade.quantity);
    const price = Number(trade.price);
    if (trade.side === 'buy') {
      cash -= qty * price;
      positions.set(trade.symbol, (positions.get(trade.symbol) || 0) + qty);
    } else {
      cash += qty * price;
      positions.set(trade.symbol, (positions.get(trade.symbol) || 0) - qty);
    }
  }

  const normalized = [...positions.entries()]
    .filter(([, quantity]) => Math.abs(quantity) > 1e-8)
    .map(([symbol, quantity]) => ({ symbol, quantity }));

  return { cash, positions: normalized, trades: userTrades };
}

export function canExecuteSell(portfolio, symbol, quantity) {
  const pos = portfolio.positions.find((entry) => entry.symbol === symbol);
  const held = pos?.quantity || 0;
  return held >= quantity;
}
