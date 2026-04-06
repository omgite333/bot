/**
 * signal-engine.js - Core Signal Engine
 * Combines strategy + AI to generate final BUY or SELL signals
 */

const candleBuilder = require('./candle-builder');
const strategy = require('./strategy');
const filters = require('./filters');
const groqAI = require('./groq-ai');
const state = require('./state');

async function generateFinalSignal(pair) {
    const candles = candleBuilder.getCandles(pair, 100);
    const dataPoints = candles.length;
    console.log(`[ENGINE] Generating signal for ${pair} with ${dataPoints} candles`);
    let strategyResult;
    let aiResult;
    let filtersResult;
    let agreement;
    let confidence;
    let direction;
    let strength;
    if (candles.length === 0) {
        const fallback = generateFallbackSignal(pair);
        return fallback;
    }
    strategyResult = strategy.calculateIndicators(candles);
    filtersResult = filters.applyFilters(
        candles,
        pair,
        strategyResult.suggestedDirection,
        strategyResult.indicators.rsi.value,
        state
    );
    try {
        aiResult = await groqAI.getAISignal(pair, strategyResult, candles);
    } catch (error) {
        console.error('[ENGINE] AI error:', error.message);
        aiResult = {
            direction: strategyResult.suggestedDirection,
            confidence: 40,
            reasoning: 'Using strategy direction',
            risk: 'MEDIUM',
            key_factor: 'Fallback to technical analysis'
        };
    }
    if (aiResult.direction === strategyResult.suggestedDirection) {
        agreement = 'FULL';
        confidence = (strategyResult.baseScore + aiResult.confidence) / 2 + 10;
        direction = strategyResult.suggestedDirection;
    } else {
        agreement = 'PARTIAL';
        const stratConf = strategyResult.baseScore;
        const aiConf = aiResult.confidence;
        if (stratConf >= aiConf) {
            direction = strategyResult.suggestedDirection;
            confidence = stratConf - 10;
        } else {
            direction = aiResult.direction;
            confidence = aiConf - 10;
        }
    }
    confidence += filtersResult.total;
    confidence = Math.max(20, Math.min(95, Math.round(confidence)));
    if (confidence >= 70) {
        strength = 'STRONG';
    } else if (confidence >= 50) {
        strength = 'MEDIUM';
    } else {
        strength = 'WEAK';
    }
    const label = `${strength} ${direction}`;
    return {
        direction: direction,
        strength: strength,
        confidence: confidence,
        label: label,
        strategy: {
            direction: strategyResult.suggestedDirection,
            buyPoints: strategyResult.buyPoints,
            sellPoints: strategyResult.sellPoints,
            baseScore: strategyResult.baseScore,
            indicators: strategyResult.indicators,
            summary: strategyResult.summary
        },
        ai: {
            direction: aiResult.direction,
            confidence: aiResult.confidence,
            reasoning: aiResult.reasoning,
            risk: aiResult.risk,
            key_factor: aiResult.key_factor
        },
        filters: {
            sessionBonus: filtersResult.sessionBonus,
            rangingPenalty: filtersResult.rangingPenalty,
            consecutivePenalty: filtersResult.consecutivePenalty,
            exhaustionBonus: filtersResult.exhaustionBonus,
            reversalBonus: filtersResult.reversalBonus,
            trendBonus: filtersResult.trendBonus,
            total: filtersResult.total
        },
        agreement: agreement,
        dataPoints: dataPoints,
        pair: pair,
        timestamp: new Date().toISOString()
    };
}

function generateFallbackSignal(pair) {
    const currentSecond = Math.floor(Date.now() / 1000);
    const direction = currentSecond % 2 === 0 ? 'BUY' : 'SELL';
    return {
        direction: direction,
        strength: 'WEAK',
        confidence: 20,
        label: `WEAK ${direction}`,
        strategy: {
            direction: direction,
            buyPoints: 0,
            sellPoints: 0,
            baseScore: 0,
            indicators: {
                rsi: { value: 50, signal: 'NEUTRAL', points: 0 },
                ema: { ema9: null, ema21: null, crossover: false, signal: 'NEUTRAL', points: 0 },
                macd: { macd: null, signal_line: null, histogram: null, signal: 'NEUTRAL', points: 0 },
                stochRsi: { k: 50, d: 50, signal: 'NEUTRAL', points: 0 },
                bollinger: { upper: null, middle: null, lower: null, width: 0, signal: 'NEUTRAL', points: 0 },
                candlePattern: { pattern: 'NONE', signal: 'NEUTRAL', points: 0 }
            },
            summary: 'Waiting for data'
        },
        ai: {
            direction: direction,
            confidence: 20,
            reasoning: 'Waiting for data collection',
            risk: 'HIGH',
            key_factor: 'No data available'
        },
        filters: {
            sessionBonus: 0,
            rangingPenalty: 0,
            consecutivePenalty: 0,
            exhaustionBonus: 0,
            reversalBonus: 0,
            trendBonus: 0,
            total: 0
        },
        agreement: 'PARTIAL',
        dataPoints: 0,
        pair: pair,
        timestamp: new Date().toISOString(),
        note: 'Waiting for data'
    };
}

module.exports = { generateFinalSignal };
