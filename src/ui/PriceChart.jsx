import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, CrosshairMode } from 'lightweight-charts';

const FRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** Candlestick chart on the existing /api/market/klines endpoint. Colours follow the active theme. */
export default function PriceChart({ symbol, className = '', height = 380 }) {
  const box = useRef(null);
  const [frame, setFrame] = useState('1h');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!box.current) return undefined;
    const up = css('--c-up', '#35d6a0');
    const down = css('--c-down', '#ff5d73');
    const ink = css('--c-muted', '#8e97a8');
    const grid = css('--c-line', '#232a3a');
    const chart = createChart(box.current, {
      height,
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: ink, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: true },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down,
    });
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    let alive = true;
    const load = async (first) => {
      try {
        const res = await fetch(`/api/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${frame}&limit=300`);
        if (!res.ok) throw new Error('Candles unavailable');
        const rows = await res.json();
        if (!alive) return;
        candles.setData(rows.map((k) => ({ time: Math.floor(k.openTime / 1000), open: k.open, high: k.high, low: k.low, close: k.close })));
        volume.setData(rows.map((k) => ({ time: Math.floor(k.openTime / 1000), value: k.volume, color: (k.close >= k.open ? up : down) + '66' })));
        if (first) chart.timeScale().fitContent();
        setError('');
      } catch (e) {
        if (alive) setError(e.message);
      }
    };
    load(true);
    const timer = setInterval(() => load(false), 10000);
    return () => { alive = false; clearInterval(timer); chart.remove(); };
  }, [symbol, frame, height]);

  return (
    <div className={`rounded-xl border border-line bg-surface ${className}`}>
      <div className="flex items-center gap-1 px-3 py-2">
        {FRAMES.map((f) => (
          <button
            key={f}
            onClick={() => setFrame(f)}
            aria-pressed={frame === f}
            className={`rounded-lg px-2.5 py-1 font-mono text-xs ${frame === f ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
          >
            {f}
          </button>
        ))}
        {error && <span className="ml-auto text-xs text-live">{error}</span>}
      </div>
      <div ref={box} style={{ height }} role="img" aria-label={`${symbol} candlestick chart`} />
    </div>
  );
}
