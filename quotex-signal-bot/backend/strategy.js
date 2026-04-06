const technicalIndicators = require('technicalindicators');

/**
 * Generate trading signal based on RSI, EMA, and MACD indicators
 * @param {Array} candles - Array of 50 candle objects with OHLCV data
 * @returns {Object} - Signal object with direction, confidence, and indicator details
 */
function generateSignal(candles) {
    if (!candles || candles.length < 50) {
        return {
            direction: 'WAIT',
            confidence: 0,
            error: 'Insufficient candle data',
            indicators: {
                rsi: { value: null, signal: 'NEUTRAL' },
                ema: { ema9: null, ema21: null, signal: 'NEUTRAL' },
                macd: { macd: null, signal_line: null, signal: 'NEUTRAL' }
            }
        };
    }

    const closingPrices = candles.map(c => c.close);

    const rsiResult = calculateRSI(closingPrices);
    const emaResult = calculateEMA(closingPrices);
    const macdResult = calculateMACD(closingPrices);

    let confidence = 0;
    let direction = 'WAIT';
    let agreementCount = 0;

    const rsiSignal = rsiResult.signal;
    const emaSignal = emaResult.signal;
    const macdSignal = macdResult.signal;

    if (rsiSignal === 'UP') {
        confidence += 33;
        agreementCount++;
    } else if (rsiSignal === 'DOWN') {
        confidence += 33;
        agreementCount++;
    }

    if (emaSignal === 'UP') {
        confidence += 33;
        agreementCount++;
    } else if (emaSignal === 'DOWN') {
        confidence += 33;
        agreementCount++;
    }

    if (macdSignal === 'UP') {
        confidence += 34;
        agreementCount++;
    } else if (macdSignal === 'DOWN') {
        confidence += 34;
        agreementCount++;
    }

    if (agreementCount >= 2) {
        const upCount = [rsiSignal, emaSignal, macdSignal].filter(s => s === 'UP').length;
        const downCount = [rsiSignal, emaSignal, macdSignal].filter(s => s === 'DOWN').length;
        
        if (upCount > downCount) {
            direction = 'UP';
        } else if (downCount > upCount) {
            direction = 'DOWN';
        } else {
            direction = 'WAIT';
            confidence = Math.min(confidence, 50);
        }
    }

    if (agreementCount < 2) {
        direction = 'WAIT';
        confidence = Math.min(confidence, 33);
    }

    confidence = Math.min(confidence, 100);

    return {
        direction: direction,
        confidence: confidence,
        indicators: {
            rsi: {
                value: rsiResult.value,
                signal: rsiSignal
            },
            ema: {
                ema9: emaResult.ema9,
                ema21: emaResult.ema21,
                signal: emaSignal
            },
            macd: {
                macd: macdResult.macd,
                signal_line: macdResult.signalLine,
                histogram: macdResult.histogram,
                signal: macdSignal
            }
        }
    };
}

/**
 * Calculate RSI (Relative Strength Index)
 * @param {Array} prices - Array of closing prices
 * @returns {Object} - RSI value and signal
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
        if (rsiValue < 40) {
            signal = 'UP';
        } else if (rsiValue > 60) {
            signal = 'DOWN';
        }

        return {
            value: parseFloat(rsiValue.toFixed(2)),
            signal: signal
        };
    } catch (error) {
        console.error('RSI calculation error:', error.message);
        return { value: null, signal: 'NEUTRAL' };
    }
}

/**
 * Calculate EMA (Exponential Moving Average) - EMA9 and EMA21
 * @param {Array} prices - Array of closing prices
 * @returns {Object} - EMA values and signal
 */
function calculateEMA(prices) {
    try {
        const ema9Values = technicalIndicators.EMA.calculate({
            values: prices,
            period: 9
        });

        const ema21Values = technicalIndicators.EMA.calculate({
            values: prices,
            period: 21
        });

        const ema9 = ema9Values[ema9Values.length - 1];
        const ema21 = ema21Values[ema21Values.length - 1];

        let signal = 'NEUTRAL';
        if (ema9 > ema21) {
            signal = 'UP';
        } else if (ema9 < ema21) {
            signal = 'DOWN';
        }

        return {
            ema9: parseFloat(ema9.toFixed(5)),
            ema21: parseFloat(ema21.toFixed(5)),
            signal: signal
        };
    } catch (error) {
        console.error('EMA calculation error:', error.message);
        return { ema9: null, ema21: null, signal: 'NEUTRAL' };
    }
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {Array} prices - Array of closing prices
 * @returns {Object} - MACD, signal line, and signal
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

        const macdData = macdValues[macdValues.length - 1];

        let signal = 'NEUTRAL';
        if (macdData.MACD > macdData.signal) {
            signal = 'UP';
        } else if (macdData.MACD < macdData.signal) {
            signal = 'DOWN';
        }

        return {
            macd: parseFloat(macdData.MACD.toFixed(5)),
            signalLine: parseFloat(macdData.signal.toFixed(5)),
            histogram: parseFloat((macdData.MACD - macdData.signal).toFixed(5)),
            signal: signal
        };
    } catch (error) {
        console.error('MACD calculation error:', error.message);
        return { macd: null, signalLine: null, histogram: null, signal: 'NEUTRAL' };
    }
}

module.exports = { generateSignal };
