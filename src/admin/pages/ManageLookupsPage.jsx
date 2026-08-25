import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { LOOKUPS, FEATURE_CATEGORIES } from "../lib/lookups";
import { addLookupValue, deleteLookupValue, addFeature } from "../lib/carsApi";
import { useLookups } from "../hooks/useLookups";
import { inputClass } from "../components/FormSection";

function LookupCard({ title, table, items, onAdd, onDelete }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onAdd(table, value.trim());
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="flex gap-2 mb-3">
        <input
          className={inputClass}
          placeholder={`New ${title.toLowerCase()}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-3 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it.id}
            className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-sm"
          >
            {it.name}
            <button onClick={() => onDelete(table, it.id)} className="text-zinc-500 hover:text-red-400 p-0.5">
              <Trash2 size={12} />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-zinc-500">No values yet</span>}
      </div>
    </div>
  );
}

export default function ManageLookupsPage() {
  const { lookups, features, loading, error, reload } = useLookups();

  async function handleAdd(table, name) {
    await addLookupValue(table, { name });
    await reload();
  }
  async function handleDelete(table, id) {
    await deleteLookupValue(table, id);
    await reload();
  }
  async function handleAddFeature(category, name) {
    await addFeature(category, name);
    await reload();
  }

  if (loading) return <p className="text-zinc-400">Loading dropdown settings...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dropdown Settings</h1>
      <p className="text-zinc-400 mb-6">
        Anything added here shows up immediately in the Add Car form — no code changes needed.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {Object.entries(LOOKUPS).map(([key, cfg]) => (
          <LookupCard
            key={key}
            title={cfg.label}
            table={cfg.table}
            items={lookups[key] || []}
            onAdd={handleAdd}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <h2 className="text-xl font-bold mb-4">Feature Catalogue</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {FEATURE_CATEGORIES.map(({ category, label }) => (
          <div key={category} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="font-semibold mb-3">{label}</h3>
            <FeatureAdder category={category} onAdd={handleAddFeature} />
            <div className="flex flex-wrap gap-2 mt-3">
              {features
                .filter((f) => f.category === category)
                .map((f) => (
                  <span
                    key={f.id}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-sm"
                  >
                    {f.name}
                    <button
                      onClick={() => handleDelete("features", f.id)}
                      className="text-zinc-500 hover:text-red-400 p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureAdder({ category, onAdd }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onAdd(category, value.trim());
      setValue("");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex gap-2">
      <input
        className={inputClass}
        placeholder="New feature"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
      />
      <button onClick={submit} disabled={saving} className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-3 disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
      </button>
    </div>
  );
}
