import { useState } from "react";
import "./RecipeScreen.css";

const DOUGH_WEIGHTS = {
  10: 200, 11: 230, 12: 260, 13: 290, 14: 320,
  15: 360, 16: 400, 17: 450, 18: 500
};

function calcRecipe(hydration, entries) {
  const h = hydration / 100;
  const multiplier = 1 + h + 0.025 + 0.02 + 0.002;

  const pies = entries.map(e => {
    const ballWeight = DOUGH_WEIGHTS[e.width] ?? 320;
    const flour = ballWeight / multiplier;
    return {
      width: e.width,
      quantity: e.quantity,
      ballWeight,
      flour: flour * e.quantity,
      water: flour * h * e.quantity,
      salt: flour * 0.025 * e.quantity,
      oil: flour * 0.02 * e.quantity,
      yeast: flour * 0.002 * e.quantity,
    };
  });

  const totals = pies.reduce((acc, p) => ({
    flour: acc.flour + p.flour,
    water: acc.water + p.water,
    salt: acc.salt + p.salt,
    oil: acc.oil + p.oil,
    yeast: acc.yeast + p.yeast,
    balls: acc.balls + p.quantity,
  }), { flour: 0, water: 0, salt: 0, oil: 0, yeast: 0, balls: 0 });

  return { pies, totals };
}

function gToVolume(ingredient, grams) {
  const conversions = {
    flour:  { factor: 1 / 125,   unit: 'cups',  display: v => v >= 0.25 ? fractionStr(v) + ' cup' + (v >= 2 ? 's' : '') : Math.round(v * 48) + ' tsp' },
    water:  { factor: 1 / 240,   unit: 'cups',  display: v => v >= 0.25 ? fractionStr(v) + ' cup' + (v >= 2 ? 's' : '') : Math.round(v * 48) + ' tsp' },
    salt:   { factor: 1 / 5.69,  unit: 'tsp',   display: v => fractionStr(v) + ' tsp' },
    oil:    { factor: 1 / 13.5,  unit: 'tbsp',  display: v => fractionStr(v) + ' tbsp' },
    yeast:  { factor: 1 / 2.83,  unit: 'tsp',   display: v => fractionStr(v) + ' tsp' },
  };
  const c = conversions[ingredient];
  if (!c) return grams.toFixed(1) + 'g';
  const vol = grams * c.factor;
  return c.display(vol);
}

function fractionStr(val) {
  const wholes = Math.floor(val);
  const frac = val - wholes;
  const fracs = [[0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.375, '⅜'], [0.5, '½'], [0.625, '⅝'], [0.667, '⅔'], [0.75, '¾'], [0.875, '⅞']];
  let best = '', bestDiff = 0.13;
  for (const [f, s] of fracs) {
    const diff = Math.abs(frac - f);
    if (diff < bestDiff) { bestDiff = diff; best = s; }
  }
  if (!best && wholes === 0) return '~' + val.toFixed(2);
  if (frac < 0.06) return wholes > 0 ? String(wholes) : '~0';
  return (wholes > 0 ? wholes + ' ' : '') + best;
}

function fmt(n) { return Math.round(n * 10) / 10; }

export default function RecipeScreen({ config, onEdit }) {
  const [tab, setTab] = useState("ingredients");
  const [unit, setUnit] = useState("grams");
  const [ferment, setFerment] = useState("room");

  const { hydration, entries } = config;
  const { pies, totals } = calcRecipe(hydration, entries);
  const totalBalls = totals.balls;

  const disp = (ingredient, grams) =>
    unit === "grams" ? fmt(grams) + 'g' : gToVolume(ingredient, grams);

  return (
    <div className="recipe-screen">
      {/* Header */}
      <header className="recipe-header">
        <div className="recipe-header-top">
          <div className="header-left">
            <span className="header-icon">⊕</span>
            <div>
              <h1 className="recipe-title">Your Recipe</h1>
              <p className="recipe-meta mono">
                {totalBalls} ball{totalBalls > 1 ? 's' : ''}
                &nbsp;·&nbsp;{hydration}% hydration
              </p>
            </div>
          </div>
          <button className="edit-btn" onClick={onEdit}>
            ← Edit
          </button>
        </div>

        {/* Pie summary chips */}
        <div className="pie-chips">
          {pies.map((p, i) => (
            <div key={i} className="pie-chip mono">
              {p.quantity}× {p.width}" · {p.quantity * p.ballWeight}g
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${tab === 'ingredients' ? 'active' : ''}`}
            onClick={() => setTab('ingredients')}
          >
            Ingredients
          </button>
          <button
            className={`tab ${tab === 'instructions' ? 'active' : ''}`}
            onClick={() => setTab('instructions')}
          >
            Instructions
          </button>
        </div>
      </header>

      <main className="recipe-main">
        {tab === 'ingredients' && (
          <IngredientsTab
            pies={pies} totals={totals} hydration={hydration}
            unit={unit} setUnit={setUnit} disp={disp}
          />
        )}
        {tab === 'instructions' && (
          <InstructionsTab
            totals={totals} hydration={hydration}
            ferment={ferment} setFerment={setFerment}
            disp={disp}
          />
        )}
      </main>
    </div>
  );
}

function IngredientsTab({ pies, totals, hydration, unit, setUnit, disp }) {
  const hasMultiple = pies.length > 1 || pies.some(p => p.quantity > 1);

  return (
    <div className="ingredients-tab animate-in">
      {/* Unit toggle */}
      <div className="unit-toggle">
        <span className="toggle-label mono">Display in</span>
        <div className="radio-group">
          <label className={`radio-opt ${unit === 'grams' ? 'active' : ''}`}>
            <input type="radio" value="grams" checked={unit === 'grams'} onChange={() => setUnit('grams')} />
            Grams
          </label>
          <label className={`radio-opt ${unit === 'volume' ? 'active' : ''}`}>
            <input type="radio" value="volume" checked={unit === 'volume'} onChange={() => setUnit('volume')} />
            Volume
          </label>
        </div>
      </div>

      {/* Total ingredients */}
      <div className="ingredient-card total-card">
        <div className="card-label mono">TOTAL RECIPE</div>
        <div className="ingredient-rows">
          {[
            { key: 'flour', label: 'Bread Flour', val: totals.flour, note: '100%' },
            { key: 'water', label: 'Water', val: totals.water, note: `${hydration}%` },
            { key: 'salt', label: 'Salt', val: totals.salt, note: '2.5%' },
            { key: 'oil', label: 'Olive Oil', val: totals.oil, note: '2%' },
            { key: 'yeast', label: 'Instant Yeast', val: totals.yeast, note: '0.2%' },
          ].map(row => (
            <div key={row.key} className="ingredient-row">
              <span className="ing-name">{row.label}</span>
              <span className="ing-percent mono">{row.note}</span>
              <span className="ing-amount mono">{disp(row.key, row.val)}</span>
            </div>
          ))}
        </div>
        <div className="total-dough-weight mono">
          Total dough: {Math.round(totals.flour + totals.water + totals.salt + totals.oil + totals.yeast)}g
        </div>
      </div>

      {/* Per-size breakdown */}
      {hasMultiple && (
        <>
          <div className="breakdown-label mono">BREAKDOWN BY SIZE</div>
          {pies.map((p, i) => (
            <div key={i} className="ingredient-card breakdown-card">
              <div className="card-label mono">
                {p.quantity}× {p.width}" pizza · {p.ballWeight}g per ball
              </div>
              <div className="ingredient-rows small">
                {[
                  { key: 'flour', label: 'Flour', val: p.flour },
                  { key: 'water', label: 'Water', val: p.water },
                  { key: 'salt', label: 'Salt', val: p.salt },
                  { key: 'oil', label: 'Olive Oil', val: p.oil },
                  { key: 'yeast', label: 'Yeast', val: p.yeast },
                ].map(row => (
                  <div key={row.key} className="ingredient-row">
                    <span className="ing-name">{row.label}</span>
                    <span className="ing-amount mono">{disp(row.key, row.val)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {unit === 'volume' && (
        <p className="volume-note mono">
          ⚠ Volume measurements are approximate. Weight is more accurate.
        </p>
      )}
    </div>
  );
}

function InstructionsTab({ totals, hydration, ferment, setFerment, disp }) {
  const steps = getSteps(ferment, totals, hydration, disp);

  return (
    <div className="instructions-tab animate-in">
      {/* Ferment toggle */}
      <div className="ferment-toggle">
        <span className="toggle-label mono">Fermentation</span>
        <div className="radio-group">
          <label className={`radio-opt ${ferment === 'room' ? 'active' : ''}`}>
            <input type="radio" value="room" checked={ferment === 'room'} onChange={() => setFerment('room')} />
            Room Temp
          </label>
          <label className={`radio-opt ${ferment === 'cold' ? 'active' : ''}`}>
            <input type="radio" value="cold" checked={ferment === 'cold'} onChange={() => setFerment('cold')} />
            Cold
          </label>
        </div>
      </div>

      <div className="steps-list">
        {steps.map((step, i) => (
          <div key={i} className="step-block">
            <div className="step-num mono">{String(i + 1).padStart(2, '0')}</div>
            <div className="step-content">
              <div className="step-title">{step.title}</div>
              {step.time && <div className="step-time mono">{step.time}</div>}
              <div className="step-body">{step.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ready-card">
        <div className="ready-label mono">DOUGH IS READY WHEN</div>
        <ul className="ready-list">
          <li>Soft and airy to the touch</li>
          <li>Stretches easily without snapping back</li>
          <li>Slightly jiggly with visible gas bubbles</li>
        </ul>
      </div>
    </div>
  );
}

function getSteps(ferment, totals, hydration, disp) {
  const isRoom = ferment === 'room';
  return [
    {
      title: "Mix",
      body: `Add water to a large bowl. Dissolve the salt (${disp('salt', totals.salt)}) in the water, then briefly stir in the yeast (${disp('yeast', totals.yeast)}). Add all flour (${disp('flour', totals.flour)}) and mix until no dry spots remain. Add olive oil (${disp('oil', totals.oil)}) and mix until incorporated. The dough will look rough and shaggy — that's correct.`
    },
    {
      title: "Rest (Autolyse)",
      time: "15–20 min",
      body: "Cover the bowl and let the dough rest. Gluten will begin developing on its own."
    },
    {
      title: "Knead",
      time: "5–8 min",
      body: "Knead until the dough is noticeably smoother. It will still be slightly tacky."
    },
    ...(isRoom ? [
      {
        title: "Bulk Fermentation",
        time: "2–4 hours at 70–75°F",
        body: "Lightly oil a container, place dough inside, and cover. Let rise until dough has increased ~50–75% in size (not doubled)."
      },
      {
        title: "Divide & Ball",
        body: `Turn onto a lightly floured surface. Divide into ${totals.balls} equal portion${totals.balls > 1 ? 's' : ''}. Shape each into a tight ball by folding edges underneath and rotating against the surface to build tension.`
      },
      {
        title: "Ball Proof",
        time: "2–4 hours at room temp",
        body: "Place balls in a covered container. Ready when soft, puffy, and springs back slowly when poked."
      }
    ] : [
      {
        title: "Bulk Fermentation",
        time: "20–30 min room temp, then 24–72 hrs refrigerated",
        body: "Lightly oil a container, place dough inside, cover, and rest 20–30 min at room temp. Then refrigerate for 24–72 hours."
      },
      {
        title: "Divide & Ball",
        body: `Remove from fridge. Turn onto a lightly floured surface. Divide into ${totals.balls} equal portion${totals.balls > 1 ? 's' : ''}. Shape each into a tight ball by folding edges underneath and rotating against the surface.`
      },
      {
        title: "Final Cold Proof",
        time: "24–72 hrs refrigerated",
        body: "Place dough balls in a lightly oiled container and refrigerate until ready to use."
      },
      {
        title: "Warm Up Before Use",
        time: "2–3 hours",
        body: "Remove balls from fridge and let come fully to room temperature before stretching. Dough should relax and feel soft."
      }
    ]),
    {
      title: "Stretch & Top",
      body: "On a lightly floured surface, gently press and stretch from the center outward. Do not use a rolling pin — let gravity help."
    }
  ];
}
