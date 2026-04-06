/**
 * candle-builder.js - Builds OHLCV 1-minute candles from tick data
 * Groups ticks into 1-minute buckets for technical analysis
 */

const candles = new Map();
const MAX_CANDLES = 100;
const MINUTE_MS = 60000;

function getMinuteKey(timestamp) {
    return Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
}

function processTick(tick) {
    const symbol = tick.asset;
    const minuteKey = getMinuteKey(tick.time * 1000);
    if (!candles.has(symbol)) {
        candles.set(symbol, []);
    }
    const symbolCandles = candles.get(symbol);
    const existingIndex = symbolCandles.findIndex(c => c.minuteKey === minuteKey);
    if (existingIndex === -1) {
        const newCandle = {
            open: tick.price,
            high: tick.price,
            low: tick.price,
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
        candle.high = Math.max(candle.high, tick.price);
        candle.low = Math.min(candle.low, tick.price);
        candle.close = tick.price;
        candle.volume += 1;
    }
    finalizeCompletedCandles(symbolCandles);
}

function finalizeCompletedCandles(symbolCandles) {
    const now = Date.now();
    const currentMinuteKey = getMinuteKey(now);
    for (let i = 0; i < symbolCandles.length; i++) {
        const candle = symbolCandles[i];
        if (candle.minuteKey < currentMinuteKey && !candle.complete) {
            candle.complete = true;
        }
    }
}

function getCandles(symbol, count) {
    const symbolCandles = candles.get(symbol) || [];
    const completedCandles = symbolCandles.filter(c => c.complete);
    return completedCandles.slice(-count);
}

function getCurrentCandle(symbol) {
    const symbolCandles = candles.get(symbol) || [];
    if (symbolCandles.length === 0) return null;
    const currentMinuteKey = getMinuteKey(Date.now());
    const current = symbolCandles.find(c => c.minuteKey === currentMinuteKey);
    return current || null;
}

function getCandleCount(symbol) {
    const symbolCandles = candles.get(symbol) || [];
    return symbolCandles.filter(c => c.complete).length;
}

function isReady(symbol) {
    return getCandleCount(symbol) >= 30;
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
        result[key] = value.filter(c => c.complete).length;
    });
    return result;
}

module.exports = {
    processTick,
    getCandles,
    getCurrentCandle,
    getCandleCount,
    isReady,
    getAllCandles,
    clearCandles,
    getCandleData
};
