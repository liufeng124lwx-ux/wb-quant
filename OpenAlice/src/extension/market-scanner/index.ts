import { loadScannerConfig } from './config';
import type { ScannerConfig } from './config';
import { AKShareClient } from './akshare-client';
import { createMarketScannerToolsImpl } from './tools';

// Extension adapter
export function createMarketScannerTools(configOverride?: Partial<ScannerConfig> & { dataDir?: string }) {
  const config = loadScannerConfig(configOverride?.dataDir);
  const merged: ScannerConfig = {
    watchlist: { ...config.watchlist, ...configOverride?.watchlist },
    thresholds: { ...config.thresholds, ...configOverride?.thresholds },
    sidecarUrl: configOverride?.sidecarUrl ?? config.sidecarUrl,
  };

  const akshare = new AKShareClient(merged.sidecarUrl);

  return createMarketScannerToolsImpl({ config: merged, akshare });
}

// Re-exports
export type { ScannerConfig } from './config';
export { loadScannerConfig } from './config';
export type { Quote, OHLCV } from './yahoo-finance';
export { fetchQuote, fetchKline } from './yahoo-finance';
export { AKShareClient } from './akshare-client';
export type { Signal, SignalType, Severity } from './signals';
export { detectSignals, calculateRSI, calculateMA } from './signals';
