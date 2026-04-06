require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { fetchCandles } = require('./fetcher');
const { generateSignal } = require('./strategy');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const SUPPORTED_PAIRS = [
    { id: 'EURUSD', name: 'EUR/USD', symbol: 'EUR/USD' },
    { id: 'GBPUSD', name: 'GBP/USD', symbol: 'GBP/USD' },
    { id: 'USDJPY', name: 'USD/JPY', symbol: 'USD/JPY' },
    { id: 'AUDUSD', name: 'AUD/USD', symbol: 'AUD/USD' },
    { id: 'EURGBP', name: 'EUR/GBP', symbol: 'EUR/GBP' },
    { id: 'USDCAD', name: 'USD/CAD', symbol: 'USD/CAD' },
    { id: 'EURJPY', name: 'EUR/JPY', symbol: 'EUR/JPY' },
    { id: 'BTCUSD', name: 'BTC/USD', symbol: 'BTC/USD' },
    { id: 'ETHUSD', name: 'ETH/USD', symbol: 'ETH/USD' },
    { id: 'EURUSDOTC', name: 'EUR/USD (OTC)', symbol: 'EUR/USD' }
];

const PAIR_SYMBOL_MAP = {
    'EURUSD': 'EUR/USD',
    'GBPUSD': 'GBP/USD',
    'USDJPY': 'USD/JPY',
    'AUDUSD': 'AUD/USD',
    'EURGBP': 'EUR/GBP',
    'USDCAD': 'USD/CAD',
    'EURJPY': 'EUR/JPY',
    'BTCUSD': 'BTC/USD',
    'ETHUSD': 'ETH/USD',
    'EURUSDOTC': 'EUR/USD'
};

app.get('/pairs', (req, res) => {
    try {
        res.json(SUPPORTED_PAIRS);
    } catch (error) {
        console.error('Error fetching pairs:', error.message);
        res.status(500).json({ error: 'Failed to fetch pairs' });
    }
});

app.get('/signal', async (req, res) => {
    try {
        const pair = req.query.pair;

        if (!pair) {
            return res.status(400).json({ error: 'Pair parameter is required' });
        }

        const pairData = SUPPORTED_PAIRS.find(p => p.id === pair);
        if (!pairData) {
            return res.status(400).json({ error: 'Invalid pair. Use one of: ' + SUPPORTED_PAIRS.map(p => p.id).join(', ') });
        }

        const symbol = PAIR_SYMBOL_MAP[pair] || pair;

        const candles = await fetchCandles(symbol);

        if (!candles) {
            return res.status(500).json({ 
                error: 'Failed to fetch candle data. Check your API key and quota.',
                direction: 'WAIT',
                confidence: 0,
                indicators: {
                    rsi: { value: null, signal: 'NEUTRAL' },
                    ema: { ema9: null, ema21: null, signal: 'NEUTRAL' },
                    macd: { macd: null, signal_line: null, signal: 'NEUTRAL' }
                }
            });
        }

        const signal = generateSignal(candles);

        res.json({
            pair: pairData.name,
            symbol: symbol,
            timestamp: new Date().toISOString(),
            ...signal
        });
    } catch (error) {
        console.error('Error generating signal:', error.message);
        res.status(500).json({ 
            error: 'Failed to generate signal',
            direction: 'WAIT',
            confidence: 0,
            indicators: {
                rsi: { value: null, signal: 'NEUTRAL' },
                ema: { ema9: null, ema21: null, signal: 'NEUTRAL' },
                macd: { macd: null, signal_line: null, signal: 'NEUTRAL' }
            }
        });
    }
});

app.get('/', (req, res) => {
    res.json({
        name: 'Quotex Signal Bot API',
        version: '1.0.0',
        endpoints: {
            '/pairs': 'GET - List all supported trading pairs',
            '/signal?pair=EURUSD': 'GET - Get trading signal for specified pair'
        }
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🤖 Quotex Signal Bot Server running on port ${PORT}`);
    console.log(`📊 Supported pairs: ${SUPPORTED_PAIRS.length}`);
    console.log(`🔗 API docs: http://localhost:${PORT}`);
});
