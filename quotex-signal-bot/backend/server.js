/**
 * server.js - Express API Server
 * Handles routes for signals, pairs, and history
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { fetchMultiTimeframe } = require('./fetcher');
const { generateSignal } = require('./strategy');
const state = require('./state');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Supported trading pairs configuration
const SUPPORTED_PAIRS = [
    { id: 'EURUSD', name: 'EUR/USD', symbol: 'EUR/USD', type: 'forex' },
    { id: 'GBPUSD', name: 'GBP/USD', symbol: 'GBP/USD', type: 'forex' },
    { id: 'USDJPY', name: 'USD/JPY', symbol: 'USD/JPY', type: 'forex' },
    { id: 'AUDUSD', name: 'AUD/USD', symbol: 'AUD/USD', type: 'forex' },
    { id: 'EURGBP', name: 'EUR/GBP', symbol: 'EUR/GBP', type: 'forex' },
    { id: 'USDCAD', name: 'USD/CAD', symbol: 'USD/CAD', type: 'forex' },
    { id: 'EURJPY', name: 'EUR/JPY', symbol: 'EUR/JPY', type: 'forex' },
    { id: 'BTCUSD', name: 'BTC/USD', symbol: 'BTC/USD', type: 'crypto' },
    { id: 'ETHUSD', name: 'ETH/USD', symbol: 'ETH/USD', type: 'crypto' },
    { id: 'EURUSDOTC', name: 'EUR/USD (OTC)', symbol: 'EUR/USD', type: 'forex' }
];

// Map pair IDs to API symbols
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

// Signal cache (30 second cache)
const signalCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Returns if cached signal is still valid
 * @param {string} pair - Trading pair
 * @returns {Object|null} - Cached signal or null
 */
function getCachedSignal(pair) {
    const cached = signalCache.get(pair);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`[SERVER] Returning cached signal for ${pair}`);
        return cached.data;
    }
    return null;
}

/**
 * Caches a signal
 * @param {string} pair - Trading pair
 * @param {Object} data - Signal data
 */
function setCachedSignal(pair, data) {
    signalCache.set(pair, {
        data: data,
        timestamp: Date.now()
    });
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /pairs
 * Returns list of supported trading pairs
 */
app.get('/pairs', (req, res) => {
    try {
        const pairsList = SUPPORTED_PAIRS.map(pair => ({
            id: pair.id,
            name: pair.name,
            type: pair.type
        }));
        
        res.json({
            success: true,
            pairs: pairsList
        });
    } catch (error) {
        console.error('[SERVER] Error fetching pairs:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch pairs' 
        });
    }
});

/**
 * GET /signal
 * Generates trading signal for specified pair
 * Query params: pair (required)
 */
app.get('/signal', async (req, res) => {
    try {
        const { pair } = req.query;

        // Validate pair parameter
        if (!pair) {
            return res.status(400).json({
                success: false,
                error: 'Pair parameter is required. Example: /signal?pair=EURUSD'
            });
        }

        // Find pair config
        const pairConfig = SUPPORTED_PAIRS.find(p => p.id === pair);
        if (!pairConfig) {
            return res.status(400).json({
                success: false,
                error: `Invalid pair. Valid pairs: ${SUPPORTED_PAIRS.map(p => p.id).join(', ')}`
            });
        }

        // Check cache first
        const cached = getCachedSignal(pair);
        if (cached) {
            return res.json({
                success: true,
                cached: true,
                ...cached
            });
        }

        console.log(`[SERVER] Generating signal for ${pairConfig.name}`);

        // Get API symbol
        const symbol = PAIR_SYMBOL_MAP[pair] || pair;

        // Fetch multi-timeframe candles
        const candleData = await fetchMultiTimeframe(symbol);

        // Check if we have at least 1m candles
        if (!candleData.candles1m) {
            return res.status(503).json({
                success: false,
                error: 'Unable to fetch candle data. Check API key and quota.',
                direction: 'WAIT',
                strength: 'WAIT',
                confidence: 0
            });
        }

        // Generate signal
        const signal = generateSignal(
            candleData.candles1m,
            candleData.candles5m,
            pairConfig.name
        );

        // Cache the signal
        setCachedSignal(pair, signal);

        // Return response
        res.json({
            success: true,
            cached: false,
            ...signal
        });
    } catch (error) {
        console.error('[SERVER] Error generating signal:', error.message);
        res.status(500).json({
            success: false,
            error: 'Internal server error during signal generation',
            direction: 'WAIT',
            strength: 'WAIT',
            confidence: 0
        });
    }
});

/**
 * GET /history
 * Returns signal history for specified pair
 * Query params: pair (required)
 */
app.get('/history', (req, res) => {
    try {
        const { pair } = req.query;

        if (!pair) {
            return res.status(400).json({
                success: false,
                error: 'Pair parameter is required'
            });
        }

        const pairConfig = SUPPORTED_PAIRS.find(p => p.id === pair);
        if (!pairConfig) {
            return res.status(400).json({
                success: false,
                error: 'Invalid pair'
            });
        }

        const history = state.getHistory(pairConfig.name);

        res.json({
            success: true,
            pair: pairConfig.name,
            history: history
        });
    } catch (error) {
        console.error('[SERVER] Error fetching history:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch history'
        });
    }
});

/**
 * GET /state
 * Returns current state data (for debugging)
 */
app.get('/state', (req, res) => {
    try {
        const allState = state.getAllState();
        res.json({
            success: true,
            ...allState
        });
    } catch (error) {
        console.error('[SERVER] Error fetching state:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch state'
        });
    }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        cacheSize: signalCache.size
    });
});

/**
 * GET /
 * API info endpoint
 */
app.get('/', (req, res) => {
    res.json({
        name: 'Quotex Signal Bot API',
        version: '1.0.0',
        description: 'Strategy-based trading signal generator',
        endpoints: {
            '/pairs': 'GET - List supported trading pairs',
            '/signal?pair=EURUSD': 'GET - Generate trading signal',
            '/history?pair=EURUSD': 'GET - Get signal history',
            '/health': 'GET - Health check',
            '/state': 'GET - Debug state info'
        },
        supportedPairs: SUPPORTED_PAIRS.map(p => p.name)
    });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.path}`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[SERVER] Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log('\n' + '═'.repeat(50));
    console.log('🤖 QUOTEX SIGNAL BOT SERVER');
    console.log('═'.repeat(50));
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 API docs: http://localhost:${PORT}`);
    console.log(`📊 Supported pairs: ${SUPPORTED_PAIRS.length}`);
    console.log('═'.repeat(50) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM received, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[SERVER] SIGINT received, shutting down...');
    process.exit(0);
});
