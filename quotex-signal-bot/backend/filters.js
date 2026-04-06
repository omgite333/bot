/**
 * filters.js - Market Filters
 * Applies market session, trend, and pattern filters
 * Never blocks signals, only adjusts confidence
 */

const technicalIndicators = require('technicalindicators');

function getSessionBonus(pair) {
    const utcHour = new Date().getUTCHours();
    const isCrypto = pair.includes('BTC') || pair.includes('ETH') || pair.includes('OTC');
    if (isCrypto) {
        return 5;
    }
    const londonSession = utcHour >= 6 && utcHour < 17;
    const nySession = utcHour >= 12 && utcHour < 22;
    if (londonSession || nySession) {
        return 5;
    }
    return -5;
}

function getRangingPenalty(candles) {
    if (!candles || candles.length < 20) {
        return 0;
    }
    const closes = candles.map(c => c.close);
    const bb = technicalIndicators.BollingerBands.calculate({
        values: closes,
        period: 20,
        stdDev: 2
    });
    if (!bb || bb.length === 0) {
        return 0;
    }
    const latest = bb[bb.length - 1];
    const middle = latest.middle;
    const width = ((latest.upper - latest.lower) / middle) * 100;
    if (width < 0.05) {
        return -10;
    }
    return 0;
}

function getConsecutivePenalty(pair, direction, state) {
    const consecutive = state.getConsecutiveCount(pair);
    if (consecutive.direction === direction && consecutive.count >= 5) {
        return -10;
    }
    return 0;
}

function getExhaustionBonus(rsiValue, direction) {
    if (rsiValue < 20 && direction === 'BUY') {
        return 15;
    }
    if (rsiValue > 80 && direction === 'SELL') {
        return 15;
    }
    return 0;
}

function getReversalBonus(candles, rsiValue, direction) {
    if (!candles || candles.length < 4) {
        return 0;
    }
    const last4 = candles.slice(-4);
    const last3 = last4.slice(0, 3);
    const current = last4[last4.length - 1];
    const currentGreen = current.close > current.open;
    const last3Red = last3.every(c => c.close < c.open);
    const last3Green = last3.every(c => c.close > c.open);
    if (last3Red && rsiValue < 25 && currentGreen && direction === 'BUY') {
        return 15;
    }
    if (last3Green && rsiValue > 75 && !currentGreen && direction === 'SELL') {
        return 15;
    }
    return 0;
}

function getTrendBonus(candles, direction) {
    if (!candles || candles.length < 25) {
        return 0;
    }
    const closes = candles.map(c => c.close).slice(-25);
    const ema9 = technicalIndicators.EMA.calculate({ values: closes, period: 9 });
    const ema21 = technicalIndicators.EMA.calculate({ values: closes, period: 21 });
    if (ema9.length < 1 || ema21.length < 1) {
        return 0;
    }
    const ema9Current = ema9[ema9.length - 1];
    const ema21Current = ema21[ema21.length - 1];
    const trendUp = ema9Current > ema21Current;
    if ((trendUp && direction === 'BUY') || (!trendUp && direction === 'SELL')) {
        return 10;
    }
    return -10;
}

function applyFilters(candles, pair, direction, rsiValue, state) {
    const sessionBonus = getSessionBonus(pair);
    const rangingPenalty = getRangingPenalty(candles);
    const consecutivePenalty = getConsecutivePenalty(pair, direction, state);
    const exhaustionBonus = getExhaustionBonus(rsiValue, direction);
    const reversalBonus = getReversalBonus(candles, rsiValue, direction);
    const trendBonus = getTrendBonus(candles, direction);
    const total = sessionBonus + rangingPenalty + consecutivePenalty + exhaustionBonus + reversalBonus + trendBonus;
    return {
        sessionBonus,
        rangingPenalty,
        consecutivePenalty,
        exhaustionBonus,
        reversalBonus,
        trendBonus,
        total: Math.max(-30, Math.min(30, total))
    };
}

module.exports = {
    getSessionBonus,
    getRangingPenalty,
    getConsecutivePenalty,
    getExhaustionBonus,
    getReversalBonus,
    getTrendBonus,
    applyFilters
};
