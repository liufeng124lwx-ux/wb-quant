import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface ScannerConfig {
  watchlist: {
    crypto: string[];
    us: string[];
    aShares: string[];
    hk: string[];
  };
  thresholds: {
    priceChangePercent: number;
    volumeMultiplier: number;
    rsiOverbought: number;
    rsiOversold: number;
  };
  sidecarUrl: string;
}

const DEFAULT_CONFIG: ScannerConfig = {
  watchlist: {
    crypto: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
    us: ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META'],
    aShares: ['600519', '000858', '601318', '000333', '002594'],
    hk: ['00700', '09988', '09618', '01810', '03690'],
  },
  thresholds: {
    priceChangePercent: 3,
    volumeMultiplier: 2,
    rsiOverbought: 70,
    rsiOversold: 30,
  },
  sidecarUrl: 'http://localhost:5100',
};

export function loadScannerConfig(dataDir?: string): ScannerConfig {
  const configPath = resolve(dataDir ?? 'data', 'config', 'scanner.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ScannerConfig>;
    return {
      watchlist: { ...DEFAULT_CONFIG.watchlist, ...parsed.watchlist },
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...parsed.thresholds },
      sidecarUrl: parsed.sidecarUrl ?? DEFAULT_CONFIG.sidecarUrl,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
