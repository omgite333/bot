/**
 * filters.js - Anti-Bias and Market Quality Filters
 * Implements all 8 accuracy rules for signal filtering
 */

const technicalIndicators = require('technicalindicators');

// Crypto pairs that trade 24/7
const CRYPTO_PAIRS = ['BTC/USD', 'BTCUSD', 'ETH/USD', 'ETHUSD'];

/**
 * Checks if current UTC time is within active trading sessions
 * @returns {Object} - { isActive: boolean, bonus: number }
 */
function isMarketSession() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const currentMinutes = utcHour * 60 + utcMinute;

    // London session: 07:00-16:00 UTC
    const LONDON_START = 7 * 60;
    const LONDON_END = 16 * 60;

    // New York session: 13:00-21:00 UTC
    const NY_START = 13 * 60;
    const NY_END = 21 * 60;

    const inLondon = currentMinutes >= LONDON_START && currentMinutes < LONDON_END;
    const inNY = currentMinutes >= NY_START && currentMinutes < NY_END;

    const isActive = inLondon || inNY;
    const bonus = isActive ? 5 : 0;

    return { isActive, bonus };
}

/**
 * Checks if market is ranging (too tight for signals)
 * Uses Bollinger Band width calculation
 * @param {Array} candles - Array of candle objects
 * @returns {Object} - { isRanging: boolean, bandWidth: number }
 */
function detectRangingMarket(candles) {
    try {
        if (!candles || candles.length < 20) {
            return { isRanging: false, bandWidth: 0 };
        }

        const closingPrices = candles.map(c => c.close);

        // Calculate Bollinger Bands (period 20, stddev 2)
        const bb = technicalIndicators.BollingerBands.calculate({
            values: closingPrices,
            period: 20,
            stdDev: 2
        });

        if (!bb || bb.length === 0) {
            return { isRanging: false, bandWidth: 0 };
        }

        const lastBB = bb[bb.length - 1];
        const bandWidth = ((lastBB.upper - lastBB.lower) / lastBB.middle) * 100;

        // If bandwidth < 0.1%, market is ranging
        const isRanging = bandWidth < 0.1;

        console.log(`[FILTERS] Bollinger Band Width: ${bandWidth.toFixed(4)}% (Ranging: ${isRanging})`);

        return { isRanging, bandWidth };
    } catch (error) {
        console.error('[FILTERS] Error detecting ranging market:', error.message);
        return { isRanging: false, bandWidth: 0 };
    }
}

/**
 * Checks for consecutive signal bias (Rule 1)
 * Prevents 3+ same direction signals in a row
 * @param {string} pair - Trading pair
 * @param {string} direction - Proposed signal direction
 * @param {Object} state - State module reference
 * @returns {boolean} - True if biased (should block signal)
 */
function checkConsecutiveBias(pair, direction, state) {
    try {
        const consecutive = state.getConsecutiveCount(pair);

        // If we have 3+ consecutive same direction, block signal
        if (consecutive.direction === direction && consecutive.count >= 3) {
            console.log(`[FILTERS] BLOCKED: Consecutive bias detected (${direction} x${consecutive.count})`);
            return true;
        }

        return false;
    } catch (error) {
        console.error('[FILTERS] Error checking consecutive bias:', error.message);
        return false;
    }
}

/**
 * Checks RSI exhaustion levels (Rule 2)
 * Prevents signals in extreme overbought/oversold
 * @param {number} rsiValue - RSI value
 * @returns {Object} - { status: string, canTrade: boolean }
 */
function checkRSIExhaustion(rsiValue) {
    if (rsiValue === null || rsiValue === undefined) {
        return { status: 'NORMAL', canTrade: true };
    }

    // Extreme exhaustion - potential reversal zones
    if (rsiValue < 25) {
        console.log(`[FILTERS] RSI Exhausted Down: ${rsiValue.toFixed(2)} (blocking DOWN signals)`);
        return { status: 'EXHAUSTED_DOWN', canTrade: true, blockDirection: 'DOWN' };
    }

    if (rsiValue > 75) {
        console.log(`[FILTERS] RSI Exhausted Up: ${rsiValue.toFixed(2)} (blocking UP signals)`);
        return { status: 'EXHAUSTED_UP', canTrade: true, blockDirection: 'UP' };
    }

    return { status: 'NORMAL', canTrade: true };
}

/**
 * Detects potential reversal patterns (Rule 5)
 * @param {Array} candles - Array of candle objects
 * @param {number} rsiValue - Current RSI value
 * @returns {string|null} - "UP", "DOWN", or null
 */
function detectReversal(candles, rsiValue) {
    try {
        if (!candles || candles.length < 4) {
            return null;
        }

        const last4 = candles.slice(-4);
        
        // Analyze last 3 candles for color pattern
        const colors = last4.slice(0, 3).map((c, i) => {
            const isGreen = c.close > c.open;
            return isGreen ? 'GREEN' : 'RED';
        });

        const currentCandle = last4[3];
        const currentGreen = currentCandle.close > currentCandle.open;

        // 3 red candles + RSI < 30 + current green = Potential UP reversal
        const allRed = colors.every(c => c === 'RED');
        if (allRed && currentGreen && rsiValue < 30) {
            console.log('[FILTERS] Reversal Detected: UP (3 red + oversold + green)');
            return 'UP';
        }

        // 3 green candles + RSI > 70 + current red = Potential DOWN reversal
        const allGreen = colors.every(c => c === 'GREEN');
        if (allGreen && !currentGreen && rsiValue > 70) {
            console.log('[FILTERS] Reversal Detected: DOWN (3 green + overbought + red)');
            return 'DOWN';
        }

        return null;
    } catch (error) {
        console.error('[FILTERS] Error detecting reversal:', error.message);
        return null;
    }
}

/**
 * Determines market trend from 5-minute candles (Rule 3)
 * @param {Array} candles5m - 5-minute candles
 * @returns {Object} - { trend: string, bonus: number }
 */
function getMarketTrend5m(candles5m) {
    try {
        if (!candles5m || candles5m.length < 21) {
            console.log('[FILTERS] 5min trend: INSUFFICIENT DATA');
            return { trend: 'RANGING', bonus: 0 };
        }

        const closingPrices = candles5m.map(c => c.close);

        // Calculate EMA9 and EMA21
        const ema9Values = technicalIndicators.EMA.calculate({
            values: closingPrices,
            period: 9
        });

        const ema21Values = technicalIndicators.EMA.calculate({
            values: closingPrices,
            period: 21
        });

        if (ema9Values.length === 0 || ema21Values.length === 0) {
            return { trend: 'RANGING', bonus: 0 };
        }

        const ema9 = ema9Values[ema9Values.length - 1];
        const ema21 = ema21Values[ema21Values.length - 1];
        const diff = Math.abs((ema9 - ema21) / ema21) * 100;

        let trend = 'RANGING';
        let bonus = 0;

        if (ema9 > ema21) {
            trend = 'UPTREND';
            bonus = 15;
        } else if (ema9 < ema21) {
            trend = 'DOWNTREND';
            bonus = 15;
        } else {
            trend = 'RANGING';
        }

        // If very close, treat as ranging (within 0.01%)
        if (diff < 0.01) {
            trend = 'RANGING';
            bonus = 5;
        }

        console.log(`[FILTERS] 5min Trend: ${trend} (EMA9: ${ema9.toFixed(5)}, EMA21: ${ema21.toFixed(5)})`);

        return { trend, bonus };
    } catch (error) {
        console.error('[FILTERS] Error calculating 5min trend:', error.message);
        return { trend: 'RANGING', bonus: 0 };
    }
}

/**
 * Checks if latest candle is a Doji (Rule 6)
 * @param {Array} candles - Array of candle objects
 * @returns {boolean} - True if latest candle is a doji
 */
function isDojiCandle(candles) {
    try {
        if (!candles || candles.length < 1) {
            return false;
        }

        const latest = candles[candles.length - 1];
        const range = latest.high - latest.low;
        
        if (range === 0) {
            return false;
        }

        const bodySize = Math.abs(latest.close - latest.open);
        const bodyRatio = bodySize / range;

        // Doji: body < 10% of total range
        const isDoji = bodyRatio < 0.10;

        if (isDoji) {
            console.log('[FILTERS] Doji candle detected - blocking signal');
        }

        return isDoji;
    } catch (error) {
        console.error('[FILTERS] Error checking doji:', error.message);
        return false;
    }
}

/**
 * Applies session penalty for forex pairs outside market hours
 * @param {string} pair - Trading pair name
 * @param {boolean} isActiveSession - Whether market is active
 * @returns {number} - Penalty points (negative)
 */
function getSessionPenalty(pair, isActiveSession) {
    // Crypto pairs have no session penalty (24/7)
    const isCrypto = CRYPTO_PAIRS.some(p => pair.includes(p.replace('/', '')));
    
    if (isCrypto) {
        return 0;
    }

    // Forex outside session gets -15 penalty
    return isActiveSession ? 0 : -15;
}

/**
 * Checks if we have minimum required data
 * @param {Array} candles - Array of candle objects
 * @param {number} minRequired - Minimum candles needed
 * @returns {boolean} - True if enough data
 */
function hasMinimumData(candles, minRequired = 30) {
    const hasData = candles && candles.length >= minRequired;
    
    if (!hasData) {
        console.log(`[FILTERS] Insufficient data: ${candles?.length || 0} < ${minRequired}`);
    }
    
    return hasData;
}

module.exports = {
    isMarketSession,
    detectRangingMarket,
    checkConsecutiveBias,
    checkRSIExhaustion,
    detectReversal,
    getMarketTrend5m,
    isDojiCandle,
    getSessionPenalty,
    hasMinimumData,
    CRYPTO_PAIRS
};
