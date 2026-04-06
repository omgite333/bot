# Quotex Signal Bot

A professional trading signal generator for Quotex platform using pure technical analysis strategies - no AI, no machine learning.

![Quotex Signal Bot](https://img.shields.io/badge/version-1.0.0-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

## 🚀 Features

- **6 Technical Indicators**: RSI, EMA Crossover, MACD, Stochastic RSI, Bollinger Bands, Candlestick Patterns
- **Multi-Timeframe Analysis**: Combines 1-minute and 5-minute data
- **8 Accuracy Rules**: Anti-bias filters to maximize signal quality
- **Real-Time Updates**: Automatic signal refresh every 60 seconds
- **10 Trading Pairs**: Major Forex pairs + Bitcoin and Ethereum
- **Dark Trading Theme**: Professional UI optimized for traders

## 📊 Supported Trading Pairs

| Pair | Type | Symbol |
|------|------|--------|
| EUR/USD | Forex | EUR/USD |
| GBP/USD | Forex | GBP/USD |
| USD/JPY | Forex | USD/JPY |
| AUD/USD | Forex | AUD/USD |
| EUR/GBP | Forex | EUR/GBP |
| USD/CAD | Forex | USD/CAD |
| EUR/JPY | Forex | EUR/JPY |
| BTC/USD | Crypto | BTC/USD |
| ETH/USD | Crypto | ETH/USD |
| EUR/USD (OTC) | Forex | EUR/USD |

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Indicators**: technicalindicators (RSI, EMA, MACD, StochRSI, Bollinger Bands)
- **Data Source**: Twelve Data API (free tier - 500 requests/day)
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript

## ⚡ Quick Start

### Prerequisites

- Node.js v14 or higher
- Twelve Data API key (free at [twelvedata.com](https://twelvedata.com) - no credit card required)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env

# 3. Add your API key to .env
# Edit .env and replace 'your_key_here' with your actual API key:
TWELVE_DATA_API_KEY=your_actual_api_key_here

# 4. Start the server
npm start

# 5. Open frontend in browser
# Navigate to: frontend/index.html
# Or visit: http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

## 📖 How To Use

1. **Select a trading pair** from the dropdown menu
2. **Click START** to begin receiving signals
3. **Wait for the signal** - the bot fetches and analyzes data automatically
4. **Follow the signal**:
   - ⬆ **UP** (Green) - Consider buying CALL option
   - ⬇ **DOWN** (Red) - Consider buying PUT option
   - ⏸ **WAIT** (Yellow) - No clear signal, wait for next update
5. **Check signal strength**:
   - **STRONG** (75+ score) - High confidence, recommended
   - **WEAK** (55-74 score) - Lower confidence, trade with caution
6. **Click STOP** to stop the bot

## 📈 Strategy Explained

### Indicators Used

1. **RSI (Relative Strength Index)** - Period 14
   - Oversold (<40) = Potential UP signal
   - Overbought (>60) = Potential DOWN signal

2. **EMA Crossover (9/21)**
   - EMA9 above EMA21 = Bullish crossover
   - EMA9 below EMA21 = Bearish crossover

3. **MACD (12/26/9)**
   - MACD line above signal line = Bullish momentum
   - MACD line below signal line = Bearish momentum

4. **Stochastic RSI**
   - K < 20 = Oversold (potential bounce)
   - K > 80 = Overbought (potential drop)

5. **Bollinger Bands (20,2)**
   - Price near lower band = Potential support/UP
   - Price near upper band = Potential resistance/DOWN

6. **Candlestick Patterns**
   - Hammer = Bullish reversal
   - Shooting Star = Bearish reversal
   - Bullish Engulfing = Strong bullish pattern
   - Bearish Engulfing = Strong bearish pattern

### Confidence Scoring (out of 100)

**Base Indicators (60 points max)**
- RSI confirms direction: +15 points
- EMA crossover confirms: +15 points
- MACD confirms + histogram correct: +15 points
- Stochastic RSI confirms: +15 points

**Bonus Indicators (40 points max)**
- Bollinger Band position: +10 points
- Candlestick pattern detected: +10 points
- 5-minute trend aligns with signal: +15 points
- Active market session: +5 points

### 8 Accuracy Rules

1. **Consecutive Bias Prevention**: Blocks signal if 3+ same direction signals in a row
2. **RSI Exhaustion**: RSI <25 blocks DOWN, RSI >75 blocks UP
3. **Trend Alignment**: Signals should align with 5-minute trend
4. **Ranging Market Block**: No signals when Bollinger Band width <0.1%
5. **Reversal Priority**: Reversal patterns override normal signals
6. **Doji Candle Block**: No signals on doji candles (market indecision)
7. **Minimum Data**: Requires 30+ candles for reliable calculation
8. **Session Filter**: Forex outside sessions gets -15 penalty

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pairs` | GET | List all supported trading pairs |
| `/signal?pair=EURUSD` | GET | Generate trading signal |
| `/history?pair=EURUSD` | GET | Get signal history (last 10) |
| `/health` | GET | Health check endpoint |
| `/state` | GET | Debug state information |

## ⚠️ Disclaimer

**IMPORTANT**: This tool is for educational and informational purposes only.

- Trading signals do NOT guarantee profitable results
- Past performance is not indicative of future results
- Always conduct your own research before trading
- Only risk capital you can afford to lose
- This is not financial advice

## 💡 Tips For Best Results

1. **Use during active market sessions** (London: 07:00-16:00 UTC, New York: 13:00-21:00 UTC)
2. **Trust STRONG signals** (75+ confidence) over WEAK signals
3. **Never trade WAIT signals** - wait for clear direction
4. **Always test on a demo account first**
5. **Use proper risk management** - never risk more than 1-2% per trade
6. **Crypto pairs can be traded 24/7** - forex pairs have optimal times

## 🐛 Troubleshooting

### "Failed to fetch candle data"
- Check your Twelve Data API key is correct
- Verify you haven't exceeded your API quota (500 requests/day on free tier)
- Ensure you have an active internet connection

### "Failed to load pairs"
- Make sure the backend server is running on port 3000
- Check if any other process is using port 3000

### No signals appearing
- Verify you selected a trading pair
- Check browser console (F12) for errors
- Try refreshing the page

## 📝 License

MIT License - Free to use and modify.

---

Built with ❤️ for traders who want data-driven signals without AI complexity.

**Remember**: Always trade responsibly!
