// ==UserScript==
// @name         Pocket Option Live Candle Engine
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Live Real-Time Candle Data Reader for Pocket Option
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initBot() {
        if (!document.body) {
            setTimeout(initBot, 300);
            return;
        }

        // Agar dashboard pehle se mojood hai toh dobara na banaye
        if (document.getElementById('po-live-hud')) return;

        const hud = document.createElement('div');
        hud.id = 'po-live-hud';
        hud.style.cssText = `
            position: fixed !important;
            top: 75px !important;
            left: 10px !important;
            z-index: 99999999 !important;
            background: rgba(11, 15, 25, 0.96) !important;
            border: 2px solid #0284c7 !important;
            border-radius: 12px !important;
            padding: 10px !important;
            color: #ffffff !important;
            font-family: -apple-system, sans-serif !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important;
            width: 190px !important;
            pointer-events: auto !important;
        `;

        hud.innerHTML = `
            <div style="font-size: 11px; font-weight: 800; color: #38bdf8; border-bottom: 1px solid #1e293b; padding-bottom: 3px; margin-bottom: 5px;">
                ⚡ PO LIVE ENGINE
            </div>
            <div style="font-size: 10px; color: #94a3b8;">PRICE: <span id="hud-price" style="color: #fff; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 10px; color: #94a3b8;">CANDLE: <span id="hud-candle-type" style="color: #facc15; font-weight: bold;">--</span></div>
            <div style="font-size: 10px; color: #94a3b8;">CLOSING: <span id="hud-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>
            
            <div style="background: #131b2e; padding: 6px; border-radius: 6px; text-align: center; margin-top: 6px; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Next Candle</div>
                <div id="hud-signal" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">SCANNING</div>
            </div>
            <div id="hud-reason" style="font-size: 8px; color: #64748b; margin-top: 4px;">Tracking live chart...</div>
        `;

        document.body.appendChild(hud);

        let currentCandleOpen = null;
        let candleHigh = -Infinity;
        let candleLow = Infinity;
        let lastCandleMinute = -1;

        function getScreenPrice() {
            const selectors = [
                '.current-price',
                '[class*="price-current"]',
                '.value__val',
                '.chart-current-value'
            ];
            for (let sel of selectors) {
                let el = document.querySelector(sel);
                if (el && el.innerText) {
                    let clean = parseFloat(el.innerText.replace(/[^0-9.]/g, ''));
                    if (!isNaN(clean) && clean > 0) return clean;
                }
            }
            return null;
        }

        setInterval(() => {
            const livePrice = getScreenPrice();
            const now = new Date();
            const currentSec = now.getSeconds();
            const currentMin = now.getMinutes();

            if (currentMin !== lastCandleMinute) {
                lastCandleMinute = currentMin;
                currentCandleOpen = livePrice;
                candleHigh = livePrice || -Infinity;
                candleLow = livePrice || Infinity;
                const sig = document.getElementById('hud-signal');
                if (sig) {
                    sig.innerText = "SCANNING";
                    sig.style.color = "#facc15";
                }
            }

            const priceEl = document.getElementById('hud-price');
            const timerEl = document.getElementById('hud-timer');
            if (timerEl) timerEl.innerText = `${60 - currentSec}s`;

            if (!livePrice) {
                if (priceEl) priceEl.innerText = "CHART READY";
                return;
            }

            if (priceEl) priceEl.innerText = livePrice.toFixed(5);

            if (livePrice > candleHigh) candleHigh = livePrice;
            if (livePrice < candleLow) candleLow = livePrice;

            if (currentCandleOpen) {
                let isGreen = livePrice >= currentCandleOpen;
                let bodySize = Math.abs(livePrice - currentCandleOpen);
                let upperWick = candleHigh - Math.max(livePrice, currentCandleOpen);
                let lowerWick = Math.min(livePrice, currentCandleOpen) - candleLow;

                const cType = document.getElementById('hud-candle-type');
                if (cType) {
                    cType.innerText = isGreen ? `🟢 GREEN` : `🔴 RED`;
                }

                // Final 6 seconds analysis (:54 to :59)
                if (currentSec >= 54) {
                    const signalBox = document.getElementById('hud-signal');
                    const reasonBox = document.getElementById('hud-reason');

                    if (lowerWick > bodySize * 1.2 && lowerWick > upperWick) {
                        if (signalBox) {
                            signalBox.innerText = "CALL (BUY) 🟢";
                            signalBox.style.color = "#10b981";
                        }
                        if (reasonBox) reasonBox.innerText = "Buyer wick rejection active.";
                    } else if (upperWick > bodySize * 1.2 && upperWick > lowerWick) {
                        if (signalBox) {
                            signalBox.innerText = "PUT (SELL) 🔴";
                            signalBox.style.color = "#ef4444";
                        }
                        if (reasonBox) reasonBox.innerText = "Seller wick rejection active.";
                    } else if (bodySize > (upperWick + lowerWick)) {
                        if (isGreen) {
                            if (signalBox) {
                                signalBox.innerText = "CALL (BUY) 🟢";
                                signalBox.style.color = "#10b981";
                            }
                            if (reasonBox) reasonBox.innerText = "Bullish momentum continuation.";
                        } else {
                            if (signalBox) {
                                signalBox.innerText = "PUT (SELL) 🔴";
                                signalBox.style.color = "#ef4444";
                            }
                            if (reasonBox) reasonBox.innerText = "Bearish momentum continuation.";
                        }
                    } else {
                        if (signalBox) {
                            signalBox.innerText = "NO TRADE ⏸";
                            signalBox.style.color = "#facc15";
                        }
                        if (reasonBox) reasonBox.innerText = "Choppy market. Skip.";
                    }
                }
            }
        }, 250);
    }

    // Trigger on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBot);
    } else {
        initBot();
    }
    setTimeout(initBot, 1500);
})();
