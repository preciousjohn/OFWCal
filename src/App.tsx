import { useState, useMemo, useEffect } from "react";
import { STATES_LIST, getStateData } from "./data/stateTiers";
import {
  RESTAURANT_PROFILES,
  RESTAURANT_TYPES_LIST,
  type RestaurantType,
} from "./data/restaurantProfiles";
import { calculate, deriveStaffing } from "./calc/engine";
import type { CalcResults } from "./calc/engine";
import { exportPDF } from "./utils/exportPDF";
import ofwLogo from "./assets/ofw_logo.svg";

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
function fmtPct(n: number) { return n.toFixed(1) + "%"; }
function fmtDollar(n: number) {
  return (n < 0 ? "-" : "+") + "$" + fmt(Math.abs(n));
}

// ── Shared input components ──────────────────────────────────────────────────

function InputField({
  label, value, onChange, placeholder = "0.00", suffix, min = "0",
}: {
  label?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; suffix?: string; min?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#3d1212]">{label}</label>}
      <div className="relative flex items-center">
        <input
          type="number" min={min} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-[#e0c8c8] rounded-lg py-2.5 pl-3 text-sm bg-white text-[#3d1212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent ${suffix ? "pr-16" : "pr-3"}`}
        />
        {suffix && (
          <span className="absolute right-3 text-sm text-gray-500 pointer-events-none select-none flex items-center gap-1">
            {suffix === "USD" && <span>🇺🇸</span>}
            <span>{suffix}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function RevenueField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (!raw) { onChange(""); return; }
    const formatted = Number(raw).toLocaleString("en-US");
    onChange(formatted);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#3d1212]">{label}</label>
      <div className="relative flex items-center">
        <input
          type="text" inputMode="numeric" value={value}
          onChange={handleChange}
          placeholder="0"
          className="w-full border border-[#e0c8c8] rounded-lg py-2.5 pl-3 pr-16 text-sm bg-white text-[#3d1212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent"
        />
        <span className="absolute right-3 text-sm text-gray-500 pointer-events-none select-none flex items-center gap-1">
          <span>🇺🇸</span><span>USD</span>
        </span>
      </div>
    </div>
  );
}

function SelectField({
  label, value, onChange, options, placeholder = "Select", fullWidth = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; fullWidth?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : ""}`}>
      <label className="text-sm font-medium text-[#3d1212]">{label}</label>
      <div className="relative">
        <select
          value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[#e0c8c8] rounded-lg py-2.5 pl-3 pr-9 text-sm bg-white text-[#3d1212] focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent appearance-none cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1l5 5 5-5" stroke="#3d1212" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}

function AutoFillBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-0.5" style={{ backgroundColor: "#c9747455" }}>
      <span className="text-xl font-bold text-[#3d1212] leading-tight">{value}</span>
      <span className="text-xs text-[#5a2a2a] leading-tight">{label}</span>
    </div>
  );
}

// ── Staffing row ─────────────────────────────────────────────────────────────

interface RoleState { count: string; wage: string; }

function StaffingRow({
  role, sub, value, onChange,
}: {
  role: string; sub: string; value: RoleState; onChange: (v: RoleState) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
      {/* Role label */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[#3d1212]">{role}</span>
        <span className="text-xs text-[#7a4a4a]">{sub}</span>
      </div>
      {/* Count */}
      <div className="w-24">
        <input
          type="number" min="0" value={value.count}
          onChange={(e) => onChange({ ...value, count: e.target.value })}
          placeholder="0"
          className="w-full border border-[#e0c8c8] rounded-lg py-2.5 px-3 text-sm bg-white text-[#3d1212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent"
        />
      </div>
      {/* Wage */}
      <div className="w-36">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-sm text-gray-500 pointer-events-none">$</span>
          <input
            type="number" min="0" step="0.01" value={value.wage}
            onChange={(e) => onChange({ ...value, wage: e.target.value })}
            placeholder="0.00"
            className="w-full border border-[#e0c8c8] rounded-lg py-2.5 pl-7 pr-10 text-sm bg-white text-[#3d1212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent"
          />
          <span className="absolute right-3 text-xs text-gray-500 pointer-events-none">/hr</span>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState("");
  const [restaurantType, setRestaurantType] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [waitstaff, setWaitstaff] = useState<RoleState>({ count: "", wage: "" });
  const [cooks, setCooks] = useState<RoleState>({ count: "", wage: "" });
  const [dishwashers, setDishwashers] = useState<RoleState>({ count: "", wage: "" });
  const [results, setResults] = useState<CalcResults | null>(null);
  const [snapshotMenuPrice, setSnapshotMenuPrice] = useState("");

  const stateData = useMemo(() => (state ? getStateData(state) : null), [state]);
  const profile = useMemo(
    () => (restaurantType ? RESTAURANT_PROFILES[restaurantType as RestaurantType] : null),
    [restaurantType]
  );

  // Pre-fill wages when state changes
  useEffect(() => {
    if (!stateData) return;
    setWaitstaff((prev) => ({ ...prev, wage: String(stateData.tippedMinWage) }));
    setCooks((prev) => ({ ...prev, wage: String(stateData.minimumWage) }));
    setDishwashers((prev) => ({ ...prev, wage: String(stateData.minimumWage) }));
  }, [stateData]);

  const staffingPreview = useMemo(() => {
    const wc = parseInt(waitstaff.count);
    const cc = parseInt(cooks.count);
    const dc = parseInt(dishwashers.count);
    if (!profile || !wc || !cc || !dc) return null;
    return deriveStaffing(wc, cc, dc, profile);
  }, [waitstaff.count, cooks.count, dishwashers.count, profile]);

  const canCalculate =
    state && restaurantType &&
    parseFloat(annualRevenue.replace(/,/g, "")) > 0 &&
    parseFloat(menuPrice) > 0 &&
    parseInt(waitstaff.count) >= 1 && parseFloat(waitstaff.wage) > 0 &&
    parseInt(cooks.count) >= 1 && parseFloat(cooks.wage) > 0 &&
    parseInt(dishwashers.count) >= 1 && parseFloat(dishwashers.wage) > 0;

  const handleCalculate = () => {
    if (!stateData || !profile) return;
    const rev = parseFloat(annualRevenue.replace(/,/g, ""));
    const price = parseFloat(menuPrice);
    const wc = parseInt(waitstaff.count), ww = parseFloat(waitstaff.wage);
    const cc = parseInt(cooks.count),     cw = parseFloat(cooks.wage);
    const dc = parseInt(dishwashers.count), dw = parseFloat(dishwashers.wage);
    if (isNaN(rev) || rev <= 0 || isNaN(price) || price <= 0 ||
        isNaN(wc) || wc < 1 || isNaN(cc) || cc < 1 || isNaN(dc) || dc < 1 ||
        isNaN(ww) || ww <= 0 || isNaN(cw) || cw <= 0 || isNaN(dw) || dw <= 0) return;
    setSnapshotMenuPrice(menuPrice);
    setResults(calculate(
      { state, restaurantType, annualRevenue: rev, menuPrice: price,
        waitstaff: { count: wc, wage: ww },
        cooks: { count: cc, wage: cw },
        dishwashers: { count: dc, wage: dw } },
      profile,
      stateData.minimumWage,
      stateData.tippedMinWage,
      stateData.targetOFWWage
    ));
  };

  const handleRestart = () => {
    setResults(null);
    setSnapshotMenuPrice("");
    setState(""); setRestaurantType(""); setAnnualRevenue(""); setMenuPrice("");
    setWaitstaff({ count: "", wage: "" });
    setCooks({ count: "", wage: "" });
    setDishwashers({ count: "", wage: "" });
  };

  const handleDownloadPDF = () => {
    if (!results) return;
    exportPDF({ results, state, restaurantType, annualRevenue: parseFloat(annualRevenue.replace(/,/g, "")), menuPrice: parseFloat(menuPrice) });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fce8e8" }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 sticky top-0 z-50" style={{ backgroundColor: "#1a0a0a" }}>
        <div><img src={ofwLogo} alt="One Fair Wage" className="h-10 w-auto" /></div>
        <div className="flex items-center gap-6">
          <a href="#" className="text-white text-sm hover:text-pink-300 transition-colors">Home</a>
          <button className="border border-white text-white text-sm px-5 py-1.5 rounded-full hover:bg-white hover:text-[#1a0a0a] transition-all">
            Contact us
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-5 py-12">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-[#3d1212] mb-4">Let's Price This Out</h1>
          <p className="text-sm text-[#5a2a2a] leading-relaxed mb-2">
            To cover the wage increase in the Raise the Wage Act, Menu prices may need to increase. We've used{" "}
            <a href="#" className="underline text-[#b85c5c]">this study</a> by UC Berkeley and Harvard economists
            Sylvia Allegretto and Michael Reich to inform our formula below.
          </p>
          <p className="text-sm font-semibold text-[#3d1212]">
            Please enter the wage rates and menu item prices appropriate for your restaurant to get a result that can work for you.
          </p>
        </div>

        {/* Section 1 */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full border-2 border-[#3d1212] flex items-center justify-center text-sm font-bold text-[#3d1212] shrink-0">1</div>
            <h2 className="text-xl font-bold text-[#3d1212]">Tell us about your restaurant</h2>
          </div>
          <div className="flex flex-col gap-4">
            <SelectField label="State" value={state} onChange={setState}
              options={STATES_LIST.map((s) => ({ value: s.abbreviation, label: s.name }))}
              placeholder="Select state" fullWidth />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Restaurant Type" value={restaurantType} onChange={setRestaurantType}
                options={RESTAURANT_TYPES_LIST} placeholder="Select type" />
              <RevenueField label="Annual Revenue" value={annualRevenue} onChange={setAnnualRevenue} />
            </div>
            {annualRevenue && parseFloat(annualRevenue.replace(/,/g, "")) > 20_000_000 && (
              <p className="text-xs rounded-lg px-3 py-2 border" style={{ color: "#7a4a00", backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}>
                This revenue is unusually high for a single restaurant location — most full-service restaurants generate $500K–$5M annually. If you're modeling a chain or multiple locations, results may not reflect a typical single-location scenario.
              </p>
            )}
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            {/* Outline circle — same style as section 1 */}
            <div className="w-9 h-9 rounded-full border-2 border-[#3d1212] flex items-center justify-center text-sm font-bold text-[#3d1212] shrink-0">2</div>
            <h2 className="text-xl font-bold text-[#3d1212]">Tell us about your team</h2>
          </div>
          <div className="flex flex-col gap-5">
            {/* Staffing header row */}
            <div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 mb-1 px-0">
                <span className="text-sm font-medium text-[#3d1212]">Role</span>
                <span className="text-sm font-medium text-[#3d1212] w-24 text-center">How many?</span>
                <span className="text-sm font-medium text-[#3d1212] w-36 text-center">Current hourly pay</span>
              </div>
              <div className="flex flex-col gap-3 border border-[#e0c8c8] rounded-xl p-4 bg-white/50">
                <StaffingRow role="Waitstaff" sub="FOH" value={waitstaff} onChange={setWaitstaff} />
                <div className="border-t border-[#e0c8c8]" />
                <StaffingRow role="Cooks" sub="BOH" value={cooks} onChange={setCooks} />
                <div className="border-t border-[#e0c8c8]" />
                <StaffingRow role="Dishwashers" sub="BOH" value={dishwashers} onChange={setDishwashers} />
              </div>
            </div>

            <InputField label="Average menu item price" value={menuPrice} onChange={setMenuPrice} suffix="USD" />
          </div>
        </section>

        {/* Calculate */}
        <button
          onClick={handleCalculate}
          disabled={!canCalculate}
          className="w-full py-4 rounded-full text-white font-semibold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 mb-6"
          style={{ backgroundColor: "#3d1212" }}
        >
          Calculate
        </button>

        {/* Auto-fill badges */}
        {(stateData || staffingPreview) && (
          <div className="mb-6">
            <div className="grid grid-cols-4 gap-3 mb-2">
              <AutoFillBadge value={staffingPreview?.totalStaff ?? "—"} label="Total staff number" />
              <AutoFillBadge value={stateData ? "$" + stateData.minimumWage.toFixed(2) : "—"} label="Minimum wage" />
              <AutoFillBadge value={stateData ? "$" + stateData.tippedMinWage.toFixed(2) : "—"} label="Tipped minimum wage" />
              <AutoFillBadge value={stateData ? "$" + stateData.targetOFWWage : "—"} label="Target OFW wage" />
            </div>
            <p className="text-center text-xs text-[#7a4a4a]">Autofilled calculations based on your input</p>
            {staffingPreview && annualRevenue && (() => {
              const rev = parseFloat(annualRevenue.replace(/,/g, ""));
              return !isNaN(rev) && rev > 0 && rev / staffingPreview.totalStaff < 30_000;
            })() && (
              <p className="mt-2 text-xs rounded-lg px-3 py-2 border text-center" style={{ color: "#7a4a00", backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}>
                Your revenue seems low for this many staff. Double-check your annual revenue.
              </p>
            )}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-5">
            {/* Hero result */}
            <div className="rounded-2xl p-6" style={{ backgroundColor: "#3d1212" }}>
              <h3 className="text-white font-semibold mb-5">Your result</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-white/70 text-sm">To pay all workers</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white font-bold text-2xl">${results.targetOFWWage}</span>
                    <span className="text-white/60 text-sm">/hr</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-sm">You need to increase menu prices by</span>
                  <span className="text-3xl font-bold" style={{ color: "#f87171" }}>
                    {fmtPct(results.requiredMenuIncreasePercent)}
                  </span>
                </div>
                {results.requiredMenuIncreasePercent === 0 && (
                  <p className="text-xs text-white/50 mt-1">
                    Your reported revenue already covers OFW wages at break-even — no price increase is needed to reach that threshold. Check that your annual revenue reflects a single location.
                  </p>
                )}
              </div>

              <div className="mt-5 p-4 rounded-xl bg-white/10 text-sm text-white/80 leading-relaxed">
                Your{" "}
                <span className="font-semibold text-white">${fmt(parseFloat(snapshotMenuPrice))}</span>{" "}
                plate becomes{" "}
                <span className="font-semibold text-white">${fmt(results.breakEven.newMenuPrice)}</span>
                {" "}— but your customer no longer tips. They currently pay{" "}
                <span className="font-semibold text-white">${fmt(results.breakEven.customerPaidBefore)}</span>{" "}
                with tip. They'd pay{" "}
                <span className="font-semibold text-white">${fmt(results.breakEven.customerPaysWithNewSystem)}</span>{" "}
                without. That's{" "}
                <span className={`font-semibold ${results.breakEven.customerDelta <= 0 ? "text-green-300" : "text-red-300"}`}>
                  {fmtDollar(results.breakEven.customerDelta)}
                </span>{" "}
                {results.breakEven.customerDelta <= 0 ? "less" : "more"}.
              </div>
            </div>

            {/* Three scenarios table */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="grid grid-cols-4 gap-2 mb-3 items-end">
                <div />
                {["Break-Even", "Comfortable", "Match Current"].map((t) => (
                  <div key={t} className="text-center text-xs font-semibold text-[#3d1212]">{t}</div>
                ))}
              </div>

              {[
                {
                  label: "Menu increase",
                  values: [fmtPct(results.breakEven.menuIncreasePercent), fmtPct(results.comfortable.menuIncreasePercent), fmtPct(results.matchCurrent.menuIncreasePercent)],
                  color: "#b85252",
                },
                {
                  label: "$20 plate becomes",
                  values: ["$" + fmt(20 * (1 + results.breakEven.menuIncreasePercent / 100)), "$" + fmt(20 * (1 + results.comfortable.menuIncreasePercent / 100)), "$" + fmt(20 * (1 + results.matchCurrent.menuIncreasePercent / 100))],
                  color: "#b85252",
                },
                {
                  label: "Customer pays vs today w/tip",
                  values: [fmtDollar(results.breakEven.customerDelta), fmtDollar(results.comfortable.customerDelta), fmtDollar(results.matchCurrent.customerDelta)],
                  colors: [
                    results.breakEven.customerDelta <= 0 ? "#15803d" : "#dc2626",
                    results.comfortable.customerDelta <= 0 ? "#15803d" : "#dc2626",
                    results.matchCurrent.customerDelta <= 0 ? "#15803d" : "#dc2626",
                  ],
                },
                {
                  label: "Monthly profit",
                  values: [
                    (results.breakEven.monthlyProfit < 0 ? "-$" : "$") + fmt(Math.abs(results.breakEven.monthlyProfit), 0),
                    (results.comfortable.monthlyProfit < 0 ? "-$" : "$") + fmt(Math.abs(results.comfortable.monthlyProfit), 0),
                    (results.matchCurrent.monthlyProfit < 0 ? "-$" : "$") + fmt(Math.abs(results.matchCurrent.monthlyProfit), 0),
                  ],
                  colors: [
                    results.breakEven.monthlyProfit >= 0 ? "#15803d" : "#dc2626",
                    results.comfortable.monthlyProfit >= 0 ? "#15803d" : "#dc2626",
                    results.matchCurrent.monthlyProfit >= 0 ? "#15803d" : "#dc2626",
                  ],
                },
              ].map((row, ri) => (
                <div key={ri} className="grid grid-cols-4 gap-2 py-2 border-t border-gray-100 items-center">
                  <span className="text-xs text-[#5a2a2a]">{row.label}</span>
                  {row.values.map((v, i) => {
                    const c = row.colors ? row.colors[i] : row.color!;
                    return (
                      <div key={i} className="text-center rounded-lg py-1.5 px-2 text-xs font-semibold" style={{ backgroundColor: c + "22", color: c }}>
                        {v}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button onClick={handleDownloadPDF} className="flex items-center justify-center gap-2 py-4 rounded-full text-white font-semibold transition-all hover:opacity-90" style={{ backgroundColor: "#3d1212" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </button>
              <button onClick={handleRestart} className="py-4 rounded-full text-white font-semibold transition-all hover:opacity-90" style={{ backgroundColor: "#3d1212" }}>
                Restart
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-[#7a4a4a]">©2026 All rights reserved.</footer>
    </div>
  );
}
