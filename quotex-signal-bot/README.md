# Quotex Signal Bot

A web application that provides continuous trading signals (UP/DOWN) every 1 minute for Quotex trading platform using technical analysis indicators.

## 📊 Features

- Real-time trading signals based on RSI, EMA, and MACD indicators
- Support for 10 major trading pairs (Forex and Crypto)
- Confidence scoring system
- Visual indicators breakdown
- Signal history tracking
- Automatic 60-second updates

## 🔧 Tech Stack

- **Backend**: Node.js + Express
- **Indicators**: technicalindicators (RSI, EMA, MACD)
- **Data Source**: Twelve Data API
- **Frontend**: HTML + CSS + Vanilla JavaScript

## 🚀 Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Twelve Data API key (free tier)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Configure your API key:**
   - Get a free API key from [twelvedata.com](https://twelvedata.com)
   - Edit `.env` and replace `your_key_here` with your actual API key:
   ```
   TWELVE_DATA_API_KEY=your_actual_api_key_here
   ```

4. **Start the server:**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open the frontend:**
   - Open `frontend/index.html` in your browser
   - Or navigate to `http://localhost:3000` after starting the server

## 📱 How to Use

1. **Select a trading pair** from the dropdown menu
2. **Click START** to begin receiving signals
3. **Wait for the signal** - the bot will fetch and display signals
4. **Follow the signal** - UP (green) or DOWN (red)
5. **Click STOP** to stop the bot

### Signal Interpretation

- **UP (Green)**: Indicates a potential upward price movement - consider buying CALL
- **DOWN (Red)**: Indicates a potential downward price movement - consider buying PUT
- **WAIT (Yellow)**: No clear signal - wait for the next update

### Confidence Level

- **66-100%**: High confidence - 2-3 indicators agree
- **33-65%**: Medium confidence - mixed signals
- **0-32%**: Low confidence - indicators disagree

## 📈 Strategy Explanation

The bot uses three technical indicators to generate signals:

### RSI (Relative Strength Index)
- **Period**: 14
- **UP Signal**: RSI < 40 (oversold condition)
- **DOWN Signal**: RSI > 60 (overbought condition)

### EMA (Exponential Moving Average)
- **Periods**: 9 and 21
- **UP Signal**: EMA9 > EMA21 (bullish crossover)
- **DOWN Signal**: EMA9 < EMA21 (bearish crossover)

### MACD (Moving Average Convergence Divergence)
- **Settings**: Fast 12, Slow 26, Signal 9
- **UP Signal**: MACD line > Signal line
- **DOWN Signal**: MACD line < Signal line

### Confidence Calculation
- Each agreeing indicator adds points (RSI: 33, EMA: 33, MACD: 34)
- 3 indicators agree = 100% confidence
- 2 indicators agree = 66% confidence
- Fewer than 2 agree = No signal (WAIT)

## 🔗 Supported Trading Pairs

1. EUR/USD
2. GBP/USD
3. USD/JPY
4. AUD/USD
5. EUR/GBP
6. USD/CAD
7. EUR/JPY
8. BTC/USD
9. ETH/USD
10. EUR/USD (OTC)

## ⚠️ Disclaimer

**IMPORTANT**: This tool is for educational and informational purposes only.

- Trading signals do not guarantee profitable results
- Past performance is not indicative of future results
- Always do your own research before making trading decisions
- Trade responsibly and only risk what you can afford to lose
- The bot does not replace professional financial advice

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pairs` | GET | Returns list of supported trading pairs |
| `/signal?pair=EURUSD` | GET | Returns trading signal for specified pair |

## 🛠️ Troubleshooting

### Common Issues

**"Failed to fetch candle data"**
- Check your Twelve Data API key
- Verify your API quota hasn't been exceeded
- Ensure you have an active internet connection

**"Failed to load trading pairs"**
- Make sure the backend server is running on port 3000
- Check if CORS is properly configured

**No signals appearing**
- Verify you selected a trading pair
- Check browser console for errors

## 📄 License

MIT License - Feel free to use and modify for your own projects.

---

Built with ❤️ for traders
