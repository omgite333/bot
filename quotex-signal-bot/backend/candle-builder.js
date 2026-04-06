/**
 * candle-builder.js - Builds OHLCV candles from tick data
 * Supports both real-time and historical data
 */

const candles = new Map();
const MAX_CANDLES = 200;
const MINUTE_MS = 60000;

function getMinuteKey(timestamp) {
    if (typeof timestamp === 'number') {
        return Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
    }
    return Math.floor(new Date(timestamp).getTime() / MINUTE_MS) * MINUTE_MS;
}

function processTick(tick) {
    if (tick.type === 'history' && tick.candles) {
        tick.candles.forEach(candle => addCandle(tick.asset, candle));
        return;
    }
    
    if (tick.type === 'quote') {
        const symbol = tick.asset;
        const timestamp = tick.time * 1000;
        const minuteKey = getMinuteKey(timestamp);
        
        if (!candles.has(symbol)) {
            candles.set(symbol, []);
        }
        
        const symbolCandles = candles.get(symbol);
        const existingIndex = symbolCandles.findIndex(c => c.minuteKey === minuteKey);
        
        if (existingIndex === -1) {
            const newCandle = {
                open: tick.price,
                high: tick.high || tick.price,
                low: tick.low || tick.price,
                close: tick.price,
                volume: 1,
                timestamp: minuteKey,
                datetime: new Date(minuteKey).toISOString(),
                minuteKey: minuteKey,
                complete: false
            };
            symbolCandles.push(newCandle);
            if (symbolCandles.length > MAX_CANDLES) {
                symbolCandles.shift();
            }
        } else {
            const candle = symbolCandles[existingIndex];
            if (tick.high) candle.high = Math.max(candle.high, tick.high);
            if (tick.low) candle.low = Math.min(candle.low, tick.low);
            candle.close = tick.price;
            candle.volume += 1;
        }
        
        finalizeCandles(symbolCandles);
    }
}

function addCandle(symbol, candle) {
    if (!candles.has(symbol)) {
        candles.set(symbol, []);
    }
    
    const symbolCandles = candles.get(symbol);
    const minuteKey = getMinuteKey(candle.timestamp);
    
    const existingIndex = symbolCandles.findIndex(c => c.minuteKey === minuteKey);
    
    if (existingIndex === -1) {
        symbolCandles.push({
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume || 0,
            timestamp: minuteKey,
            datetime: candle.datetime || new Date(minuteKey).toISOString(),
            minuteKey: minuteKey,
            complete: true
        });
        
        symbolCandles.sort((a, b) => a.minuteKey - b.minuteKey);
        
        if (symbolCandles.length > MAX_CANDLES) {
            symbolCandles.shift();
        }
    }
}

function finalizeCandles(symbolCandles) {
    const now = Date.now();
    const currentMinuteKey = getMinuteKey(now);
    
    for (const candle of symbolCandles) {
        if (candle.minuteKey < currentMinuteKey && !candle.complete) {
            candle.complete = true;
        }
    }
}

function getCandles(symbol, count = 100) {
    const symbolCandles = candles.get(symbol) || [];
    return symbolCandles.slice(-count);
}

function getCompletedCandles(symbol, count = 100) {
    const symbolCandles = candles.get(symbol) || [];
    const completed = symbolCandles.filter(c => c.complete);
    return completed.slice(-count);
}

function getCurrentCandle(symbol) {
    const symbolCandles = candles.get(symbol) || [];
    if (symbolCandles.length === 0) return null;
    
    const currentMinuteKey = getMinuteKey(Date.now());
    return symbolCandles.find(c => c.minuteKey === currentMinuteKey) || null;
}

function getCandleCount(symbol) {
    const symbolCandles = candles.get(symbol) || [];
    return symbolCandles.length;
}

function isReady(symbol) {
    return getCandleCount(symbol) >= 20;
}

function getAllCandles(symbol) {
    return candles.get(symbol) || [];
}

function clearCandles(symbol) {
    candles.delete(symbol);
}

function getCandleData() {
    const result = {};
    candles.forEach((value, key) => {
        result[key] = value.length;
    });
    return result;
}

function initializeWithHistory(symbol, historicalCandles) {
    if (!historicalCandles || historicalCandles.length === 0) return;
    
    clearCandles(symbol);
    
    const now = Date.now();
    const currentMinuteKey = getMinuteKey(now);
    
    historicalCandles.forEach(candle => {
        const minuteKey = getMinuteKey(candle.timestamp);
        const complete = minuteKey < currentMinuteKey;
        
        candles.get(symbol).push({
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume || 0,
            timestamp: minuteKey,
            datetime: candle.datetime || new Date(minuteKey).toISOString(),
            minuteKey: minuteKey,
            complete: complete
        });
    });
    
    if (candles.has(symbol)) {
        candles.get(symbol).sort((a, b) => a.minuteKey - b.minuteKey);
    }
    
    console.log(`[CANDLE] Initialized ${historicalCandles.length} candles for ${symbol}`);
}

module.exports = {
    processTick,
    addCandle,
    getCandles,
    getCompletedCandles,
    getCurrentCandle,
    getCandleCount,
    isReady,
    getAllCandles,
    clearCandles,
    getCandleData,
    initializeWithHistory
};
