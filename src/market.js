import yahooFinance from 'yahoo-finance2';

export async function getQuote(symbol) {
  const quote = await yahooFinance.quote(symbol);
  return {
    symbol: quote.symbol,
    shortName: quote.shortName,
    marketState: quote.marketState,
    currency: quote.currency,
    exchange: quote.fullExchangeName || quote.exchange,
    regularMarketPrice: quote.regularMarketPrice,
    regularMarketChange: quote.regularMarketChange,
    regularMarketChangePercent: quote.regularMarketChangePercent,
    regularMarketTime: quote.regularMarketTime
  };
}

export async function getChart(symbol, range = '1d', interval = '5m') {
  const chart = await yahooFinance.chart(symbol, { range, interval });
  const result = chart.quotes?.map((point) => ({
    time: point.date,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume
  })) || [];

  return {
    symbol,
    meta: chart.meta,
    points: result
  };
}

export async function getNews(symbol) {
  const news = await yahooFinance.search(symbol, {
    newsCount: 10,
    quotesCount: 1,
    enableFuzzyQuery: false
  });

  return (news.news || []).map((item) => ({
    title: item.title,
    publisher: item.publisher,
    link: item.link,
    providerPublishTime: item.providerPublishTime,
    thumbnail: item.thumbnail?.resolutions?.[0]?.url || null
  }));
}

export async function getCompanyProfile(symbol) {
  const summary = await yahooFinance.quoteSummary(symbol, {
    modules: ['assetProfile', 'price']
  });

  return {
    symbol,
    companyName: summary.price?.longName || summary.price?.shortName,
    sector: summary.assetProfile?.sector,
    industry: summary.assetProfile?.industry,
    website: summary.assetProfile?.website,
    description: summary.assetProfile?.longBusinessSummary
  };
}
