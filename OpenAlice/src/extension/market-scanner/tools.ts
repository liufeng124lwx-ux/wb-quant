import { tool } from 'ai';
import { z } from 'zod';
import type { ScannerConfig } from './config';
import type { Quote, OHLCV } from './yahoo-finance';
import { fetchQuote, fetchKline } from './yahoo-finance';
import { AKShareClient } from './akshare-client';
import { detectSignals } from './signals';
import type { Signal } from './signals';

type MarketType = 'crypto' | 'us' | 'a-shares' | 'hk';

interface ScannerContext {
  config: ScannerConfig;
  akshare: AKShareClient;
}

async function fetchMarketQuotes(
  ctx: ScannerContext,
  market: MarketType,
): Promise<Quote[]> {
  const { config, akshare } = ctx;
  switch (market) {
    case 'us':
      return fetchQuote(config.watchlist.us, 'us');
    case 'hk':
      // Try AKShare first, fall back to Yahoo
      const hkQuotes = await akshare.getHKQuotes(config.watchlist.hk);
      if (hkQuotes.length > 0) return hkQuotes;
      return fetchQuote(config.watchlist.hk, 'hk');
    case 'a-shares':
      return akshare.getAShareQuotes(config.watchlist.aShares);
    case 'crypto':
      // Crypto uses Yahoo Finance with symbol mapping (BTC/USDT → BTC-USD)
      const cryptoSymbols = config.watchlist.crypto.map((s) =>
        s.replace('/', '-').replace('USDT', 'USD'),
      );
      return fetchQuote(cryptoSymbols, 'crypto');
    default:
      return [];
  }
}

async function fetchMarketKlines(
  ctx: ScannerContext,
  market: MarketType,
  symbols: string[],
): Promise<Map<string, OHLCV[]>> {
  const map = new Map<string, OHLCV[]>();
  const { akshare } = ctx;

  for (const sym of symbols) {
    let klines: OHLCV[] = [];
    switch (market) {
      case 'us':
      case 'crypto':
        klines = await fetchKline(
          market === 'crypto' ? sym.replace('/', '-').replace('USDT', 'USD') : sym,
          market === 'crypto' ? 'crypto' : 'us',
        );
        break;
      case 'hk':
        klines = await akshare.getHKKline(sym);
        if (klines.length === 0) klines = await fetchKline(sym, 'hk');
        break;
      case 'a-shares':
        klines = await akshare.getAShareKline(sym);
        break;
    }
    if (klines.length > 0) map.set(sym, klines);
  }
  return map;
}

export function createMarketScannerToolsImpl(ctx: ScannerContext) {
  return {
    scanMarkets: tool({
      description: `
Scan all configured markets (crypto, US, A-shares, HK) for trading signals.

Detects: price spikes/drops, volume surges, RSI overbought/oversold, MA crossovers.
Returns signals sorted by severity (high → medium → low).

Uses the watchlist and thresholds from scanner config.
      `.trim(),
      inputSchema: z.object({}),
      execute: async (): Promise<{ signals: Signal[]; summary: string }> => {
        const markets: MarketType[] = ['crypto', 'us', 'a-shares', 'hk'];
        const allSignals: Signal[] = [];

        for (const market of markets) {
          const quotes = await fetchMarketQuotes(ctx, market);
          if (quotes.length === 0) continue;

          const symbols = quotes.map((q) => q.symbol);
          const klineMap = await fetchMarketKlines(ctx, market, symbols);
          const signals = detectSignals(quotes, market, ctx.config.thresholds, klineMap);
          allSignals.push(...signals);
        }

        const highCount = allSignals.filter((s) => s.severity === 'high').length;
        const medCount = allSignals.filter((s) => s.severity === 'medium').length;

        return {
          signals: allSignals,
          summary: `Found ${allSignals.length} signals (${highCount} high, ${medCount} medium)`,
        };
      },
    }),

    getMarketOverview: tool({
      description: `
Get current prices for all watchlist symbols, optionally filtered by market.

Returns quotes grouped by market with price, change%, volume, and OHLC data.
      `.trim(),
      inputSchema: z.object({
        market: z
          .enum(['crypto', 'us', 'a-shares', 'hk'])
          .optional()
          .describe('Filter by market. Omit to get all markets.'),
      }),
      execute: async ({ market }) => {
        const markets: MarketType[] = market
          ? [market]
          : ['crypto', 'us', 'a-shares', 'hk'];

        const result: Record<string, Quote[]> = {};
        for (const m of markets) {
          const quotes = await fetchMarketQuotes(ctx, m);
          if (quotes.length > 0) result[m] = quotes;
        }
        return result;
      },
    }),

    getStockDetail: tool({
      description: `
Get detailed info for a specific symbol: current quote, recent kline data, and detected signals.
      `.trim(),
      inputSchema: z.object({
        symbol: z.string().describe('Stock/crypto symbol, e.g. "AAPL", "600519", "00700", "BTC/USDT"'),
        market: z
          .enum(['crypto', 'us', 'a-shares', 'hk'])
          .describe('Which market this symbol belongs to'),
      }),
      execute: async ({ symbol, market }) => {
        const quotes = await fetchMarketQuotes(
          { ...ctx, config: { ...ctx.config, watchlist: { ...ctx.config.watchlist, [market === 'a-shares' ? 'aShares' : market]: [symbol] } } },
          market as MarketType,
        );

        const klineMap = await fetchMarketKlines(ctx, market as MarketType, [symbol]);
        const signals = quotes.length > 0
          ? detectSignals(quotes, market, ctx.config.thresholds, klineMap)
          : [];

        return {
          quote: quotes[0] ?? null,
          kline: klineMap.get(symbol)?.slice(-20) ?? [],
          signals,
        };
      },
    }),
  };
}
