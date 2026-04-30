import { useState, useEffect } from "react";
import "./ConfigScreen.css";

const DOUGH_WEIGHTS = {
  10: 200, 11: 230, 12: 260, 13: 290, 14: 320,
  15: 360, 16: 400, 17: 450, 18: 500
};

const defaultEntry = () => ({ id: Date.now(), quantity: 1, width: 14 });

export default function ConfigScreen({ onCalculate, initialConfig }) {
  const [hydration, setHydration] = useState(
    initialConfig?.hydration ?? 70
  );
  const [entries, setEntries] = useState(
    initialConfig?.entries ?? [defaultEntry()]
  );

  const updateEntry = (id, field, val) => {
    setEntries(prev =>
      prev.map(e => e.id === id ? { ...e, [field]: val } : e)
    );
  };

  const addEntry = () => {
    setEntries(prev => [...prev, defaultEntry()]);
  };

  const removeEntry = (id) => {
    if (entries.length === 1) return;
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const totalBalls = entries.reduce((s, e) => s + e.quantity, 0);

  const handleCalculate = () => {
    onCalculate({ hydration, entries });
  };

  return (
    <div className="config-screen">
      {/* Header */}
      <header className="config-header">
        <div className="header-mark">
          <span className="header-icon">⊕</span>
        </div>
        <div className="header-text">
          <h1 className="app-title">Dough</h1>
          <h1 className="app-title accent">Calculator</h1>
          <p className="app-subtitle mono">Pizza Dough Formula Builder</p>
        </div>
        <div className="header-grid-deco" aria-hidden="true">
          {[...Array(20)].map((_, i) => <span key={i} />)}
        </div>
      </header>

      <main className="config-main">
        {/* Hydration — universal */}
        <section className="section hydration-section animate-in" style={{ animationDelay: '0.05s' }}>
          <div className="section-label">
            <span className="label-tag mono">UNIVERSAL</span>
            <h2 className="section-title">Dough Hydration</h2>
          </div>
          <div className="hydration-control">
            <div className="value-display">
              <input
                className="big-number-input mono"
                type="number"
                min={60} max={100}
                value={hydration}
                onChange={e => {
                  const v = Math.min(100, Math.max(60, Number(e.target.value)));
                  setHydration(v);
                }}
              />
              <span className="big-unit">%</span>
            </div>
            <div className="slider-track">
              <span className="slider-min mono">60%</span>
              <input
                type="range" min={60} max={100} step={1}
                value={hydration}
                onChange={e => setHydration(Number(e.target.value))}
              />
              <span className="slider-max mono">100%</span>
            </div>
            <div className="hydration-desc mono">
              {hydration < 65 && "Stiff — dense, cracker-style crust"}
              {hydration >= 65 && hydration < 70 && "Low — firm, easy to handle"}
              {hydration >= 70 && hydration < 75 && "Classic Neapolitan range"}
              {hydration >= 75 && hydration < 80 && "High — open crumb, tacky dough"}
              {hydration >= 80 && "Very high — slack, needs experience"}
            </div>
          </div>
        </section>

        {/* Pie Entries */}
        <section className="section pies-section animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="section-label">
            <span className="label-tag mono">PER PIE</span>
            <h2 className="section-title">Pizza Specifications</h2>
          </div>

          <div className="entries-list">
            {entries.map((entry, idx) => (
              <PieEntry
                key={entry.id}
                entry={entry}
                index={idx}
                onChange={(field, val) => updateEntry(entry.id, field, val)}
                onRemove={() => removeEntry(entry.id)}
                canRemove={entries.length > 1}
              />
            ))}
          </div>

          <button className="add-entry-btn" onClick={addEntry}>
            <span className="add-icon">+</span>
            <span>Add another size</span>
          </button>
        </section>

        {/* Summary bar */}
        <div className="summary-bar animate-in" style={{ animationDelay: '0.15s' }}>
          <div className="summary-stat">
            <span className="summary-val mono">{totalBalls}</span>
            <span className="summary-label">dough balls</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-stat">
            <span className="summary-val mono">{hydration}%</span>
            <span className="summary-label">hydration</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-stat">
            <span className="summary-val mono">
              {entries.reduce((s, e) => s + e.quantity * (DOUGH_WEIGHTS[e.width] ?? 320), 0)}g
            </span>
            <span className="summary-label">total dough</span>
          </div>
        </div>

        <button className="calculate-btn animate-in" style={{ animationDelay: '0.2s' }} onClick={handleCalculate}>
          <span>Calculate Recipe</span>
          <span className="btn-arrow">→</span>
        </button>
      </main>
    </div>
  );
}

function PieEntry({ entry, index, onChange, onRemove, canRemove }) {
  return (
    <div className="pie-entry">
      <div className="entry-header">
        <span className="entry-number mono">#{String(index + 1).padStart(2, '0')}</span>
        {canRemove && (
          <button className="remove-btn" onClick={onRemove} aria-label="Remove">×</button>
        )}
      </div>

      <div className="entry-fields">
        {/* Quantity */}
        <div className="field-group">
          <label className="field-label mono">QUANTITY</label>
          <div className="value-row">
            <input
              className="num-input mono"
              type="number" min={1} max={8}
              value={entry.quantity}
              onChange={e => onChange('quantity', Math.min(8, Math.max(1, Number(e.target.value))))}
            />
            <span className="field-unit">balls</span>
          </div>
          <input
            type="range" min={1} max={8} step={1}
            value={entry.quantity}
            onChange={e => onChange('quantity', Number(e.target.value))}
          />
          <div className="range-labels mono">
            <span>1</span><span>8</span>
          </div>
        </div>

        {/* Width */}
        <div className="field-group">
          <label className="field-label mono">DIAMETER</label>
          <div className="value-row">
            <input
              className="num-input mono"
              type="number" min={10} max={18}
              value={entry.width}
              onChange={e => onChange('width', Math.min(18, Math.max(10, Number(e.target.value))))}
            />
            <span className="field-unit">inches</span>
          </div>
          <input
            type="range" min={10} max={18} step={1}
            value={entry.width}
            onChange={e => onChange('width', Number(e.target.value))}
          />
          <div className="range-labels mono">
            <span>10"</span><span>18"</span>
          </div>
        </div>
      </div>

      <div className="entry-summary mono">
        {entry.quantity}× {entry.width}" pizza
        &nbsp;·&nbsp;
        {DOUGH_WEIGHTS[entry.width] ?? 320}g per ball
        &nbsp;·&nbsp;
        {entry.quantity * (DOUGH_WEIGHTS[entry.width] ?? 320)}g total
      </div>
    </div>
  );
}
