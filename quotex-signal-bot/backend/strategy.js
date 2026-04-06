/**
 * strategy.js - Core Signal Generation Engine
 * Generates trading signals using 6 technical indicators with balanced accuracy rules
 */

// Balanced threshold constants
const THRESHOLDS = {
    STRONG_SIGNAL: 60,      // Score >= 60 = STRONG (was 75)
    WEAK_SIGNAL: 45,        // Score 45-59 = WEAK (was 55)
    MIN_INDICATORS: 3,      // At least 3 out of 6 must agree
    RANGING_SCORE: 70,      // Ranging 5min needs 70+ score (relaxed from 80)
    CONSECUTIVE_BLOCK: 40,  // Consecutive bias max score (relaxed from 40)
    EXHAUSTION_MAX: 50     // Exhaustion block max score (relaxed from 50)
};

const technicalIndicators = require('technicalindicators');
const filters = require('./filters');
const state = require('./state');

// Minimum candles required for reliable calculation
const MIN_CANDLES = 30;

/**
 * Main signal generation function
 * Orchestrates all indicators, filters, and rules
 * @param {Array} candles1m - 1-minute candles
 * @param {Array} candles5m - 5-minute candles
 * @param {string} pair - Trading pair name
 * @returns {Object} - Complete signal object
 */
function generateSignal(candles1m, candles5m, pair) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[STRATEGY] Generating signal for ${pair}`);
    console.log(`${'='.repeat(60)}`);

    const timestamp = new Date().toISOString();
    const result = createEmptySignal(pair, timestamp);

    // RULE 7: Minimum data check
    if (!filters.hasMinimumData(candles1m, MIN_CANDLES)) {
        console.log('[STRATEGY] FAIL: Insufficient 1min data');
        result.filters = getFilterStatus(candles1m, candles5m, pair);
        return result;
    }

    // Get closing prices for 1m candles
    const closingPrices = candles1m.map(c => c.close);

    // STEP 1: Check ranging market (Rule 4)
    const rangingCheck = filters.detectRangingMarket(candles1m);
    result.filters.isRanging = rangingCheck.isRanging;
    
    if (rangingCheck.isRanging) {
        console.log('[STRATEGY] FAIL: Market is ranging');
        result.filters = getFilterStatus(candles1m, candles5m, pair);
        return result;
    }

    // STEP 2: Check consecutive bias (Rule 1) - block after 5 same signals
    const isBiased = filters.checkConsecutiveBias(pair, 'UP', state) || 
                     filters.checkConsecutiveBias(pair, 'DOWN', state);
    result.filters.consecutiveBias = isBiased;

    // STEP 3: Get 5-minute trend
    const trend5m = filters.getMarketTrend5m(candles5m);
    result.filters.trend5m = trend5m.trend;

    // STEP 4: Calculate all indicators
    const rsiResult = calculateRSI(closingPrices);
    const emaResult = calculateEMA(closingPrices);
    const macdResult = calculateMACD(closingPrices);
    const stochResult = calculateStochasticRSI(closingPrices);
    const bbResult = calculateBollingerBands(closingPrices);
    const patternResult = detectCandlePattern(candles1m);

    // Check for reversal (Rule 5)
    const reversalDetected = filters.detectReversal(candles1m, rsiResult.value);
    result.filters.reversalDetected = !!reversalDetected;

    // STEP 5: Check RSI exhaustion (Rule 2)
    // RSI < 20 blocks DOWN, RSI > 80 blocks UP (relaxed from 25/75)
    const exhaustion = filters.checkRSIExhaustion(rsiResult.value);

    // STEP 6: Check doji candle (Rule 6)
    const isDoji = filters.isDojiCandle(candles1m);

    // Build indicators object
    result.indicators = {
        rsi: rsiResult,
        ema: emaResult,
        macd: macdResult,
        stochRSI: stochResult,
        bollingerBands: bbResult,
        candlePattern: patternResult
    };

    // Calculate total score
    let totalScore = 0;
    let agreeingIndicators = 0;
    let currentDirection = 'WAIT';

    // Collect all indicator signals for direction determination
    const indicatorSignals = [
        rsiResult.signal,
        emaResult.signal,
        macdResult.signal,
        stochResult.signal,
        bbResult.signal,
        patternResult.signal
    ];

    // Count how many agree on a direction
    const upSignals = indicatorSignals.filter(s => s === 'UP').length;
    const downSignals = indicatorSignals.filter(s => s === 'DOWN').length;

    // Determine overall direction based on majority
    if (upSignals > downSignals && upSignals >= THRESHOLDS.MIN_INDICATORS) {
        currentDirection = 'UP';
        agreeingIndicators = upSignals;
    } else if (downSignals > upSignals && downSignals >= THRESHOLDS.MIN_INDICATORS) {
        currentDirection = 'DOWN';
        agreeingIndicators = downSignals;
    }

    // BASE INDICATORS (max 60 points)
    
    // RSI (15 points max)
    if (rsiResult.points > 0) {
        totalScore += rsiResult.points;
    }

    // EMA crossover (15 points max)
    if (emaResult.points > 0) {
        totalScore += emaResult.points;
    }

    // MACD (15 points max)
    if (macdResult.points > 0) {
        totalScore += macdResult.points;
    }

    // Stochastic RSI (15 points max)
    if (stochResult.points > 0) {
        totalScore += stochResult.points;
    }

    // BONUS INDICATORS (max 40 points)
    
    // Bollinger Bands (10 points)
    if (bbResult.points > 0) {
        totalScore += bbResult.points;
    }

    // Candle pattern (10 points)
    if (patternResult.points > 0) {
        totalScore += patternResult.points;
    }

    // 5min trend alignment (15 points)
    if (trend5m.bonus > 0) {
        totalScore += trend5m.bonus;
    }

    // Market session (5 points)
    const session = filters.isMarketSession();
    result.filters.marketSession = session.isActive;
    if (session.bonus > 0) {
        totalScore += session.bonus;
    }

    // STEP 7: Apply penalties

    // Trend alignment penalty (Rule 3)
    let trendPenalty = 0;
    if (currentDirection !== 'WAIT') {
        if (trend5m.trend === 'UPTREND' && currentDirection === 'DOWN') {
            trendPenalty = -10; // Reduced penalty (was -15)
            console.log('[STRATEGY] PENALTY: Signal against 5min UPTREND');
        } else if (trend5m.trend === 'DOWNTREND' && currentDirection === 'UP') {
            trendPenalty = -10; // Reduced penalty (was -15)
            console.log('[STRATEGY] PENALTY: Signal against 5min DOWNTREND');
        }
        totalScore += trendPenalty;
    }

    // Doji penalty (Rule 6) - reduced penalty
    if (isDoji) {
        totalScore -= 5; // Reduced from -10
        console.log('[STRATEGY] PENALTY: Doji candle detected');
    }

    // Session penalty for forex outside hours (Rule 8)
    // Outside session: -5 points (relaxed from -15)
    const sessionPenalty = filters.getSessionPenalty(pair, session.isActive);
    totalScore += sessionPenalty;
    if (sessionPenalty < 0) {
        console.log(`[STRATEGY] PENALTY: Forex outside session (${sessionPenalty})`);
    }

    // STEP 8: Apply RSI exhaustion blocks (Rule 2)
    // RSI < 20 blocks DOWN, RSI > 80 blocks UP (relaxed from 25/75)
    if (exhaustion.status === 'EXHAUSTED_DOWN' && currentDirection === 'DOWN') {
        currentDirection = 'WAIT';
        totalScore = Math.min(totalScore, THRESHOLDS.EXHAUSTION_MAX);
        console.log('[STRATEGY] BLOCKED: RSI exhaustion - DOWN blocked');
    }

    if (exhaustion.status === 'EXHAUSTED_UP' && currentDirection === 'UP') {
        currentDirection = 'WAIT';
        totalScore = Math.min(totalScore, THRESHOLDS.EXHAUSTION_MAX);
        console.log('[STRATEGY] BLOCKED: RSI exhaustion - UP blocked');
    }

    // Relaxed ranging 5min requirement (70+ instead of 80+)
    if (trend5m.trend === 'RANGING' && currentDirection !== 'WAIT') {
        if (totalScore < THRESHOLDS.RANGING_SCORE) {
            currentDirection = 'WAIT';
            console.log(`[STRATEGY] BLOCKED: Ranging 5min, requires ${THRESHOLDS.RANGING_SCORE}+ score`);
        }
    }

    // STEP 9: Apply reversal override (Rule 5)
    if (reversalDetected) {
        currentDirection = reversalDetected;
        totalScore = Math.min(100, totalScore + 20); // Reversal bonus
        console.log(`[STRATEGY] REVERSAL OVERRIDE: ${reversalDetected}`);
    }

    // Apply consecutive bias filter (5+ same signals blocks)
    if (isBiased) {
        currentDirection = 'WAIT';
        totalScore = Math.min(totalScore, THRESHOLDS.CONSECUTIVE_BLOCK);
        console.log('[STRATEGY] BLOCKED: Consecutive bias (5+ same signals)');
    }

    // STEP 10: Determine final direction and strength
    // Balanced thresholds: >=60 STRONG, 45-59 WEAK, <45 WAIT
    result.direction = currentDirection;
    
    if (currentDirection === 'WAIT') {
        result.strength = 'WAIT';
    } else if (totalScore >= THRESHOLDS.STRONG_SIGNAL) {
        result.strength = 'STRONG';
    } else if (totalScore >= THRESHOLDS.WEAK_SIGNAL) {
        result.strength = 'WEAK';
    } else {
        result.direction = 'WAIT';
        result.strength = 'WAIT';
    }

    result.confidence = Math.max(0, Math.min(100, Math.round(totalScore)));

    // Final filter status
    result.filters = getFilterStatus(candles1m, candles5m, pair);

    // Apply exhaustion status to output
    if (exhaustion.status !== 'NORMAL') {
        result.filters.rsiExhaustion = exhaustion.status;
    }

    console.log(`\n[STRATEGY] FINAL: ${result.direction} | ${result.strength} | ${result.confidence}%`);
    console.log(`[STRATEGY] Agreeing indicators: ${agreeingIndicators}/6`);
    console.log(`${'='.repeat(60)}\n`);

    // Update state with new signal
    state.addSignal(pair, {
        direction: result.direction,
        strength: result.strength,
        confidence: result.confidence,
        timestamp: timestamp
    });

    return result;
}

/**
 * Calculate RSI indicator
 * @param {Array} prices - Closing prices array
 * @returns {Object} - RSI result with signal and points
 */
function calculateRSI(prices) {
    try {
        const period = 14;
        const rsiValues = technicalIndicators.RSI.calculate({
            values: prices,
            period: period
        });

        const rsiValue = rsiValues[rsiValues.length - 1];
        let signal = 'NEUTRAL';
        let points = 0;

        // UP: RSI < 40 (oversold - expect bounce)
        if (rsiValue < 40) {
            signal = 'UP';
            points = 15;
        }
        // DOWN: RSI > 60 (overbought - expect drop)
        else if (rsiValue > 60) {
            signal = 'DOWN';
            points = 15;
        }

        return {
            value: parseFloat(rsiValue.toFixed(2)),
            signal: signal,
            points: points
        };
    } catch (error) {
        console.error('[STRATEGY] RSI calculation error:', error.message);
        return { value: null, signal: 'NEUTRAL', points: 0 };
    }
}

/**
 * Calculate EMA crossover (EMA9 vs EMA21)
 * @param {Array} prices - Closing prices array
 * @returns {Object} - EMA result with signal, crossover flag, and points
 */
function calculateEMA(prices) {
    try {
        // Calculate EMA9
        const ema9Values = technicalIndicators.EMA.calculate({
            values: prices,
            period: 9
        });

        // Calculate EMA21
        const ema21Values = technicalIndicators.EMA.calculate({
            values: prices,
            period: 21
        });

        const ema9 = ema9Values[ema9Values.length - 1];
        const ema21 = ema21Values[ema21Values.length - 1];

        // Check for crossover (need previous values)
        let crossover = false;
        if (ema9Values.length >= 2) {
            const prevEma9 = ema9Values[ema9Values.length - 2];
            const prevEma21 = ema21Values[ema21Values.length - 2];
            
            // Bullish crossover: was below, now above
            if (prevEma9 <= prevEma21 && ema9 > ema21) {
                crossover = true;
            }
            // Bearish crossover: was above, now below
            else if (prevEma9 >= prevEma21 && ema9 < ema21) {
                crossover = true;
            }
        }

        let signal = 'NEUTRAL';
        let points = 0;

        if (ema9 > ema21) {
            signal = 'UP';
            points = crossover ? 15 : 10; // Extra points for crossover
        } else if (ema9 < ema21) {
            signal = 'DOWN';
            points = crossover ? 15 : 10;
        }

        return {
            ema9: parseFloat(ema9.toFixed(5)),
            ema21: parseFloat(ema21.toFixed(5)),
            crossover: crossover,
            signal: signal,
            points: points
        };
    } catch (error) {
        console.error('[STRATEGY] EMA calculation error:', error.message);
        return { ema9: null, ema21: null, crossover: false, signal: 'NEUTRAL', points: 0 };
    }
}

/**
 * Calculate MACD indicator
 * @param {Array} prices - Closing prices array
 * @returns {Object} - MACD result with histogram and points
 */
function calculateMACD(prices) {
    try {
        const macdValues = technicalIndicators.MACD.calculate({
            values: prices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });

        if (!macdValues || macdValues.length === 0) {
            return { macd: null, signal_line: null, histogram: null, histogramRising: false, signal: 'NEUTRAL', points: 0 };
        }

        const current = macdValues[macdValues.length - 1];
        const macd = current.MACD;
        const signalLine = current.signal;

        // Calculate histogram
        const histogram = macd - signalLine;

        // Check if histogram is increasing
        let histogramRising = false;
        if (macdValues.length >= 2) {
            const prev = macdValues[macdValues.length - 2];
            const prevHistogram = prev.MACD - prev.signal;
            histogramRising = histogram > prevHistogram;
        }

        let signal = 'NEUTRAL';
        let points = 0;

        // UP: MACD > signal line AND histogram increasing
        if (macd > signalLine) {
            signal = 'UP';
            points = histogramRising ? 15 : 10;
        }
        // DOWN: MACD < signal line AND histogram decreasing
        else if (macd < signalLine) {
            signal = 'DOWN';
            points = !histogramRising ? 15 : 10;
        }

        return {
            macd: parseFloat(macd.toFixed(5)),
            signal_line: parseFloat(signalLine.toFixed(5)),
            histogram: parseFloat(histogram.toFixed(5)),
            histogramRising: histogramRising,
            signal: signal,
            points: points
        };
    } catch (error) {
        console.error('[STRATEGY] MACD calculation error:', error.message);
        return { macd: null, signal_line: null, histogram: null, histogramRising: false, signal: 'NEUTRAL', points: 0 };
    }
}

/**
 * Calculate Stochastic RSI indicator
 * @param {Array} prices - Closing prices array
 * @returns {Object} - Stochastic RSI result with K, D and points
 */
function calculateStochasticRSI(prices) {
    try {
        const stochRSIValues = technicalIndicators.StochasticRSI.calculate({
            values: prices,
            period: 14,
            smoothK: 3,
            smoothD: 3
        });

        if (!stochRSIValues || stochRSIValues.length === 0) {
            return { k: null, d: null, signal: 'NEUTRAL', points: 0 };
        }

        const current = stochRSIValues[stochRSIValues.length - 1];
        const k = current.k;
        const d = current.d;

        let signal = 'NEUTRAL';
        let points = 0;

        // UP: K < 20 (oversold)
        if (k < 20) {
            signal = 'UP';
            points = 15;
        }
        // DOWN: K > 80 (overbought)
        else if (k > 80) {
            signal = 'DOWN';
            points = 15;
        }

        return {
            k: parseFloat(k.toFixed(2)),
            d: parseFloat(d.toFixed(2)),
            signal: signal,
            points: points
        };
    } catch (error) {
        console.error('[STRATEGY] Stochastic RSI calculation error:', error.message);
        return { k: null, d: null, signal: 'NEUTRAL', points: 0 };
    }
}

/**
 * Calculate Bollinger Bands indicator
 * @param {Array} prices - Closing prices array
 * @returns {Object} - Bollinger Bands result with position and points
 */
function calculateBollingerBands(prices) {
    try {
        const bbValues = technicalIndicators.BollingerBands.calculate({
            values: prices,
            period: 20,
            stdDev: 2
        });

        if (!bbValues || bbValues.length === 0) {
            return { upper: null, middle: null, lower: null, position: null, signal: 'NEUTRAL', points: 0 };
        }

        const current = bbValues[bbValues.length - 1];
        const latestPrice = prices[prices.length - 1];

        // Calculate position: 0 = at lower band, 100 = at upper band
        const bandRange = current.upper - current.lower;
        const position = bandRange > 0 ? ((latestPrice - current.lower) / bandRange) * 100 : 50;

        let signal = 'NEUTRAL';
        let points = 0;

        // UP: Price near/below lower band
        if (position < 20) {
            signal = 'UP';
            points = 10;
        }
        // DOWN: Price near/above upper band
        else if (position > 80) {
            signal = 'DOWN';
            points = 10;
        }

        return {
            upper: parseFloat(current.upper.toFixed(5)),
            middle: parseFloat(current.middle.toFixed(5)),
            lower: parseFloat(current.lower.toFixed(5)),
            position: parseFloat(position.toFixed(2)),
            signal: signal,
            points: points
        };
    } catch (error) {
        console.error('[STRATEGY] Bollinger Bands calculation error:', error.message);
        return { upper: null, middle: null, lower: null, position: null, signal: 'NEUTRAL', points: 0 };
    }
}

/**
 * Detect candlestick patterns
 * @param {Array} candles - Array of candle objects
 * @returns {Object} - Pattern detection result
 */
function detectCandlePattern(candles) {
    try {
        if (!candles || candles.length < 2) {
            return { pattern: 'NONE', signal: 'NEUTRAL', points: 0 };
        }

        const current = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        const currentBody = Math.abs(current.close - current.open);
        const currentUpperWick = current.high - Math.max(current.open, current.close);
        const currentLowerWick = Math.min(current.open, current.close) - current.low;
        const currentRange = current.high - current.low;

        const prevBody = Math.abs(previous.close - previous.open);
        const prevGreen = previous.close > previous.open;
        const currentGreen = current.close > current.open;

        let pattern = 'NONE';
        let signal = 'NEUTRAL';
        let points = 0;

        // Hammer: lower wick > 2x body, small upper wick
        if (currentLowerWick > currentBody * 2 && currentUpperWick < currentBody * 0.5 && currentRange > 0) {
            pattern = 'HAMMER';
            signal = 'UP';
            points = 10;
        }
        // Shooting Star: upper wick > 2x body, small lower wick
        else if (currentUpperWick > currentBody * 2 && currentLowerWick < currentBody * 0.5 && currentRange > 0) {
            pattern = 'SHOOTING_STAR';
            signal = 'DOWN';
            points = 10;
        }
        // Bullish Engulfing: current green body > previous red body
        else if (currentGreen && !prevGreen && currentBody > prevBody && current.close > previous.open && current.open < previous.close) {
            pattern = 'BULLISH_ENGULFING';
            signal = 'UP';
            points = 10;
        }
        // Bearish Engulfing: current red body > previous green body
        else if (!currentGreen && prevGreen && currentBody > prevBody && current.open > previous.close && current.close < previous.open) {
            pattern = 'BEARISH_ENGULFING';
            signal = 'DOWN';
            points = 10;
        }
        // Doji: body < 10% of range
        else if (currentRange > 0 && currentBody / currentRange < 0.10) {
            pattern = 'DOJI';
            signal = 'NEUTRAL';
            points = 0;
        }

        return { pattern, signal, points };
    } catch (error) {
        console.error('[STRATEGY] Candle pattern detection error:', error.message);
        return { pattern: 'NONE', signal: 'NEUTRAL', points: 0 };
    }
}

/**
 * Creates empty signal object with defaults
 * @param {string} pair - Trading pair
 * @param {string} timestamp - ISO timestamp
 * @returns {Object} - Empty signal object
 */
function createEmptySignal(pair, timestamp) {
    return {
        direction: 'WAIT',
        strength: 'WAIT',
        confidence: 0,
        indicators: {
            rsi: { value: null, signal: 'NEUTRAL', points: 0 },
            ema: { ema9: null, ema21: null, crossover: false, signal: 'NEUTRAL', points: 0 },
            macd: { macd: null, signal_line: null, histogram: null, histogramRising: false, signal: 'NEUTRAL', points: 0 },
            stochRSI: { k: null, d: null, signal: 'NEUTRAL', points: 0 },
            bollingerBands: { upper: null, middle: null, lower: null, position: null, signal: 'NEUTRAL', points: 0 },
            candlePattern: { pattern: 'NONE', signal: 'NEUTRAL', points: 0 }
        },
        filters: {
            marketSession: false,
            trend5m: 'RANGING',
            isRanging: false,
            reversalDetected: false,
            consecutiveBias: false
        },
        timestamp: timestamp,
        pair: pair
    };
}

/**
 * Gets comprehensive filter status
 * @param {Array} candles1m - 1-minute candles
 * @param {Array} candles5m - 5-minute candles
 * @param {string} pair - Trading pair
 * @returns {Object} - Filter status object
 */
function getFilterStatus(candles1m, candles5m, pair) {
    const session = filters.isMarketSession();
    const ranging = filters.detectRangingMarket(candles1m);
    const trend = filters.getMarketTrend5m(candles5m);
    const reversal = filters.detectReversal(candles1m, null);
    const bias = filters.checkConsecutiveBias(pair, 'UP', state) || 
                 filters.checkConsecutiveBias(pair, 'DOWN', state);

    return {
        marketSession: session.isActive,
        trend5m: trend.trend,
        isRanging: ranging.isRanging,
        reversalDetected: !!reversal,
        consecutiveBias: !!bias
    };
}

module.exports = { generateSignal };
