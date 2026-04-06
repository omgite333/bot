/**
 * fetcher.js - Real-time data fetcher using Yahoo Finance
 * Free, no API key required
 */

const axios = require('axios');

const YAHOO_SYMBOLS = {
    'EURUSD': 'EURUSD=X',
    'GBPUSD': 'GBPUSD=X',
    'USDJPY': 'USDJPY=X',
    'AUDUSD': 'AUDUSD=X',
    'EURGBP': 'EURGBP=X',
    'USDCAD': 'USDCAD=X',
    'EURJPY': 'EURJPY=X',
    'BTCUSD': 'BTC-USD',
    'ETHUSD': 'ETH-USD',
    'EURUSD_OTC': 'EURUSD=X'
};

const POLL_INTERVAL = 15000;
const HISTORY_DAYS = 2;

let isRunning = false;
let tickCallbacks = [];
let statusCallbacks = [];
let status = 'DISCONNECTED';
let pollInterval = null;
let lastPrices = {};

function getStatus() {
    return status;
}

function notifyStatus(newStatus) {
    status = newStatus;
    statusCallbacks.forEach(cb => {
        try {
            cb(newStatus);
        } catch (e) {}
    });
}

function notifyTick(tick) {
    tickCallbacks.forEach(cb => {
        try {
            cb(tick);
        } catch (e) {
            console.error('[FETCHER] Tick callback error:', e.message);
        }
    });
}

async function fetchYahooHistory(symbol) {
    try {
        const yahooSymbol = YAHOO_SYMBOLS[symbol] || symbol;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`;
        
        const response = await axios.get(url, {
            params: {
                interval: '1m',
                range: `${HISTORY_DAYS}d`
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        const data = response.data;
        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const timestamps = result.timestamp || [];
            const quotes = result.indicators.quote[0] || {};
            
            const candles = [];
            for (let i = 0; i < timestamps.length; i++) {
                const timestamp = timestamps[i] * 1000;
                const open = quotes.open[i];
                const high = quotes.high[i];
                const low = quotes.low[i];
                const close = quotes.close[i];
                
                if (open && high && low && close && !isNaN(open)) {
                    candles.push({
                        timestamp,
                        datetime: new Date(timestamp).toISOString(),
                        open: parseFloat(open),
                        high: parseFloat(high),
                        low: parseFloat(low),
                        close: parseFloat(close),
                        volume: quotes.volume ? (quotes.volume[i] || 0) : 0,
                        complete: true
                    });
                }
            }
            
            console.log(`[FETCHER] Fetched ${candles.length} candles for ${symbol}`);
            return candles;
        }
        return [];
    } catch (error) {
        console.error(`[FETCHER] Error fetching ${symbol}:`, error.message);
        return [];
    }
}

async function fetchYahooQuote(symbol) {
    try {
        const yahooSymbol = YAHOO_SYMBOLS[symbol] || symbol;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`;
        
        const response = await axios.get(url, {
            params: {
                interval: '1m',
                range: '5d'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        const data = response.data;
        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const timestamps = result.timestamp || [];
            const quotes = result.indicators.quote[0] || {};
            
            const lastIndex = timestamps.length - 1;
            
            return {
                asset: symbol,
                price: parseFloat(meta.regularMarketPrice || meta.previousClose),
                time: timestamps[lastIndex],
                previousClose: parseFloat(meta.previousClose),
                open: quotes.open ? parseFloat(quotes.open[lastIndex]) : null,
                high: quotes.high ? parseFloat(quotes.high[lastIndex]) : null,
                low: quotes.low ? parseFloat(quotes.low[lastIndex]) : null
            };
        }
        return null;
    } catch (error) {
        console.error(`[FETCHER] Error fetching quote ${symbol}:`, error.message);
        return null;
    }
}

async function fetchAllQuotes() {
    const symbols = Object.keys(YAHOO_SYMBOLS);
    let hasData = false;
    
    for (const symbol of symbols) {
        try {
            const quote = await fetchYahooQuote(symbol);
            if (quote && quote.price) {
                hasData = true;
                lastPrices[symbol] = quote.price;
                notifyTick({ type: 'quote', ...quote });
            }
        } catch (e) {
            console.error(`[FETCHER] Error: ${e.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return hasData;
}

async function fetchAllHistory() {
    const symbols = Object.keys(YAHOO_SYMBOLS);
    const allHistory = {};
    
    for (const symbol of symbols) {
        const candles = await fetchYahooHistory(symbol);
        if (candles.length > 0) {
            allHistory[symbol] = candles;
            notifyTick({
                type: 'history',
                asset: symbol,
                candles: candles
            });
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return allHistory;
}

async function pollData() {
    if (!isRunning) return;
    
    try {
        await fetchAllQuotes();
    } catch (error) {
        console.error('[FETCHER] Poll error:', error.message);
    }
}

async function connect() {
    if (isRunning) return;
    
    isRunning = true;
    notifyStatus('CONNECTING');
    console.log('[FETCHER] Connecting to Yahoo Finance...');
    
    try {
        notifyStatus('FETCHING_HISTORY');
        const history = await fetchAllHistory();
        
        if (Object.keys(history).length === 0) {
            console.error('[FETCHER] Failed to fetch any historical data');
            notifyStatus('ERROR');
            return;
        }
        
        notifyStatus('CONNECTED');
        console.log('[FETCHER] Connected! Starting polling...');
        
        await fetchAllQuotes();
        
        pollInterval = setInterval(pollData, POLL_INTERVAL);
        
    } catch (error) {
        console.error('[FETCHER] Connection error:', error.message);
        notifyStatus('ERROR');
    }
}

function disconnect() {
    isRunning = false;
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    notifyStatus('DISCONNECTED');
    console.log('[FETCHER] Disconnected');
}

function onTick(callback) {
    if (typeof callback === 'function') {
        tickCallbacks.push(callback);
    }
}

function onStatusChange(callback) {
    if (typeof callback === 'function') {
        statusCallbacks.push(callback);
    }
}

function removeTickCallback(callback) {
    const index = tickCallbacks.indexOf(callback);
    if (index > -1) {
        tickCallbacks.splice(index, 1);
    }
}

function getLastPrice(symbol) {
    return lastPrices[symbol] || null;
}

function getAllPrices() {
    return { ...lastPrices };
}

module.exports = {
    connect,
    disconnect,
    onTick,
    onStatusChange,
    removeTickCallback,
    getStatus,
    getLastPrice,
    getAllPrices,
    fetchYahooHistory,
    fetchYahooQuote
};
