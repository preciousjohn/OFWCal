import { useState, useMemo, useEffect, useRef } from "react";
import { STATES_LIST, getStateData } from "./data/stateTiers";
import {
  RESTAURANT_PROFILES,
  RESTAURANT_TYPES_LIST,
  type RestaurantType,
} from "./data/restaurantProfiles";
import { calculate, deriveStaffing } from "./calc/engine";
import type { CalcResults } from "./calc/engine";
import { exportPDF } from "./utils/exportPDF";
import { fetchStateWages, WAGE_DATA_DATE } from "./utils/fetchStateWages";
import ofwLogo from "./assets/ofw_logo.svg";

// ── Types ─────────────────────────────────────────────────────────────────────

type ImplModel = "menu_price" | "service_charge" | "loyalty" | "phased_hybrid";

interface RoleState { count: string; wage: string; }

interface SnapshotInputs {
  wc: number; ww: number;
  cc: number; cw: number;
  dc: number; dw: number;
  rev: number; target: number; menuPriceNum: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const WEEKS_PER_MONTH = 52 / 12;

const IMPL_MODELS: Array<{
  id: ImplModel; title: string; description: string;
  available: RestaurantType[] | "all";
}> = [
  {
    id: "menu_price",
    title: "Menu Price Adjustment",
    description: "Increase menu prices to cover fair wages. Tips are eliminated.",
    available: "all",
  },
  {
    id: "service_charge",
    title: "Service Charge",
    description: "Keep menu prices the same. Add an 18–20% service charge that funds fair wages.",
    available: ["full_service_casual", "full_service_upscale", "bar_nightclub"] as RestaurantType[],
  },
  {
    id: "loyalty",
    title: "Loyalty & Membership",
    description: "Offer a monthly membership that locks in recurring revenue to fund fair wages.",
    available: ["cafe_bakery", "fast_casual", "fast_food"] as RestaurantType[],
  },
  {
    id: "phased_hybrid",
    title: "Phased Hybrid",
    description: "Combine a smaller menu increase with gradual wage raises over multiple years.",
    available: "all",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(n: number) { return n.toFixed(1) + "%"; }
function fmtDollar(n: number) {
  return (n < 0 ? "-" : "+") + "$" + fmt(Math.abs(n));
}
function fmtMoney(n: number, decimals = 0) {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (n < 0 ? "-$" : "$") + s;
}

// ── LabelTooltip (light background context) ───────────────────────────────────

function LabelTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="text-[#b85c5c] hover:text-[#3d1212] transition-colors leading-none select-none"
        aria-label="More information" style={{ fontSize: "13px" }}>
        ℹ️
      </button>
      {open && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 rounded-xl p-3 text-xs leading-relaxed shadow-xl"
          style={{ backgroundColor: "#3d1212", color: "rgba(255,255,255,0.9)" }}>
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderTopColor: "#3d1212" }} />
        </div>
      )}
    </div>
  );
}

// ── InfoTooltip (dark background context, hero card) ──────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button onClick={() => setOpen(v => !v)}
        className="text-white/60 hover:text-white/90 transition-colors leading-none select-none"
        aria-label="More information" style={{ fontSize: "16px" }}>
        ℹ️
      </button>
      {open && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 rounded-xl p-3 text-xs leading-relaxed shadow-xl"
          style={{ backgroundColor: "#1a0a0a", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderTopColor: "#1a0a0a" }} />
        </div>
      )}
    </div>
  );
}

// ── Form input components ────────────────────────────────────────────────────

function InputField({
  label, value, onChange, placeholder = "0.00", suffix, min = "0", tooltip,
}: {
  label?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; suffix?: string; min?: string; tooltip?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium text-[#3d1212]">{label}</label>
          {tooltip && <LabelTooltip text={tooltip} />}
        </div>
      )}
      <div className="relative flex items-center">
        <input type="number" min={min} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
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

function RevenueField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (!raw) { onChange(""); return; }
    onChange(Number(raw).toLocaleString("en-US"));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#3d1212]">{label}</label>
      <div className="relative flex items-center">
        <input type="text" inputMode="numeric" value={value} onChange={handleChange} placeholder="0"
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
  label, value, onChange, options, placeholder = "Select", fullWidth = false, note,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; fullWidth?: boolean; note?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : ""}`}>
      <label className="text-sm font-medium text-[#3d1212]">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[#e0c8c8] rounded-lg py-2.5 pl-3 pr-9 text-sm bg-white text-[#3d1212] focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent appearance-none cursor-pointer">
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1l5 5 5-5" stroke="#3d1212" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      {note && <p className="text-sm text-[#7a4a4a]">{note}</p>}
    </div>
  );
}

function AutoFillBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-0.5" style={{ backgroundColor: "#c9747455" }}>
      <span className="text-xl font-bold text-[#3d1212] leading-tight">{value}</span>
      <span className="text-sm text-[#5a2a2a] leading-tight">{label}</span>
    </div>
  );
}

function StaffingRow({ role, sub, value, onChange }: {
  role: string; sub: string; value: RoleState; onChange: (v: RoleState) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[#3d1212]">{role}</span>
        <span className="text-sm text-[#7a4a4a]">{sub}</span>
      </div>
      <div className="w-24">
        <input type="number" min="0" value={value.count}
          onChange={(e) => onChange({ ...value, count: e.target.value })} placeholder="0"
          className="w-full border border-[#e0c8c8] rounded-lg py-2.5 px-3 text-sm bg-white text-[#3d1212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent"
        />
      </div>
      <div className="w-36">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-sm text-gray-500 pointer-events-none">$</span>
          <input type="number" min="0" step="0.01" value={value.wage}
            onChange={(e) => onChange({ ...value, wage: e.target.value })} placeholder="0.00"
            className="w-full border border-[#e0c8c8] rounded-lg py-2.5 pl-7 pr-10 text-sm bg-white text-[#3d1212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent"
          />
          <span className="absolute right-3 text-xs text-gray-500 pointer-events-none">/hr</span>
        </div>
      </div>
    </div>
  );
}

// ── YearSlider ────────────────────────────────────────────────────────────────

function YearSlider({ value, onChange, baseYear }: {
  value: number; onChange: (n: number) => void; baseYear: number;
}) {
  const pct = ((value - 1) / 4) * 100;
  const sizes = [13, 13, 13, 13, 13];

  return (
    <div>
      {/* Clickable year labels — font grows left-to-right */}
      <div className="flex justify-between items-end mb-3 px-1">
        {[1, 2, 3, 4, 5].map((n, i) => {
          const active = value === n;
          return (
            <button key={n} type="button" onClick={() => onChange(n)}
              className="flex flex-col items-center gap-0.5 transition-all"
              style={{ minWidth: 0 }}>
              <span style={{
                fontSize: `${sizes[i]}px`,
                fontWeight: active ? 700 : 500,
                color: active ? "#3d1212" : "#9a7070",
                lineHeight: 1,
                transition: "color 0.15s, font-weight 0.15s",
              }}>
                {baseYear + n}
              </span>
              <span style={{
                fontSize: "10px",
                color: active ? "#3d1212" : "#b8a0a0",
                fontWeight: active ? 600 : 400,
              }}>
                {n}yr
              </span>
            </button>
          );
        })}
      </div>

      {/* Colored track slider */}
      <div className="px-1">
        <input
          type="range" min={1} max={5} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full appearance-none cursor-pointer"
          style={{
            height: "6px",
            borderRadius: "9999px",
            outline: "none",
            background: `linear-gradient(to right, #3d1212 0%, #3d1212 ${pct}%, #e0c8c8 ${pct}%, #e0c8c8 100%)`,
            accentColor: "#3d1212",
          }}
        />
      </div>

      {/* Start / end labels */}
      <div className="flex justify-between mt-2 px-1">
        <span className="text-xs text-[#7a4a4a]">{baseYear} <span className="italic">(today)</span></span>
        <span className="text-sm font-bold text-[#3d1212]">{baseYear + value}</span>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [state, setState] = useState("");
  const [restaurantType, setRestaurantType] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [waitstaff, setWaitstaff] = useState<RoleState>({ count: "", wage: "" });
  const [cooks, setCooks] = useState<RoleState>({ count: "", wage: "" });
  const [dishwashers, setDishwashers] = useState<RoleState>({ count: "", wage: "" });

  // ── Results state ──────────────────────────────────────────────────────────
  const [results, setResults] = useState<CalcResults | null>(null);
  const [, setSnapshotMenuPrice] = useState("");
  const [snapshotInputs, setSnapshotInputs] = useState<SnapshotInputs | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [implModel, setImplModel] = useState<ImplModel>("menu_price");
  const [transitionYears, setTransitionYears] = useState(3);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [_wageSource] = useState<"live" | "static">("static");

  // ── Computed ───────────────────────────────────────────────────────────────
  const stateData = useMemo(() => (state ? getStateData(state) : null), [state]);
  const profile = useMemo(
    () => (restaurantType ? RESTAURANT_PROFILES[restaurantType as RestaurantType] : null),
    [restaurantType]
  );
  const staffingPreview = useMemo(() => {
    const wc = parseInt(waitstaff.count), cc = parseInt(cooks.count), dc = parseInt(dishwashers.count);
    if (!profile || !wc || !cc || !dc) return null;
    return deriveStaffing(wc, cc, dc, profile);
  }, [waitstaff.count, cooks.count, dishwashers.count, profile]);

  const availableModels = useMemo(() =>
    IMPL_MODELS.filter(m =>
      m.available === "all" || (m.available as RestaurantType[]).includes(restaurantType as RestaurantType)
    ), [restaurantType]);

  const canCalculate =
    state && restaurantType &&
    parseFloat(annualRevenue.replace(/,/g, "")) > 0 &&
    parseFloat(menuPrice) > 0 &&
    parseInt(waitstaff.count) >= 1 && parseFloat(waitstaff.wage) > 0 &&
    parseInt(cooks.count) >= 1 && parseFloat(cooks.wage) > 0 &&
    parseInt(dishwashers.count) >= 1 && parseFloat(dishwashers.wage) > 0;

  // ── Derived display values (re-computed whenever results or slider change) ──
  const derived = useMemo(() => {
    if (!results || !snapshotInputs || !profile) return null;
    const si = snapshotInputs;
    const r = results;
    const d = r.diagnostics;

    const heroTicket = si.menuPriceNum * (1 + r.requiredMenuIncreasePercent / 100);
    const customerPaidBefore = si.menuPriceNum * (1 + profile.tipRatePercent);
    const customerDelta = heroTicket - customerPaidBefore;

    // Per-role approximate monthly costs (display only, excludes payroll tax/OT/mgmt)
    const curWaitstaffMo = si.wc * si.ww * profile.avgHoursPerWeekFOH * WEEKS_PER_MONTH;
    const curCooksMo = si.cc * si.cw * profile.avgHoursPerWeekBOH * WEEKS_PER_MONTH;
    const curDishMo = si.dc * si.dw * profile.avgHoursPerWeekBOH * WEEKS_PER_MONTH;
    const ofwWaitstaffMo = si.wc * si.target * profile.avgHoursPerWeekFOH * WEEKS_PER_MONTH;
    const ofwCooksMo = si.cc * si.target * profile.avgHoursPerWeekBOH * WEEKS_PER_MONTH;
    const ofwDishMo = si.dc * si.target * profile.avgHoursPerWeekBOH * WEEKS_PER_MONTH;

    // Service charge model
    const avgTicketWithTip = si.menuPriceNum * (1 + profile.tipRatePercent);
    const serviceChargeRate = Math.min(0.20, (d.payrollGapMonthly * 12) / si.rev);
    const scCustomerPays = si.menuPriceNum * (1 + serviceChargeRate);
    const scDelta = scCustomerPays - avgTicketWithTip;

    // Loyalty / membership model
    const monthlyCustomers = Math.max(1, si.rev / (12 * Math.max(0.01, avgTicketWithTip)));
    const memberCount = Math.max(1, Math.round(monthlyCustomers * 0.15));
    const membershipPrice = d.payrollGapMonthly / memberCount;

    // Timeline
    const avgCurrentWage = (si.wc * si.ww + si.cc * si.cw + si.dc * si.dw) / Math.max(1, si.wc + si.cc + si.dc);
    const timeline = Array.from({ length: transitionYears + 1 }, (_, i) => {
      const frac = transitionYears === 0 ? 1 : i / transitionYears;
      const wage = avgCurrentWage + (si.target - avgCurrentWage) * frac;
      const menuAdjPct = r.requiredMenuIncreasePercent * frac;
      const ticket = si.menuPriceNum * (1 + menuAdjPct / 100);
      const inflation = si.menuPriceNum * Math.pow(1.03, i);
      const labor = d.currentMonthlyPayroll + d.payrollGapMonthly * frac;
      const rev = (si.rev * (1 + menuAdjPct / 100)) / 12;
      const profit = rev * (1 - profile.cogsPercent) - labor - d.annualOpex / 12;
      return { year: CURRENT_YEAR + i, wage, menuAdjPct, ticket, inflation, profit };
    });

    const tipsSavedMo = (si.rev / 12) * profile.tipRatePercent;

    return {
      heroTicket, customerPaidBefore, customerDelta,
      curWaitstaffMo, curCooksMo, curDishMo,
      ofwWaitstaffMo, ofwCooksMo, ofwDishMo,
      serviceChargeRate, scCustomerPays, scDelta,
      memberCount, membershipPrice,
      avgCurrentWage, timeline, tipsSavedMo,
    };
  }, [results, snapshotInputs, profile, transitionYears]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!stateData) return;
    setWaitstaff(prev => ({ ...prev, wage: String(stateData.tippedMinWage) }));
    setCooks(prev => ({ ...prev, wage: String(stateData.minimumWage) }));
    setDishwashers(prev => ({ ...prev, wage: String(stateData.minimumWage) }));
  }, [stateData]);

  useEffect(() => { fetchStateWages(); }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCalculate = () => {
    if (!stateData || !profile) return;
    const rev = parseFloat(annualRevenue.replace(/,/g, ""));
    const price = parseFloat(menuPrice);
    const wc = parseInt(waitstaff.count), ww = parseFloat(waitstaff.wage);
    const cc = parseInt(cooks.count), cw = parseFloat(cooks.wage);
    const dc = parseInt(dishwashers.count), dw = parseFloat(dishwashers.wage);
    if ([rev, price, wc, cc, dc, ww, cw, dw].some(isNaN) || rev <= 0 || price <= 0 ||
        wc < 1 || cc < 1 || dc < 1 || ww <= 0 || cw <= 0 || dw <= 0) return;
    setSnapshotMenuPrice(menuPrice);
    setSnapshotInputs({ wc, ww, cc, cw, dc, dw, rev, target: stateData.targetOFWWage, menuPriceNum: price });
    setImplModel("menu_price");
    setResults(calculate(
      { state, restaurantType, annualRevenue: rev, menuPrice: price,
        waitstaff: { count: wc, wage: ww },
        cooks: { count: cc, wage: cw },
        dishwashers: { count: dc, wage: dw } },
      profile, stateData.minimumWage, stateData.tippedMinWage, stateData.targetOFWWage
    ));
  };

  const handleRestart = () => {
    setResults(null); setSnapshotMenuPrice(""); setSnapshotInputs(null);
    setState(""); setRestaurantType(""); setAnnualRevenue(""); setMenuPrice("");
    setWaitstaff({ count: "", wage: "" }); setCooks({ count: "", wage: "" }); setDishwashers({ count: "", wage: "" });
    setImplModel("menu_price"); setTransitionYears(3);
    setEmail(""); setEmailSubmitted(false);
  };

  const handleDownloadPDF = () => {
    if (!results) return;
    exportPDF({ results, state, restaurantType, annualRevenue: parseFloat(annualRevenue.replace(/,/g, "")), menuPrice: parseFloat(menuPrice) });
  };

  const handleEmailSubmit = () => {
    if (!email || !email.includes("@")) return;
    localStorage.setItem("ofw_email_capture", email);
    setEmailSubmitted(true);
  };

  const heroExceedsLimit = results && results.requiredMenuIncreasePercent > 100;

  // ── Render ─────────────────────────────────────────────────────────────────
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
        {/* Hero text */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-[#3d1212] mb-4">Run the Numbers, Fairly</h1>
          <p className="text-base text-[#5a2a2a] leading-relaxed mb-3">
            To cover the wage increase in the Raise the Wage Act, restaurants may need to rethink how they price and operate. Use this calculator to understand your options and find a path that works for your business.
          </p>
          <p className="text-sm text-[#5a2a2a] leading-relaxed">
            Developed by UC Berkeley Engineering and MBA students Precious Inyang and Jenny Linger closely with the{" "}
            <a href="https://onefairwage.org/" target="_blank" rel="noopener noreferrer" className="underline text-[#b85c5c] hover:text-[#3d1212] transition-colors">OFW</a>{" "}
            team.
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
              options={STATES_LIST.map(s => ({ value: s.abbreviation, label: s.name }))}
              placeholder="Select state" fullWidth
              note={<>Wage data as of {WAGE_DATA_DATE}. Verify your state's current minimum wage at{" "}<a href="https://www.dol.gov/agencies/whd/minimum-wage/state" target="_blank" rel="noopener noreferrer" className="underline text-[#b85c5c] hover:text-[#3d1212] transition-colors">dol.gov</a>.</>}
            />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Restaurant Type" value={restaurantType} onChange={setRestaurantType}
                options={RESTAURANT_TYPES_LIST} placeholder="Select type" />
              <RevenueField label="Annual Revenue" value={annualRevenue} onChange={setAnnualRevenue} />
            </div>
            {annualRevenue && parseFloat(annualRevenue.replace(/,/g, "")) > 20_000_000 && (
              <p className="text-sm rounded-lg px-3 py-2 border" style={{ color: "#7a4a00", backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}>
                This revenue is unusually high for a single location — most full-service restaurants generate $500K–$5M annually.
              </p>
            )}
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full border-2 border-[#3d1212] flex items-center justify-center text-sm font-bold text-[#3d1212] shrink-0">2</div>
            <h2 className="text-xl font-bold text-[#3d1212]">Tell us about your team</h2>
          </div>
          <div className="flex flex-col gap-5">
            <div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 mb-1">
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
            <InputField
              label="Average ticket price"
              value={menuPrice} onChange={setMenuPrice} suffix="USD"
              tooltip="Your average ticket price is the average amount a single customer spends per visit. You can find this in your POS system (Toast: Sales Summary → Average Check, Square: Reports → Average Sale)."
            />
          </div>
        </section>

        {/* Calculate */}
        <button onClick={handleCalculate} disabled={!canCalculate}
          className="w-full py-4 rounded-full text-white font-semibold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 mb-6"
          style={{ backgroundColor: "#3d1212" }}>
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
            <p className="text-center text-sm text-[#7a4a4a]">Autofilled calculations based on your input</p>
            {staffingPreview && annualRevenue && (() => {
              const rev = parseFloat(annualRevenue.replace(/,/g, ""));
              return !isNaN(rev) && rev > 0 && rev / staffingPreview.totalStaff < 30_000;
            })() && (
              <p className="mt-2 text-sm rounded-lg px-3 py-2 border text-center" style={{ color: "#7a4a00", backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}>
                Your revenue seems low relative to your team size. Please double-check your annual revenue.
              </p>
            )}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {results && snapshotInputs && derived && profile && (
          <div className="space-y-5">

            {/* How does this calculator work? */}
            <div className="rounded-2xl overflow-hidden border border-[#e0c8c8] bg-white">
              <button onClick={() => setHowItWorksOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left">
                <span className="text-base font-semibold text-[#3d1212]">How does this calculator work?</span>
                <svg className={`shrink-0 transition-transform duration-200 ${howItWorksOpen ? "rotate-180" : ""}`}
                  width="16" height="16" viewBox="0 0 12 8" fill="none">
                  <path d="M1 1l5 5 5-5" stroke="#3d1212" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              {howItWorksOpen && (
                <div className="px-5 pb-5 pt-4 text-sm text-[#5a2a2a] leading-relaxed border-t border-[#e0c8c8]">
                  This calculator compares your current restaurant costs (including what your customers pay in tips) against a model where all workers earn a fair base wage and tipping is eliminated. The menu price increase shown is what's needed to cover the higher base wages, offset by savings from reduced employee turnover. Your customer's total cost (meal + tip today vs. higher menu price + no tip) is compared so you can see the real impact.
                </div>
              )}
            </div>

            {/* ── Hero result ────────────────────────────────────────────── */}
            <div className="rounded-2xl p-6" style={{ backgroundColor: "#3d1212" }}>
              <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
                <span className="text-white/70 text-base">To pay all workers</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-white font-bold text-3xl">${results.targetOFWWage}</span>
                  <span className="text-white/60 text-base">/hr</span>
                </div>
              </div>

              {heroExceedsLimit ? (
                <div className="rounded-xl p-4 text-sm leading-relaxed" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }}>
                  Based on your current revenue and staffing, the transition to ${results.targetOFWWage}/hr requires changes beyond menu pricing alone. Consider adjusting staffing levels, increasing revenue, or phasing in wage increases over time.
                </div>
              ) : (
                <>
                  {/* Primary: dollar-per-ticket framing */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold" style={{ fontSize: "28px" }}>
                        Your ${fmt(snapshotInputs.menuPriceNum)} ticket becomes ${fmt(derived.heroTicket)}
                      </span>
                      <InfoTooltip text="This calculator estimates the menu price increase needed to pay all workers a fair base wage while eliminating tipping. It accounts for your current labor costs, food costs, rent, and operating expenses based on your restaurant type." />
                    </div>
                    <p className="text-white/70 text-base leading-relaxed">
                      Your customer currently pays{" "}
                      <span className="font-semibold text-white">${fmt(derived.customerPaidBefore)}</span>{" "}
                      with tip. They'd pay{" "}
                      <span className="font-semibold text-white">${fmt(derived.heroTicket)}</span>{" "}
                      with no tip. That's{" "}
                      <span className={`font-semibold ${
                        derived.customerDelta <= 0 ? "text-green-300" :
                        derived.customerDelta <= 2 ? "text-white" : "text-amber-300"
                      }`}>
                        {fmtDollar(derived.customerDelta)}{" "}
                        {derived.customerDelta <= 0 ? "less" : "more"} per visit
                      </span>{" "}
                      — and every worker earns a living wage.
                    </p>
                  </div>
                  {/* Secondary: percentage */}
                  <p className="text-white/50 text-sm">
                    Menu price adjustment: {fmtPct(results.requiredMenuIncreasePercent)}
                  </p>
                </>
              )}
            </div>

            {/* ── Implementation model selector ─────────────────────────── */}
            {!heroExceedsLimit && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-semibold text-[#3d1212] mb-4">Choose your implementation path</h3>
                <div className="grid grid-cols-2 gap-3">
                  {availableModels.map(m => (
                    <button key={m.id} onClick={() => setImplModel(m.id)}
                      className={`text-left rounded-xl p-4 border-2 transition-all ${
                        implModel === m.id
                          ? "border-[#3d1212] bg-[#fce8e8]"
                          : "border-[#e0c8c8] bg-white hover:border-[#b85c5c]"
                      }`}>
                      <div className="text-sm font-semibold text-[#3d1212] mb-1">{m.title}</div>
                      <div className="text-sm text-[#5a2a2a] leading-snug">{m.description}</div>
                    </button>
                  ))}
                </div>

                {/* Model-specific result display */}
                <div className="mt-5 pt-5 border-t border-[#e0c8c8]">
                  {implModel === "menu_price" && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Menu price increase needed</span>
                        <span className="text-base font-semibold text-[#3d1212]">{fmtPct(results.requiredMenuIncreasePercent)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">New average ticket</span>
                        <span className="text-base font-semibold text-[#3d1212]">${fmt(derived.heroTicket)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Customer net change vs. today (with tip)</span>
                        <span className={`text-base font-semibold ${derived.customerDelta <= 0 ? "text-green-700" : derived.customerDelta <= 2 ? "text-[#5a2a2a]" : "text-amber-700"}`}>
                          {fmtDollar(derived.customerDelta)}
                        </span>
                      </div>
                    </div>
                  )}

                  {implModel === "service_charge" && (
                    <div className="space-y-2">
                      <p className="text-sm text-[#5a2a2a] mb-3 leading-relaxed">
                        Menu prices stay the same. A service charge funds the wage increase directly.
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Service charge needed</span>
                        <span className="text-base font-semibold text-[#3d1212]">{fmtPct(derived.serviceChargeRate * 100)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Menu price</span>
                        <span className="text-base font-semibold text-[#3d1212]">${fmt(snapshotInputs.menuPriceNum)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Customer total (meal + charge)</span>
                        <span className="text-base font-semibold text-[#3d1212]">${fmt(derived.scCustomerPays)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">vs. today (meal + tip)</span>
                        <span className={`text-base font-semibold ${derived.scDelta <= 0 ? "text-green-700" : derived.scDelta <= 2 ? "text-[#5a2a2a]" : "text-amber-700"}`}>
                          {fmtDollar(derived.scDelta)}
                        </span>
                      </div>
                      {derived.serviceChargeRate >= 0.20 && (
                        <p className="text-sm text-amber-700 mt-2">
                          Capped at 20% — a higher payroll gap may require a phased approach.
                        </p>
                      )}
                    </div>
                  )}

                  {implModel === "loyalty" && (
                    <div className="space-y-2">
                      <p className="text-sm text-[#5a2a2a] mb-3 leading-relaxed">
                        A monthly membership covers the wage increase through recurring customer revenue.
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Monthly payroll gap to cover</span>
                        <span className="text-base font-semibold text-amber-700">{fmtMoney(results.diagnostics.payrollGapMonthly)}/mo</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Estimated monthly customers</span>
                        <span className="text-base font-semibold text-[#3d1212]">~{Math.round(derived.memberCount / 0.15).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Members needed (15% of customers)</span>
                        <span className="text-base font-semibold text-[#3d1212]">{derived.memberCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#5a2a2a]">Suggested membership price</span>
                        <span className="text-base font-semibold text-[#3d1212]">${fmt(derived.membershipPrice)}/mo</span>
                      </div>
                    </div>
                  )}

                  {implModel === "phased_hybrid" && (
                    <p className="text-sm text-[#5a2a2a] leading-relaxed">
                      Use the timeline below to design your phased rollout — smaller increases each year, spread across your chosen timeframe.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Transition timeline slider ─────────────────────────────── */}
            {!heroExceedsLimit && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-semibold text-[#3d1212] mb-4">
                  {implModel === "phased_hybrid" ? "Phase in over how many years?" : "What if you phase this in gradually?"}
                </h3>
                <YearSlider value={transitionYears} onChange={setTransitionYears} baseYear={CURRENT_YEAR} />

                {/* Year-by-year table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e0c8c8]">
                        {["Year", "Menu adj.", "Worker wage", "Customer pays", "Monthly profit"].map(h => (
                          <th key={h} className="text-left pb-2 text-sm font-semibold text-[#3d1212] pr-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {derived.timeline.map((row, i) => (
                        <tr key={row.year} className={`border-b border-[#f0e4e4] ${i === 0 ? "bg-[#fce8e8]/40" : ""}`}>
                          <td className="py-2.5 pr-3 text-sm font-medium text-[#3d1212]">
                            {row.year}{i === 0 ? <span className="ml-1 text-xs text-[#7a4a4a]">(now)</span> : ""}
                          </td>
                          <td className="py-2.5 pr-3 text-sm text-[#5a2a2a]">
                            {i === 0 ? "—" : <span className="font-medium text-amber-700">+{fmtPct(row.menuAdjPct)}</span>}
                          </td>
                          <td className="py-2.5 pr-3 text-sm font-medium text-[#3d1212]">
                            ${fmt(row.wage, 2)}/hr
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="text-sm font-medium text-[#3d1212]">${fmt(row.ticket)}</div>
                            {i > 0 && (
                              <div className="text-sm text-[#7a4a4a]">
                                (${fmt(row.inflation)} w/ inflation)
                              </div>
                            )}
                          </td>
                          <td className={`py-2.5 text-sm font-semibold ${row.profit >= 0 ? "text-green-700" : "text-amber-700"}`}>
                            {fmtMoney(row.profit)}/mo
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="pt-3 text-sm text-[#7a4a4a] italic">
                          "Customer pays" with inflation uses 3%/yr compounding for comparison. Wage ramps linearly from current average to target.
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── Here's what changes (labor breakdown) ─────────────────── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-[#3d1212] mb-5">Here's what changes</h3>

              {/* Current labor */}
              <div className="mb-4">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm font-semibold text-[#3d1212]">Your labor costs today</span>
                  <span className="text-base font-bold text-[#3d1212]">{fmtMoney(results.diagnostics.currentMonthlyPayroll)}/mo</span>
                </div>
                {[
                  { label: "Waitstaff", count: snapshotInputs.wc, wage: snapshotInputs.ww, mo: derived.curWaitstaffMo, hours: profile.avgHoursPerWeekFOH },
                  { label: "Cooks", count: snapshotInputs.cc, wage: snapshotInputs.cw, mo: derived.curCooksMo, hours: profile.avgHoursPerWeekBOH },
                  { label: "Dishwashers", count: snapshotInputs.dc, wage: snapshotInputs.dw, mo: derived.curDishMo, hours: profile.avgHoursPerWeekBOH },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center py-1 pl-4">
                    <span className="text-sm text-[#5a2a2a]">
                      {r.label}: {r.count} × ${fmt(r.wage)}/hr (~{r.hours}hrs/wk)
                    </span>
                    <span className="text-sm text-[#5a2a2a]">{fmtMoney(r.mo)}/mo</span>
                  </div>
                ))}
                <div className="pl-4 mt-1">
                  <span className="text-sm text-[#7a4a4a] italic">+ payroll taxes, management & turnover costs</span>
                </div>
              </div>

              <div className="border-t border-[#e0c8c8] my-4" />

              {/* OFW labor */}
              <div className="mb-4">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm font-semibold text-[#3d1212]">Your labor costs at ${results.targetOFWWage}/hr</span>
                  <span className="text-base font-bold text-amber-700">{fmtMoney(results.diagnostics.ofwMonthlyPayroll)}/mo</span>
                </div>
                {[
                  { label: "Waitstaff", count: snapshotInputs.wc, mo: derived.ofwWaitstaffMo, hours: profile.avgHoursPerWeekFOH },
                  { label: "Cooks", count: snapshotInputs.cc, mo: derived.ofwCooksMo, hours: profile.avgHoursPerWeekBOH },
                  { label: "Dishwashers", count: snapshotInputs.dc, mo: derived.ofwDishMo, hours: profile.avgHoursPerWeekBOH },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center py-1 pl-4">
                    <span className="text-sm text-[#5a2a2a]">
                      {r.label}: {r.count} × ${fmt(results.targetOFWWage)}/hr (~{r.hours}hrs/wk)
                    </span>
                    <span className="text-sm text-amber-700">{fmtMoney(r.mo)}/mo</span>
                  </div>
                ))}
                <div className="pl-4 mt-1">
                  <span className="text-sm text-[#7a4a4a] italic">+ payroll taxes, management & turnover costs</span>
                </div>
              </div>

              <div className="border-t border-[#e0c8c8] my-4" />

              {/* The gap */}
              <div className="flex justify-between items-baseline mb-5">
                <span className="text-sm font-semibold text-[#3d1212]">The gap</span>
                <div className="text-right">
                  <span className="text-base font-bold text-amber-700">{fmtMoney(results.diagnostics.payrollGapMonthly)}/mo</span>
                  <span className="text-sm text-[#7a4a4a] ml-2">({fmtMoney(results.diagnostics.payrollGapMonthly * 12)}/yr)</span>
                </div>
              </div>

              {/* How it gets covered */}
              <div className="mb-5 rounded-xl p-4" style={{ backgroundColor: "#f5f0f0" }}>
                <p className="text-sm font-semibold text-[#3d1212] mb-3">How it gets covered</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#5a2a2a]">
                      {implModel === "service_charge" ? "Service charge revenue" :
                       implModel === "loyalty" ? "Membership revenue" :
                       "Additional margin from menu adjustment"}
                    </span>
                    <span className="text-sm font-semibold text-green-700">{fmtMoney(results.diagnostics.payrollGapMonthly)}/mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#5a2a2a]">Tips customers no longer pay separately</span>
                    <span className="text-sm font-semibold text-green-700">{fmtMoney(derived.tipsSavedMo)}/mo context</span>
                  </div>
                </div>
              </div>

              {/* Bottom line */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#3d1212] mb-2">Your bottom line</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#5a2a2a]">Current monthly profit</span>
                  <span className={`text-base font-semibold ${results.currentMonthlyProfit >= 0 ? "text-green-700" : "text-amber-700"}`}>
                    {fmtMoney(results.currentMonthlyProfit)}/mo
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#5a2a2a]">Projected monthly profit (at new pricing)</span>
                  <span className={`text-base font-semibold ${results.matchCurrent.monthlyProfit >= 0 ? "text-green-700" : "text-amber-700"}`}>
                    {fmtMoney(results.matchCurrent.monthlyProfit)}/mo
                  </span>
                </div>
              </div>
            </div>

            {/* ── Email capture ──────────────────────────────────────────── */}
            <div className="rounded-2xl p-6 border border-[#e0c8c8]" style={{ backgroundColor: "#fff8f8" }}>
              <h3 className="text-base font-semibold text-[#3d1212] mb-1">Get your full implementation plan</h3>
              <p className="text-sm text-[#5a2a2a] mb-4">We'll send you your custom results as a PDF, a year-by-year transition timeline, customer communication templates, and OFW resources.</p>

              {emailSubmitted ? (
                <div className="rounded-xl px-4 py-3 text-sm font-medium text-green-800" style={{ backgroundColor: "#dcfce7" }}>
                  Got it — check your inbox soon.
                </div>
              ) : (
                <div className="flex gap-3">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 border border-[#e0c8c8] rounded-lg py-2.5 px-3 text-sm bg-white text-[#3d1212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b85c5c] focus:border-transparent"
                  />
                  <button onClick={handleEmailSubmit}
                    disabled={!email || !email.includes("@")}
                    className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ backgroundColor: "#3d1212" }}>
                    Send my plan
                  </button>
                </div>
              )}
            </div>

            {/* ── Action buttons ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button onClick={handleDownloadPDF}
                className="flex items-center justify-center gap-2 py-4 rounded-full text-white font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: "#3d1212" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </button>
              <button onClick={handleRestart}
                className="py-4 rounded-full text-white font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: "#3d1212" }}>
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
