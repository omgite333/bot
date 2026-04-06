/**
 * server.js - Express + Socket.io Server
 * Main server with real-time data and AI signal generation
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const fetcher = require('./fetcher');
const candleBuilder = require('./candle-builder');
const signalEngine = require('./signal-engine');
const state = require('./state');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

const SUPPORTED_PAIRS = [
    { id: 'EURUSD', name: 'EUR/USD', symbol: 'EURUSD' },
    { id: 'GBPUSD', name: 'GBP/USD', symbol: 'GBPUSD' },
    { id: 'USDJPY', name: 'USD/JPY', symbol: 'USDJPY' },
    { id: 'AUDUSD', name: 'AUD/USD', symbol: 'AUDUSD' },
    { id: 'EURGBP', name: 'EUR/GBP', symbol: 'EURGBP' },
    { id: 'USDCAD', name: 'USD/CAD', symbol: 'USDCAD' },
    { id: 'EURJPY', name: 'EUR/JPY', symbol: 'EURJPY' },
    { id: 'BTCUSD', name: 'BTC/USD', symbol: 'BTCUSD' },
    { id: 'ETHUSD', name: 'ETH/USD', symbol: 'ETHUSD' },
    { id: 'EURUSD_OTC', name: 'EUR/USD (OTC)', symbol: 'EURUSD_OTC' }
];

let activePair = 'EURUSD';
let isRunning = false;
let signalLoopInterval = null;
let currentSignal = null;
let prices = {};

app.use(cors());
app.use(express.json());

app.get('/pairs', (req, res) => {
    res.json({
        success: true,
        pairs: SUPPORTED_PAIRS
    });
});

app.get('/signal', async (req, res) => {
    try {
        const { pair } = req.query;
        const targetPair = pair || activePair;
        const signal = await signalEngine.generateFinalSignal(targetPair);
        state.addSignal(targetPair, signal);
        res.json({
            success: true,
            signal
        });
    } catch (error) {
        console.error('[SERVER] Signal error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/history', (req, res) => {
    const { pair } = req.query;
    const targetPair = pair || activePair;
    const history = state.getHistory(targetPair);
    res.json({
        success: true,
        pair: targetPair,
        history
    });
});

app.get('/status', (req, res) => {
    const fetcherStatus = fetcher.getStatus();
    const candleData = candleBuilder.getCandleData();
    res.json({
        success: true,
        wsStatus: fetcherStatus,
        candleCount: candleData[activePair] || 0,
        activePair,
        isRunning,
        prices: fetcher.getAllPrices()
    });
});

app.get('/prices', (req, res) => {
    res.json({
        success: true,
        prices: fetcher.getAllPrices()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

fetcher.onTick((data) => {
    if (data.type === 'history' && data.candles) {
        candleBuilder.processTick({
            type: 'history',
            asset: data.asset,
            candles: data.candles
        });
    } else if (data.type === 'quote') {
        candleBuilder.processTick(data);
        prices[data.asset] = data.price;
        io.emit('price_update', { asset: data.asset, price: data.price });
        
        const count = candleBuilder.getCandleCount(data.asset);
        io.emit('candle_update', { pair: data.asset, count });
    }
});

fetcher.onStatusChange((status) => {
    console.log(`[SERVER] Data Status: ${status}`);
    io.emit('ws_status', status);
    
    if (status === 'CONNECTED') {
        setTimeout(generateAndBroadcastSignal, 2000);
    }
});

io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    socket.emit('ws_status', fetcher.getStatus());
    socket.emit('prices', fetcher.getAllPrices());
    
    if (currentSignal) {
        socket.emit('signal', currentSignal);
    }
    
    socket.on('change_pair', async (data) => {
        const newPair = data.pair;
        if (!SUPPORTED_PAIRS.find(p => p.symbol === newPair)) {
            socket.emit('error', 'Invalid pair');
            return;
        }
        
        if (activePair !== newPair) {
            state.resetPair(activePair);
            activePair = newPair;
        }
        
        socket.emit('ws_status', 'CHANGING_PAIR');
        
        setTimeout(async () => {
            try {
                const signal = await signalEngine.generateFinalSignal(activePair);
                state.addSignal(activePair, signal);
                currentSignal = signal;
                io.emit('signal', signal);
            } catch (error) {
                console.error('[SOCKET] Signal error:', error.message);
                socket.emit('error', error.message);
            }
        }, 1000);
    });
    
    socket.on('disconnect', () => {
        console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
});

async function generateAndBroadcastSignal() {
    if (!isRunning) return;
    
    try {
        console.log(`[LOOP] Generating signal for ${activePair}...`);
        console.log(`[LOOP] Candles available: ${candleBuilder.getCandleCount(activePair)}`);
        
        const signal = await signalEngine.generateFinalSignal(activePair);
        state.addSignal(activePair, signal);
        currentSignal = signal;
        io.emit('signal', signal);
        
        console.log(`[LOOP] Signal: ${signal.direction} (${signal.strength}) - ${signal.confidence}%`);
        console.log(`[LOOP] Strategy: BUY ${signal.strategy.buyPoints} | SELL ${signal.strategy.sellPoints}`);
        
    } catch (error) {
        console.error('[LOOP] Signal error:', error.message);
        io.emit('error', error.message);
    }
}

function startSignalLoop() {
    if (signalLoopInterval) {
        clearInterval(signalLoopInterval);
    }
    isRunning = true;
    generateAndBroadcastSignal();
    signalLoopInterval = setInterval(generateAndBroadcastSignal, 60000);
    console.log('[SERVER] Signal loop started (60s interval)');
}

function stopSignalLoop() {
    if (signalLoopInterval) {
        clearInterval(signalLoopInterval);
        signalLoopInterval = null;
    }
    isRunning = false;
    console.log('[SERVER] Signal loop stopped');
}

fetcher.connect();
startSignalLoop();

server.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('QUOTEX AI SIGNAL BOT');
    console.log('='.repeat(50));
    console.log(`Server running on port ${PORT}`);
    console.log(`Data source: Yahoo Finance`);
    console.log(`Default pair: ${activePair}`);
    console.log(`Signal interval: 60 seconds`);
    console.log(`AI: Groq Llama 3.3 70B`);
    console.log('='.repeat(50) + '\n');
});

process.on('SIGTERM', () => {
    console.log('[SERVER] Shutting down...');
    stopSignalLoop();
    fetcher.disconnect();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[SERVER] Shutting down...');
    stopSignalLoop();
    fetcher.disconnect();
    process.exit(0);
});

module.exports = { app, server, io };
