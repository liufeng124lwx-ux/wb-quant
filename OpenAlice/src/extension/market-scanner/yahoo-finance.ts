export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  time: number;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toYahooSymbol(symbol: string, market: string): string {
  if (market === 'hk') {
    return `${symbol}.HK`;
  }
  if (market === 'a-shares') {
    // Shanghai: 6xxxxx → .SS, Shenzhen: 0xxxxx/3xxxxx → .SZ
    const suffix = symbol.startsWith('6') ? '.SS' : '.SZ';
    return `${symbol}${suffix}`;
  }
  return symbol;
}

export async function fetchQuote(
  symbols: string[],
  market: string,
): Promise<Quote[]> {
  const results: Quote[] = [];

  for (const sym of symbols) {
    const yahooSym = toYahooSymbol(sym, market);
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=5d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta;
      const quotes = result.indicators?.quote?.[0];
      const timestamps = result.timestamp;
      if (!meta || !quotes || !timestamps?.length) continue;

      const lastIdx = timestamps.length - 1;
      const prevIdx = lastIdx > 0 ? lastIdx - 1 : 0;
      const prevClose = quotes.close?.[prevIdx] ?? meta.chartPreviousClose ?? meta.previousClose ?? 0;
      const price = quotes.close?.[lastIdx] ?? meta.regularMarketPrice ?? 0;
      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      results.push({
        symbol: sym,
        price,
        change,
        changePercent,
        volume: quotes.volume?.[lastIdx] ?? 0,
        high: quotes.high?.[lastIdx] ?? 0,
        low: quotes.low?.[lastIdx] ?? 0,
        open: quotes.open?.[lastIdx] ?? 0,
        prevClose,
        time: timestamps[lastIdx] * 1000,
      });
    } catch {
      // Skip failed symbols
    }
  }

  return results;
}

export async function fetchKline(
  symbol: string,
  market: string,
  interval: string = '1d',
  range: string = '3mo',
): Promise<OHLCV[]> {
  const yahooSym = toYahooSymbol(symbol, market);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp ?? [];
    const quotes = result.indicators?.quote?.[0];
    if (!quotes) return [];

    const klines: OHLCV[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = quotes.open?.[i];
      const h = quotes.high?.[i];
      const l = quotes.low?.[i];
      const c = quotes.close?.[i];
      const v = quotes.volume?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      klines.push({
        time: timestamps[i] * 1000,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v ?? 0,
      });
    }
    return klines;
  } catch {
    return [];
  }
}
