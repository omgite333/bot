/**
 * fetcher.js - Twelve Data API Integration
 * Fetches candle data for technical analysis
 */

const axios = require('axios');

// Twelve Data API base URL
const API_BASE = 'https://api.twelvedata.com/time_series';

/**
 * Fetches candles from Twelve Data API
 * @param {string} symbol - Trading pair symbol (e.g., "EUR/USD")
 * @param {string} interval - Time interval (default: "1min")
 * @param {number} outputsize - Number of candles to fetch (default: 100)
 * @returns {Promise<Array|null>} - Array of candle objects or null if failed
 */
async function fetchCandles(symbol, interval = '1min', outputsize = 100) {
    try {
        // Get API key from environment
        const apiKey = process.env.TWELVE_DATA_API_KEY;
        
        if (!apiKey || apiKey === 'your_key_here' || apiKey === '') {
            console.error('[FETCHER] Error: Twelve Data API key not configured');
            return null;
        }

        // Make API request
        const response = await axios.get(API_BASE, {
            params: {
                symbol: symbol,
                interval: interval,
                outputsize: outputsize,
                apikey: apiKey,
                format: 'JSON'
            },
            timeout: 15000 // 15 second timeout
        });

        // Check for API errors
        if (response.data.status === 'error') {
            console.error('[FETCHER] API Error:', response.data.message || 'Unknown error');
            return null;
        }

        // Check if data exists
        if (!response.data.values || !Array.isArray(response.data.values)) {
            console.error('[FETCHER] Error: No data values returned');
            return null;
        }

        // Transform and reverse array (oldest first for indicators)
        const candles = response.data.values.map(candle => ({
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseInt(candle.volume) || 0,
            datetime: candle.datetime
        })).reverse(); // Reverse so oldest is first

        console.log(`[FETCHER] Fetched ${candles.length} candles for ${symbol} (${interval})`);
        
        return candles;
    } catch (error) {
        // Handle different error types
        if (error.response) {
            console.error(`[FETCHER] API Error (${error.response.status}):`, 
                error.response.data?.message || 'Rate limit or API error');
        } else if (error.request) {
            console.error('[FETCHER] Network Error: No response from API');
        } else {
            console.error('[FETCHER] Error:', error.message);
        }
        return null;
    }
}

/**
 * Fetches candles from multiple timeframes simultaneously
 * @param {string} symbol - Trading pair symbol
 * @returns {Promise<Object>} - Object with candles1m and candles5m arrays
 */
async function fetchMultiTimeframe(symbol) {
    console.log(`[FETCHER] Fetching multi-timeframe data for ${symbol}`);
    
    try {
        // Fetch both timeframes in parallel for speed
        const [candles1m, candles5m] = await Promise.all([
            fetchCandles(symbol, '1min', 100),
            fetchCandles(symbol, '5min', 100)
        ]);

        // Validate both datasets exist
        if (!candles1m && !candles5m) {
            console.error('[FETCHER] Failed to fetch any candle data');
            return { candles1m: null, candles5m: null };
        }

        if (!candles1m) {
            console.warn('[FETCHER] Warning: 1min candles unavailable');
        }

        if (!candles5m) {
            console.warn('[FETCHER] Warning: 5min candles unavailable');
        }

        return {
            candles1m: candles1m,
            candles5m: candles5m
        };
    } catch (error) {
        console.error('[FETCHER] Multi-timeframe fetch error:', error.message);
        return { candles1m: null, candles5m: null };
    }
}

module.exports = {
    fetchCandles,
    fetchMultiTimeframe
};
