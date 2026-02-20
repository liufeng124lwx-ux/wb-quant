import type { Quote, OHLCV } from './yahoo-finance';
import type { ScannerConfig } from './config';

export type SignalType =
  | 'PRICE_SPIKE'
  | 'PRICE_DROP'
  | 'VOLUME_SURGE'
  | 'RSI_OVERBOUGHT'
  | 'RSI_OVERSOLD'
  | 'MA_CROSS_UP'
  | 'MA_CROSS_DOWN';

export type Severity = 'low' | 'medium' | 'high';

export interface Signal {
  type: SignalType;
  symbol: string;
  market: string;
  severity: Severity;
  message: string;
  data: Record<string, number | string>;
}

// --- Technical indicator helpers ---

export function calculateRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;

  let gainSum = 0;
  let lossSum = 0;
  const recent = closes.slice(-period - 1);

  for (let i = 1; i <= period; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// --- Signal detection ---

export function detectSignals(
  quotes: Quote[],
  market: string,
  thresholds: ScannerConfig['thresholds'],
  klineMap?: Map<string, OHLCV[]>,
): Signal[] {
  const signals: Signal[] = [];

  for (const q of quotes) {
    const pctThreshold = thresholds.priceChangePercent;

    // Price spike
    if (q.changePercent > pctThreshold) {
      const severity: Severity = q.changePercent > pctThreshold * 2 ? 'high' : 'medium';
      signals.push({
        type: 'PRICE_SPIKE',
        symbol: q.symbol,
        market,
        severity,
        message: `${q.symbol} up ${q.changePercent.toFixed(2)}%`,
        data: { price: q.price, changePercent: q.changePercent },
      });
    }

    // Price drop
    if (q.changePercent < -pctThreshold) {
      const severity: Severity = q.changePercent < -pctThreshold * 2 ? 'high' : 'medium';
      signals.push({
        type: 'PRICE_DROP',
        symbol: q.symbol,
        market,
        severity,
        message: `${q.symbol} down ${q.changePercent.toFixed(2)}%`,
        data: { price: q.price, changePercent: q.changePercent },
      });
    }

    // Kline-based signals
    const klines = klineMap?.get(q.symbol);
    if (klines && klines.length > 0) {
      const closes = klines.map((k) => k.close);
      const volumes = klines.map((k) => k.volume);

      // Volume surge
      if (volumes.length >= 5) {
        const avgVol = volumes.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
        const lastVol = volumes[volumes.length - 1];
        if (avgVol > 0 && lastVol > avgVol * thresholds.volumeMultiplier) {
          signals.push({
            type: 'VOLUME_SURGE',
            symbol: q.symbol,
            market,
            severity: lastVol > avgVol * thresholds.volumeMultiplier * 2 ? 'high' : 'medium',
            message: `${q.symbol} volume ${(lastVol / avgVol).toFixed(1)}x average`,
            data: { volume: lastVol, avgVolume: avgVol },
          });
        }
      }

      // RSI
      const rsi = calculateRSI(closes);
      if (rsi !== null) {
        if (rsi > thresholds.rsiOverbought) {
          signals.push({
            type: 'RSI_OVERBOUGHT',
            symbol: q.symbol,
            market,
            severity: rsi > 80 ? 'high' : 'medium',
            message: `${q.symbol} RSI ${rsi.toFixed(1)} (overbought)`,
            data: { rsi },
          });
        }
        if (rsi < thresholds.rsiOversold) {
          signals.push({
            type: 'RSI_OVERSOLD',
            symbol: q.symbol,
            market,
            severity: rsi < 20 ? 'high' : 'medium',
            message: `${q.symbol} RSI ${rsi.toFixed(1)} (oversold)`,
            data: { rsi },
          });
        }
      }

      // MA crossover (5/20)
      if (closes.length >= 21) {
        const ma5Now = calculateMA(closes, 5)!;
        const ma20Now = calculateMA(closes, 20)!;
        const prevCloses = closes.slice(0, -1);
        const ma5Prev = calculateMA(prevCloses, 5);
        const ma20Prev = calculateMA(prevCloses, 20);

        if (ma5Prev !== null && ma20Prev !== null) {
          if (ma5Prev <= ma20Prev && ma5Now > ma20Now) {
            signals.push({
              type: 'MA_CROSS_UP',
              symbol: q.symbol,
              market,
              severity: 'medium',
              message: `${q.symbol} MA5 crossed above MA20 (bullish)`,
              data: { ma5: ma5Now, ma20: ma20Now },
            });
          }
          if (ma5Prev >= ma20Prev && ma5Now < ma20Now) {
            signals.push({
              type: 'MA_CROSS_DOWN',
              symbol: q.symbol,
              market,
              severity: 'medium',
              message: `${q.symbol} MA5 crossed below MA20 (bearish)`,
              data: { ma5: ma5Now, ma20: ma20Now },
            });
          }
        }
      }
    }
  }

  // Sort by severity: high > medium > low
  const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return signals;
}
