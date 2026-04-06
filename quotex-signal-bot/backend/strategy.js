/**
 * strategy.js - Technical Indicator Calculations
 * Calculates 6 technical indicators and returns BUY or SELL signal
 */

const technicalIndicators = require('technicalindicators');

function calculateIndicators(candles) {
    if (!candles || candles.length < 5) {
        return getFallbackIndicators(candles);
    }
    const closes = candles.map(c => c.close);
    const rsiResult = calculateRSI(closes);
    const emaResult = calculateEMACrossover(closes);
    const macdResult = calculateMACD(closes);
    const stochResult = calculateStochRSI(closes);
    const bollingerResult = calculateBollingerBands(closes);
    const patternResult = detectCandlePatterns(candles);
    const { buyPoints, sellPoints, baseScore, suggestedDirection, summary } = calculateScore(
        rsiResult,
        emaResult,
        macdResult,
        stochResult,
        bollingerResult,
        patternResult,
        candles
    );
    return {
        indicators: {
            rsi: rsiResult,
            ema: emaResult,
            macd: macdResult,
            stochRsi: stochResult,
            bollinger: bollingerResult,
            candlePattern: patternResult
        },
        buyPoints,
        sellPoints,
        baseScore,
        suggestedDirection,
        closes: closes.slice(-20),
        summary
    };
}

function calculateRSI(closes, period = 14) {
    const values = technicalIndicators.RSI.calculate({
        values: closes,
        period: period
    });
    const value = values.length > 0 ? values[values.length - 1] : 50;
    let signal = 'NEUTRAL';
    let points = 0;
    if (value < 40) {
        signal = 'BUY';
        points = 15;
    } else if (value > 60) {
        signal = 'SELL';
        points = 15;
    }
    return { value: Math.round(value * 100) / 100, signal, points };
}

function calculateEMACrossover(closes) {
    const period1 = 9;
    const period2 = 21;
    const ema9 = technicalIndicators.EMA.calculate({ values: closes, period: period1 });
    const ema21 = technicalIndicators.EMA.calculate({ values: closes, period: period2 });
    if (ema9.length < 2 || ema21.length < 2) {
        return { ema9: null, ema21: null, crossover: false, signal: 'NEUTRAL', points: 0 };
    }
    const ema9Current = ema9[ema9.length - 1];
    const ema9Prev = ema9[ema9.length - 2];
    const ema21Current = ema21[ema21.length - 1];
    const ema21Prev = ema21[ema21.length - 2];
    const crossover = (ema9Prev <= ema21Prev && ema9Current > ema21Current) ||
                      (ema9Prev >= ema21Prev && ema9Current < ema21Current);
    let signal = 'NEUTRAL';
    let points = 0;
    if (ema9Current > ema21Current) {
        signal = 'BUY';
        points = 15;
    } else if (ema9Current < ema21Current) {
        signal = 'SELL';
        points = 15;
    }
    if (crossover && points > 0) {
        points += 5;
    }
    return {
        ema9: Math.round(ema9Current * 100000) / 100000,
        ema21: Math.round(ema21Current * 100000) / 100000,
        crossover,
        signal,
        points
    };
}

function calculateMACD(closes) {
    const result = technicalIndicators.MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    });
    if (result.length === 0) {
        return { macd: null, signal_line: null, histogram: null, signal: 'NEUTRAL', points: 0 };
    }
    const latest = result[result.length - 1];
    const macd = latest.MACD || 0;
    const signalLine = latest.signal || 0;
    const histogram = latest.histogram || 0;
    let signal = 'NEUTRAL';
    let points = 0;
    if (macd > signalLine && histogram > 0) {
        signal = 'BUY';
        points = 15;
    } else if (macd < signalLine && histogram < 0) {
        signal = 'SELL';
        points = 15;
    }
    return {
        macd: Math.round(macd * 100000) / 100000,
        signal_line: Math.round(signalLine * 100000) / 100000,
        histogram: Math.round(histogram * 100000) / 100000,
        signal,
        points
    };
}

function calculateStochRSI(closes, period = 14) {
    const values = technicalIndicators.StochasticRSI.calculate({
        values: closes,
        rsiPeriod: period,
        stochasticPeriod: period,
        kPeriod: 3,
        dPeriod: 3
    });
    if (values.length === 0) {
        return { k: null, d: null, signal: 'NEUTRAL', points: 0 };
    }
    const latest = values[values.length - 1];
    const k = latest.k || 50;
    const d = latest.d || 50;
    let signal = 'NEUTRAL';
    let points = 0;
    if (k < 20) {
        signal = 'BUY';
        points = 15;
    } else if (k > 80) {
        signal = 'SELL';
        points = 15;
    }
    return {
        k: Math.round(k * 100) / 100,
        d: Math.round(d * 100) / 100,
        signal,
        points
    };
}

function calculateBollingerBands(closes, period = 20, stdDev = 2) {
    const result = technicalIndicators.BollingerBands.calculate({
        values: closes,
        period: period,
        stdDev: stdDev
    });
    if (result.length === 0) {
        return { upper: null, middle: null, lower: null, width: 0, signal: 'NEUTRAL', points: 0 };
    }
    const latest = result[result.length - 1];
    const upper = latest.upper;
    const middle = latest.middle;
    const lower = latest.lower;
    const close = closes[closes.length - 1];
    const width = upper > 0 ? ((upper - lower) / middle) * 100 : 0;
    let signal = 'NEUTRAL';
    let points = 0;
    if (close <= lower) {
        signal = 'BUY';
        points = 10;
    } else if (close >= upper) {
        signal = 'SELL';
        points = 10;
    }
    return {
        upper: Math.round(upper * 100000) / 100000,
        middle: Math.round(middle * 100000) / 100000,
        lower: Math.round(lower * 100000) / 100000,
        width: Math.round(width * 100) / 100,
        signal,
        points
    };
}

function detectCandlePatterns(candles) {
    if (candles.length < 3) {
        return { pattern: 'NONE', signal: 'NEUTRAL', points: 0 };
    }
    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];
    const isGreen = (c) => c.close > c.open;
    const isRed = (c) => c.close < c.open;
    const bodySize = (c) => Math.abs(c.close - c.open);
    const upperShadow = (c) => c.high - Math.max(c.open, c.close);
    const lowerShadow = (c) => Math.min(c.open, c.close) - c.low;
    if (isRed(c3) && isRed(c2) && isRed(c1) &&
        c3.close > c2.close && c2.close > c1.close) {
        return { pattern: 'THREE_BLACK_CROWS', signal: 'SELL', points: 10 };
    }
    if (isGreen(c3) && isGreen(c2) && isGreen(c1) &&
        c3.close > c2.close && c2.close > c1.close) {
        return { pattern: 'THREE_WHITE_SOLDIERS', signal: 'BUY', points: 10 };
    }
    if (isRed(c2) && isGreen(c3) &&
        c3.open < c2.close && c3.close > c2.open &&
        bodySize(c3) > bodySize(c2)) {
        return { pattern: 'BULLISH_ENGULFING', signal: 'BUY', points: 10 };
    }
    if (isGreen(c2) && isRed(c3) &&
        c3.open > c2.open && c3.close < c2.close &&
        bodySize(c3) > bodySize(c2)) {
        return { pattern: 'BEARISH_ENGULFING', signal: 'SELL', points: 10 };
    }
    const hammerBody = bodySize(c3) < (c3.high - c3.low) * 0.3;
    const hammerLower = lowerShadow(c3) > bodySize(c3) * 2;
    const hammerUpper = upperShadow(c3) < bodySize(c3) * 0.5;
    if (hammerBody && hammerLower && hammerUpper && isGreen(c3)) {
        return { pattern: 'HAMMER', signal: 'BUY', points: 10 };
    }
    const starBody = bodySize(c3) < (c3.high - c3.low) * 0.3;
    const starUpper = upperShadow(c3) > bodySize(c3) * 2;
    const starLower = lowerShadow(c3) < bodySize(c3) * 0.5;
    if (starBody && starUpper && starLower && isRed(c3)) {
        return { pattern: 'SHOOTING_STAR', signal: 'SELL', points: 10 };
    }
    const dojiBody = bodySize(c3) < (c3.high - c3.low) * 0.1;
    if (dojiBody) {
        return { pattern: 'DOJI', signal: 'NEUTRAL', points: -5 };
    }
    return { pattern: 'NONE', signal: 'NEUTRAL', points: 0 };
}

function calculateScore(rsi, ema, macd, stoch, bollinger, pattern, candles) {
    let buyPoints = 0;
    let sellPoints = 0;
    buyPoints += rsi.signal === 'BUY' ? rsi.points : 0;
    sellPoints += rsi.signal === 'SELL' ? rsi.points : 0;
    buyPoints += ema.signal === 'BUY' ? ema.points : 0;
    sellPoints += ema.signal === 'SELL' ? ema.points : 0;
    buyPoints += macd.signal === 'BUY' ? macd.points : 0;
    sellPoints += macd.signal === 'SELL' ? macd.points : 0;
    buyPoints += stoch.signal === 'BUY' ? stoch.points : 0;
    sellPoints += stoch.signal === 'SELL' ? stoch.points : 0;
    buyPoints += bollinger.signal === 'BUY' ? bollinger.points : 0;
    sellPoints += bollinger.signal === 'SELL' ? bollinger.points : 0;
    buyPoints += pattern.signal === 'BUY' ? pattern.points : 0;
    sellPoints += pattern.signal === 'SELL' ? pattern.points : 0;
    const baseScore = Math.min(buyPoints, sellPoints) > 0 ? Math.max(buyPoints, sellPoints) : 50;
    let suggestedDirection = 'BUY';
    if (sellPoints > buyPoints) {
        suggestedDirection = 'SELL';
    } else if (sellPoints === buyPoints && candles && candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        suggestedDirection = lastCandle.close >= lastCandle.open ? 'BUY' : 'SELL';
    }
    const summaryParts = [];
    if (rsi.signal !== 'NEUTRAL') summaryParts.push(`RSI ${rsi.signal} (${rsi.value.toFixed(1)})`);
    if (ema.signal !== 'NEUTRAL') summaryParts.push(`EMA ${ema.signal}`);
    if (macd.signal !== 'NEUTRAL') summaryParts.push(`MACD ${macd.signal}`);
    if (stoch.signal !== 'NEUTRAL') summaryParts.push(`StochRSI ${stoch.signal}`);
    if (bollinger.signal !== 'NEUTRAL') summaryParts.push(`Bollinger ${bollinger.signal}`);
    if (pattern.signal !== 'NEUTRAL') summaryParts.push(`Pattern: ${pattern.pattern}`);
    const summary = summaryParts.length > 0 ? summaryParts.join(' | ') : 'Mixed signals';
    return { buyPoints, sellPoints, baseScore, suggestedDirection, summary };
}

function getFallbackIndicators(candles) {
    return {
        indicators: {
            rsi: { value: 50, signal: 'NEUTRAL', points: 0 },
            ema: { ema9: null, ema21: null, crossover: false, signal: 'NEUTRAL', points: 0 },
            macd: { macd: null, signal_line: null, histogram: null, signal: 'NEUTRAL', points: 0 },
            stochRsi: { k: 50, d: 50, signal: 'NEUTRAL', points: 0 },
            bollinger: { upper: null, middle: null, lower: null, width: 0, signal: 'NEUTRAL', points: 0 },
            candlePattern: { pattern: 'NONE', signal: 'NEUTRAL', points: 0 }
        },
        buyPoints: 0,
        sellPoints: 0,
        baseScore: 0,
        suggestedDirection: getFallbackDirection(candles),
        closes: [],
        summary: 'Collecting data...'
    };
}

function getFallbackDirection(candles) {
    if (candles && candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        return lastCandle.close >= lastCandle.open ? 'BUY' : 'SELL';
    }
    return Math.floor(Date.now() / 1000) % 2 === 0 ? 'BUY' : 'SELL';
}

module.exports = { calculateIndicators };
