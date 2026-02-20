import type { Quote, OHLCV } from './yahoo-finance';

export class AKShareClient {
  private baseUrl: string;

  constructor(sidecarUrl: string = 'http://localhost:5100') {
    this.baseUrl = sidecarUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T | null> {
    try {
      const url = new URL(path, this.baseUrl);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, v);
        }
      }
      const res = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async getAShareQuotes(symbols: string[]): Promise<Quote[]> {
    const data = await this.request<any[]>('/api/a-shares/quotes', {
      symbols: symbols.join(','),
    });
    if (!data) return [];
    return data.map((d: any) => ({
      symbol: d.symbol ?? d.code,
      price: d.price ?? d.close ?? 0,
      change: d.change ?? 0,
      changePercent: d.changePercent ?? d.pct_chg ?? 0,
      volume: d.volume ?? d.vol ?? 0,
      high: d.high ?? 0,
      low: d.low ?? 0,
      open: d.open ?? 0,
      prevClose: d.prevClose ?? d.pre_close ?? 0,
      time: d.time ?? Date.now(),
    }));
  }

  async getAShareKline(
    symbol: string,
    period: string = 'daily',
    count: number = 60,
  ): Promise<OHLCV[]> {
    const data = await this.request<any[]>('/api/a-shares/kline', {
      symbol,
      period,
      count: String(count),
    });
    if (!data) return [];
    return data.map((d: any) => ({
      time: new Date(d.date ?? d.time).getTime(),
      open: d.open ?? 0,
      high: d.high ?? 0,
      low: d.low ?? 0,
      close: d.close ?? 0,
      volume: d.volume ?? d.vol ?? 0,
    }));
  }

  async getHKQuotes(symbols: string[]): Promise<Quote[]> {
    const data = await this.request<any[]>('/api/hk/quotes', {
      symbols: symbols.join(','),
    });
    if (!data) return [];
    return data.map((d: any) => ({
      symbol: d.symbol ?? d.code,
      price: d.price ?? d.close ?? 0,
      change: d.change ?? 0,
      changePercent: d.changePercent ?? d.pct_chg ?? 0,
      volume: d.volume ?? d.vol ?? 0,
      high: d.high ?? 0,
      low: d.low ?? 0,
      open: d.open ?? 0,
      prevClose: d.prevClose ?? d.pre_close ?? 0,
      time: d.time ?? Date.now(),
    }));
  }

  async getHKKline(
    symbol: string,
    period: string = 'daily',
    count: number = 60,
  ): Promise<OHLCV[]> {
    const data = await this.request<any[]>('/api/hk/kline', {
      symbol,
      period,
      count: String(count),
    });
    if (!data) return [];
    return data.map((d: any) => ({
      time: new Date(d.date ?? d.time).getTime(),
      open: d.open ?? 0,
      high: d.high ?? 0,
      low: d.low ?? 0,
      close: d.close ?? 0,
      volume: d.volume ?? d.vol ?? 0,
    }));
  }

  async getNews(): Promise<any[]> {
    return (await this.request<any[]>('/api/news')) ?? [];
  }

  async getHotAShares(): Promise<any[]> {
    return (await this.request<any[]>('/api/a-shares/hot')) ?? [];
  }

  async getHotHKShares(): Promise<any[]> {
    return (await this.request<any[]>('/api/hk/hot')) ?? [];
  }
}
