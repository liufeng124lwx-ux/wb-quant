# WB-Quant MVP 实施计划

## 目标
基于 OpenAlice 打造个人量化信息系统，AI 自主分析四大市场（加密货币/美股/A股/港股），通过 Telegram 推送交易机会。

## 架构

```
Python Sidecar (AKShare)     Yahoo Finance API     CCXT (已有)
       ↓ HTTP :5100                ↓                    ↓
       └──────────────→ Market Scanner Extension ←──────┘
                              ↓
                     Signal Detection (异动/指标/新闻)
                              ↓
                     AI Analysis (Claude 自主判断)
                              ↓
                     Telegram Push (优先级过滤)
```

## 任务分解

### Task 1: Python Sidecar — AKShare 数据服务
- 路径: `wb-quant/OpenAlice/sidecar/`
- Flask 轻量 HTTP 服务，端口 5100
- 接口:
  - `GET /api/a-shares/quote?symbols=600519,000858` — A股实时行情
  - `GET /api/a-shares/kline?symbol=600519&period=daily&count=60` — A股K线
  - `GET /api/hk-shares/quote?symbols=00700,09988` — 港股实时行情
  - `GET /api/hk-shares/kline?symbol=00700&period=daily&count=60` — 港股K线
  - `GET /api/news/a-shares` — A股新闻
  - `GET /api/news/hk-shares` — 港股新闻
- 依赖: akshare, flask

### Task 2: Market Scanner Extension (TypeScript)
- 路径: `src/extension/market-scanner/`
- 数据适配器:
  - `yahoo-finance.ts` — 美股/港股行情 (Yahoo Finance REST API, 免费)
  - `akshare-client.ts` — 调用 Python sidecar
  - 复用已有 CCXT 获取加密货币数据
- 信号检测:
  - `signals.ts` — 价格异动(涨跌幅>3%)、成交量放大(>2x均量)、MA交叉、RSI超买超卖
- AI 工具:
  - `scanMarkets` — 扫描所有市场，返回异动列表
  - `getMarketOverview` — 获取市场概览
  - `getStockDetail` — 获取个股详情
- 配置: `data/config/scanner.json`
  ```json
  {
    "watchlist": {
      "crypto": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
      "us": ["AAPL", "NVDA", "TSLA", "META", "MSFT"],
      "a-shares": ["600519", "000858", "300750", "002594"],
      "hk": ["00700", "09988", "01810", "03690"]
    },
    "thresholds": {
      "priceChangePercent": 3,
      "volumeMultiplier": 2,
      "rsiOverbought": 70,
      "rsiOversold": 30
    },
    "sidecarUrl": "http://localhost:5100"
  }
  ```

### Task 3: 集成 + 配置
- 修改 `main.ts` 注册 market-scanner extension
- 配置 persona.md 加入量化分析师角色
- 配置 scheduler 定时扫描（每30分钟）
- 配置 .env 加入 Telegram bot token
- 启动脚本: 同时启动 Python sidecar + Node 主进程

## 优先级
1. Task 1 + Task 2 并行开发
2. Task 3 集成测试
