# Quotex AI Signal Bot

## Setup (5 minutes)

1. npm install
2. cp .env.example .env
3. Get FREE Groq API key at console.groq.com
4. Paste key into .env file
5. node backend/server.js
6. Open frontend/index.html in browser
7. Select pair -> click START

## How It Works

- Connects to Quotex WebSocket for real-time price data
- Builds 1-minute candles from live ticks
- Calculates 6 indicators: RSI, EMA, MACD, StochRSI,
  Bollinger Bands, Candle Patterns
- Sends all data to Groq AI (Llama 3.3 70B) for analysis
- Combines strategy score + AI confidence for final signal
- Only shows BUY or SELL with STRONG/MEDIUM/WEAK strength
- New signal every 60 seconds automatically

## Signal Guide

STRONG BUY/SELL  -> High conviction, strategy+AI agree
MEDIUM BUY/SELL  -> Moderate conviction
WEAK BUY/SELL    -> Low conviction, use caution

## Best Practices

- STRONG signals are most reliable
- Trade during London (06-17 UTC) or NY (12-22 UTC)
- Crypto pairs work 24/7
- Always test on demo account first
- Never risk money you cannot afford to lose

## Disclaimer

For educational purposes only.
Trading binary options involves significant financial risk.
