import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingCart, Search, MapPin, IndianRupee, SlidersHorizontal, X } from "lucide-react";
import AuctionGrid from "../components/AuctionGrid";

const BUDGETS = [
  { label: "Any Budget", value: "" },
  { label: "Under ₹3L", value: "300000" },
  { label: "Under ₹5L", value: "500000" },
  { label: "Under ₹8L", value: "800000" },
  { label: "Under ₹12L", value: "1200000" },
];

export default function BuyCar() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const brand = params.get("brand") || "";
  const city = params.get("location") || "";
  const bodyType = params.get("bodyType") || "";
  const budget = params.get("budget") || "";
  const maxPrice = /^\d+(\.\d+)?$/.test(budget) && Number(budget) > 0 ? budget : "";

  function updateFilter(name, value) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    }, { replace: true });
  }
  const setSearch = (value) => updateFilter("q", value);
  const setMaxPrice = (value) => updateFilter("budget", value);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [resultsCount, setResultsCount] = useState(null);

  const activeFilterCount = [search, maxPrice, brand, city, bodyType].filter(Boolean).length;

  function clearAll() {
    setParams({});
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16" data-buy-car>
      <div className="flex items-center gap-2 mb-2 text-[#1E6FD9]">
        <ShoppingCart size={20} className="sm:hidden" />
        <ShoppingCart size={22} className="hidden sm:block" />
        <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase">Buy Car</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-[#0B2545] mb-2">Buy Used Cars</h1>
      <p className="text-gray-500 mb-6 max-w-2xl text-sm sm:text-base">
        Find a used car at its listed price. Review photos, vehicle details and available
        inspection reports, then contact our team to confirm availability and purchase details.
      </p>

      {/* Search + Filter bar */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by make, model..."
            className="w-full text-sm outline-none bg-transparent placeholder:text-gray-400 min-w-0"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className="relative shrink-0 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-sm text-sm font-medium text-[#0B2545] hover:bg-gray-50 transition"
        >
          <SlidersHorizontal size={17} />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[#1E6FD9] text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Quick budget chips — horizontally scrollable on mobile */}
      <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Budget</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {BUDGETS.map((b) => (
            <button
              key={b.value}
              onClick={() => setMaxPrice(b.value)}
              className={`shrink-0 flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border transition whitespace-nowrap ${
                maxPrice === b.value
                  ? "bg-[#1E6FD9] text-white border-[#1E6FD9] font-semibold"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {b.value && <IndianRupee size={12} className="shrink-0" />}
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <p className="text-sm text-gray-600 mb-4" aria-live="polite">
          Active filters: {[search, brand, bodyType, city, maxPrice && `Up to ₹${Number(maxPrice).toLocaleString("en-IN")}`].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* Results bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <p className="text-xs sm:text-sm text-gray-500">
          {resultsCount === null ? "Loading results…" : (
            <>Showing <span className="font-semibold text-[#0B2545]">{resultsCount}</span> {resultsCount === 1 ? "result" : "results"}</>
          )}
        </p>
        {activeFilterCount > 0 && (
          <button onClick={clearAll} className="text-xs sm:text-sm font-medium text-[#1E6FD9] hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Grid — full width now; filters live in the drawer/panel above */}
      <AuctionGrid   mode="buy_now"   filters={{ search, maxPrice, brands: brand ? [brand] : [], city, bodyType }}   onResultsCount={setResultsCount} />

      <div className="mt-10 sm:mt-14 flex items-center gap-3 border border-gray-200 rounded-2xl px-4 sm:px-6 py-4 sm:py-5 bg-[#DCEAFB]">
        <ShoppingCart size={20} className="text-[#1E6FD9] shrink-0" />
        <p className="text-xs sm:text-sm text-gray-600">
          Need help choosing a car? Our team can help with vehicle details, purchase enquiries and finance options.
        </p>
      </div>

      {/* Filter drawer — slides up on mobile, centered modal on desktop */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-lg text-[#0B2545]">Filters</h3>
              <button onClick={() => setFiltersOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Location */}
            <div className="mb-5">
              <label htmlFor="filter-location" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</label>
              <div className="mt-2 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <MapPin size={16} className="text-gray-400 shrink-0" />
                <input id="filter-location" value={city} onChange={(e) => updateFilter("location", e.target.value)} placeholder="All locations" className="w-full bg-transparent text-sm outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <label className="text-sm">Brand
                <input value={brand} onChange={(e) => updateFilter("brand", e.target.value)} placeholder="All brands" className="input mt-2" />
              </label>
              <label className="text-sm">Body type
                <select value={bodyType} onChange={(e) => updateFilter("bodyType", e.target.value)} className="input mt-2">
                  <option value="">All Cars</option>
                  <option>Sedan</option><option>SUV</option><option>Hatchback</option>
                </select>
              </label>
            </div>
            <label className="block text-sm mb-4">Maximum price (₹)
              <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="input mt-2" placeholder="Any budget" />
            </label>

            {/* Budget */}
            <div className="mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</label>
              <div className="mt-2 flex flex-col gap-1.5">
                {BUDGETS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setMaxPrice(b.value)}
                    className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg text-left transition ${
                      maxPrice === b.value
                        ? "bg-[#DCEAFB] text-[#1E6FD9] font-semibold border border-[#BFDBFE]"
                        : "text-gray-600 hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <IndianRupee size={14} className="shrink-0" />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={clearAll}
                className="flex-1 text-sm font-semibold text-[#1E6FD9] border border-[#BFDBFE] rounded-xl py-2.5 hover:bg-[#F5F9FF] transition"
              >
                Clear All
              </button>
              <button
                onClick={() => setFiltersOpen(false)}
                className="flex-1 text-sm font-semibold text-white bg-[#1E6FD9] rounded-xl py-2.5 hover:bg-[#1858B0] transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
