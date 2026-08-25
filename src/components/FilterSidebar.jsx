import { useState } from "react";
import { SlidersHorizontal, ChevronDown, ChevronRight, MapPin } from "lucide-react";

const ACCENT = "#0F9A9A"; // teal, matches the reference design

function formatINR(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)},000`;
  return `₹${n}`;
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[#E7ECF3] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold" style={{ color: ACCENT }}>
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`text-[#8A96AC] transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/**
 * Two-thumb range slider built from two overlapping <input type="range">
 * elements — a standard, dependency-free technique. `min`/`max` are the
 * absolute bounds; `value` is [lo, hi].
 */
function DualRangeSlider({ min, max, step = 1, value, onChange, formatLabel = (v) => v }) {
  const [lo, hi] = value;

  const pct = (v) => ((v - min) / (max - min)) * 100;

  return (
    <div className="pt-2">
      <div className="relative h-1.5">
        <div className="absolute inset-0 rounded-full bg-[#E7ECF3]" />
        <div
          className="absolute h-1.5 rounded-full"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%`, backgroundColor: ACCENT }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), hi - step);
            onChange([next, hi]);
          }}
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: lo > max - step ? 5 : 3 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), lo + step);
            onChange([lo, next]);
          }}
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="flex items-center justify-between mt-2.5 text-xs font-medium text-[#5C6A82]">
        <span>{formatLabel(lo)}</span>
        <span>{formatLabel(hi)}</span>
      </div>

      {/* Thumb styling — scoped via a plain <style> tag so no external
          stylesheet or Tailwind plugin is required for range inputs. */}
      <style>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #fff;
          border: 2.5px solid ${ACCENT};
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          cursor: pointer;
          margin-top: 0;
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #fff;
          border: 2.5px solid ${ACCENT};
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          cursor: pointer;
        }
        .range-thumb::-webkit-slider-runnable-track { background: transparent; }
        .range-thumb::-moz-range-track { background: transparent; }
      `}</style>
    </div>
  );
}

const PRICE_PRESETS = [
  { label: "Under 3 Lakh", min: 0, max: 300000 },
  { label: "3-5 Lakh", min: 300000, max: 500000 },
  { label: "5-7 Lakh", min: 500000, max: 700000 },
  { label: "7-10 Lakh", min: 700000, max: 1000000 },
  { label: "Above 10 Lakh", min: 1000000, max: 11000000 },
];

const DEFAULT_CITIES = ["Delhi", "Mumbai", "Bengaluru", "Pune", "Hyderabad", "Chennai"];

/**
 * FilterSidebar
 *
 * Controlled filter panel for the buyer-facing listings page. Emits a
 * filters object shaped like:
 *   { city, brands: string[], priceMin, priceMax, yearMin, yearMax }
 * which AuctionGrid (or wherever cars are fetched/filtered) can consume.
 *
 * Props:
 *  - makeOptions: [{ name, count }] — brand checkboxes with live counts.
 *    Pass real counts computed from your cars list; falls back to a
 *    reasonable default set if omitted.
 *  - priceCounts: { [presetLabel]: number } — optional live counts next
 *    to each price preset button.
 *  - cities: string[] — optional city list, defaults to a few metros.
 *  - bounds: { priceMin, priceMax, yearMin, yearMax } — absolute slider
 *    bounds. Defaults roughly match a used-car marketplace's real range.
 *  - value / onChange: controlled filters state, same shape as emitted above.
 */
export default function FilterSidebar({
  makeOptions = [
    { name: "Audi", count: 11 },
    { name: "BMW", count: 10 },
    { name: "Chevrolet", count: 2 },
    { name: "Datsun", count: 1 },
    { name: "Ford", count: 35 },
    { name: "Honda", count: 65 },
    { name: "Hyundai", count: 152 },
  ],
  priceCounts = { "Under 3 Lakh": 103, "3-5 Lakh": 233, "5-7 Lakh": 130, "7-10 Lakh": 116, "Above 10 Lakh": 228 },
  cities = DEFAULT_CITIES,
  bounds = { priceMin: 85000, priceMax: 11000000, yearMin: 2011, yearMax: 2026 },
  value,
  onChange,
}) {
  const filters = value ?? {
    city: cities[0],
    brands: [],
    priceMin: bounds.priceMin,
    priceMax: bounds.priceMax,
    yearMin: bounds.yearMin,
    yearMax: bounds.yearMax,
  };

  const [cityOpen, setCityOpen] = useState(false);

  function patch(next) {
    onChange?.({ ...filters, ...next });
  }

  function toggleBrand(name) {
    const has = filters.brands.includes(name);
    patch({ brands: has ? filters.brands.filter((b) => b !== name) : [...filters.brands, name] });
  }

  function applyPreset(preset) {
    patch({ priceMin: preset.min, priceMax: preset.max });
  }

  return (
    <div className="w-full max-w-xs space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <SlidersHorizontal size={16} style={{ color: ACCENT }} />
        <h2 className="text-sm font-bold text-[#0B2545]">Filters</h2>
      </div>

      {/* City */}
      <div>
        <p className="text-xs font-semibold mb-2 px-1" style={{ color: ACCENT }}>
          City
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCityOpen((o) => !o)}
            className="w-full flex items-center justify-between rounded-2xl border border-[#E7ECF3] bg-white px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-[#0B2545]">
              <MapPin size={15} style={{ color: ACCENT }} />
              {filters.city}
            </span>
            <ChevronDown size={15} className="text-[#8A96AC]" />
          </button>
          {cityOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-[#E7ECF3] bg-white shadow-lg py-1 max-h-56 overflow-auto">
              {cities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    patch({ city: c });
                    setCityOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[#F5F8FD] ${
                    c === filters.city ? "font-semibold text-[#0B2545]" : "text-[#5C6A82]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Make & Model */}
      <Section title="Make & Model">
        <div className="space-y-0.5 max-h-64 overflow-auto -mx-1 px-1">
          {makeOptions.map((m) => (
            <label
              key={m.name}
              className="flex items-center justify-between gap-2 py-2 cursor-pointer group"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  checked={filters.brands.includes(m.name)}
                  onChange={() => toggleBrand(m.name)}
                  className="h-4 w-4 rounded border-[#C7D0E0] shrink-0"
                  style={{ accentColor: ACCENT }}
                />
                <span className="text-sm text-[#33405C] truncate">{m.name}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-[#8A96AC] tabular-nums">{m.count}</span>
                <ChevronRight size={14} className="text-[#C7D0E0]" />
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* Price Range */}
      <Section title="Price Range">
        <div className="space-y-2 mb-3">
          {PRICE_PRESETS.map((preset) => {
            const active = filters.priceMin === preset.min && filters.priceMax === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition ${
                  active ? "text-white" : "bg-[#F5F8FD] text-[#33405C] hover:bg-[#EDF2FA]"
                }`}
                style={active ? { backgroundColor: ACCENT } : undefined}
              >
                <span>{preset.label}</span>
                <span className={active ? "text-white/80" : "text-[#8A96AC]"}>
                  ({priceCounts[preset.label] ?? 0})
                </span>
              </button>
            );
          })}
        </div>
        <DualRangeSlider
          min={bounds.priceMin}
          max={bounds.priceMax}
          step={5000}
          value={[filters.priceMin, filters.priceMax]}
          onChange={([lo, hi]) => patch({ priceMin: lo, priceMax: hi })}
          formatLabel={formatINR}
        />
      </Section>

      {/* Year Range */}
      <Section title="Year Range">
        <DualRangeSlider
          min={bounds.yearMin}
          max={bounds.yearMax}
          step={1}
          value={[filters.yearMin, filters.yearMax]}
          onChange={([lo, hi]) => patch({ yearMin: lo, yearMax: hi })}
        />
      </Section>
    </div>
  );
}
