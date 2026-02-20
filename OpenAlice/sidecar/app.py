"""AKShare sidecar service — Flask HTTP API for A-shares, HK shares, and market news."""

import time
from typing import Any

import akshare as ak
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# Simple in-memory cache (key -> (timestamp, data))
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 60  # seconds


def _get_cached(key: str) -> Any | None:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cache(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _df_to_records(df: pd.DataFrame) -> list[dict]:
    return df.to_dict(orient="records")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/health")
def health():
    """Health check."""
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# A-Shares (A股)
# ---------------------------------------------------------------------------

def _fetch_a_spot() -> pd.DataFrame:
    """Fetch full A-share spot data with caching."""
    cached = _get_cached("a_spot")
    if cached is not None:
        return cached
    df = ak.stock_zh_a_spot_em()
    _set_cache("a_spot", df)
    return df


_A_FIELD_MAP = {
    "代码": "symbol",
    "名称": "name",
    "最新价": "price",
    "涨跌额": "change",
    "涨跌幅": "changePercent",
    "成交量": "volume",
    "成交额": "amount",
    "最高": "high",
    "最低": "low",
    "今开": "open",
    "昨收": "prevClose",
}


@app.route("/api/a-shares/quote")
def a_shares_quote():
    """Real-time A-share quotes filtered by symbol list."""
    try:
        symbols_param = request.args.get("symbols", "")
        if not symbols_param:
            return jsonify({"error": "symbols parameter required"}), 400
        symbols = [s.strip() for s in symbols_param.split(",") if s.strip()]
        df = _fetch_a_spot()
        df = df[df["代码"].isin(symbols)]
        df = df.rename(columns=_A_FIELD_MAP)[list(_A_FIELD_MAP.values())]
        return jsonify(_df_to_records(df))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/a-shares/kline")
def a_shares_kline():
    """K-line (OHLCV) data for a single A-share symbol."""
    try:
        symbol = request.args.get("symbol", "")
        period = request.args.get("period", "daily")
        count = int(request.args.get("count", 60))
        if not symbol:
            return jsonify({"error": "symbol parameter required"}), 400

        cache_key = f"a_kline_{symbol}_{period}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return jsonify(cached[-count:])

        df = ak.stock_zh_a_hist(symbol=symbol, period=period, adjust="qfq")
        df = df.rename(columns={
            "日期": "date", "开盘": "open", "收盘": "close",
            "最高": "high", "最低": "low", "成交量": "volume",
        })
        cols = ["date", "open", "close", "high", "low", "volume"]
        df = df[[c for c in cols if c in df.columns]]
        df["date"] = df["date"].astype(str)
        records = _df_to_records(df)
        _set_cache(cache_key, records)
        return jsonify(records[-count:])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/a-shares/hot")
def a_shares_hot():
    """Top 20 A-share gainers by changePercent."""
    try:
        df = _fetch_a_spot()
        df = df.sort_values("涨跌幅", ascending=False).head(20)
        df = df.rename(columns=_A_FIELD_MAP)[list(_A_FIELD_MAP.values())]
        return jsonify(_df_to_records(df))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# HK Shares (港股)
# ---------------------------------------------------------------------------

def _fetch_hk_spot() -> pd.DataFrame:
    """Fetch full HK-share spot data with caching."""
    cached = _get_cached("hk_spot")
    if cached is not None:
        return cached
    df = ak.stock_hk_spot_em()
    _set_cache("hk_spot", df)
    return df


_HK_FIELD_MAP = {
    "代码": "symbol",
    "名称": "name",
    "最新价": "price",
    "涨跌额": "change",
    "涨跌幅": "changePercent",
    "成交量": "volume",
    "成交额": "amount",
    "最高": "high",
    "最低": "low",
    "今开": "open",
    "昨收": "prevClose",
}


@app.route("/api/hk-shares/quote")
def hk_shares_quote():
    """Real-time HK-share quotes filtered by symbol list."""
    try:
        symbols_param = request.args.get("symbols", "")
        if not symbols_param:
            return jsonify({"error": "symbols parameter required"}), 400
        symbols = [s.strip() for s in symbols_param.split(",") if s.strip()]
        df = _fetch_hk_spot()
        df = df[df["代码"].isin(symbols)]
        df = df.rename(columns=_HK_FIELD_MAP)[list(_HK_FIELD_MAP.values())]
        return jsonify(_df_to_records(df))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/hk-shares/kline")
def hk_shares_kline():
    """K-line (OHLCV) data for a single HK-share symbol."""
    try:
        symbol = request.args.get("symbol", "")
        period = request.args.get("period", "daily")
        count = int(request.args.get("count", 60))
        if not symbol:
            return jsonify({"error": "symbol parameter required"}), 400

        cache_key = f"hk_kline_{symbol}_{period}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return jsonify(cached[-count:])

        df = ak.stock_hk_hist(symbol=symbol, period=period, adjust="qfq")
        df = df.rename(columns={
            "日期": "date", "开盘": "open", "收盘": "close",
            "最高": "high", "最低": "low", "成交量": "volume",
        })
        cols = ["date", "open", "close", "high", "low", "volume"]
        df = df[[c for c in cols if c in df.columns]]
        df["date"] = df["date"].astype(str)
        records = _df_to_records(df)
        _set_cache(cache_key, records)
        return jsonify(records[-count:])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/hk-shares/hot")
def hk_shares_hot():
    """Top 20 HK-share stocks by changePercent."""
    try:
        df = _fetch_hk_spot()
        df = df.sort_values("涨跌幅", ascending=False).head(20)
        df = df.rename(columns=_HK_FIELD_MAP)[list(_HK_FIELD_MAP.values())]
        return jsonify(_df_to_records(df))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# News
# ---------------------------------------------------------------------------

@app.route("/api/news/market")
def news_market():
    """Latest 30 financial news items."""
    try:
        cached = _get_cached("news_market")
        if cached is not None:
            return jsonify(cached)

        df = ak.stock_news_em(symbol="300059")
        df = df.head(30)
        df = df.rename(columns={
            "新闻标题": "title",
            "发布时间": "time",
            "新闻内容": "content",
            "新闻链接": "url",
        })
        cols = ["title", "time", "content", "url"]
        df = df[[c for c in cols if c in df.columns]]
        records = _df_to_records(df)
        _set_cache("news_market", records)
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100, debug=False)
