import type { RestaurantProfile } from "../data/restaurantProfiles";

export interface RoleInput {
  count: number;
  wage: number; // current hourly pay
}

export interface FormInputs {
  state: string;
  restaurantType: string;
  annualRevenue: number;
  menuPrice: number;
  waitstaff: RoleInput;   // FOH
  cooks: RoleInput;       // BOH
  dishwashers: RoleInput; // BOH
}

export interface DerivedStaffing {
  waitstaffCount: number;
  cooksCount: number;
  dishwashersCount: number;
  fohCount: number;        // = waitstaffCount
  bohCount: number;        // = cooks + dishwashers
  managementCount: number;
  totalStaff: number;
}

export interface ScenarioResult {
  menuIncreasePercent: number;
  newMenuPrice: number;
  customerPaysWithNewSystem: number;
  customerPaidBefore: number;
  customerDelta: number;
  monthlyProfit: number;
}

export interface CalcDiagnostics {
  currentMonthlyPayroll: number;
  ofwMonthlyPayroll: number;
  payrollGapMonthly: number;
  annualCOGS: number;
  annualOpex: number;
  currentMonthlyEBITDA: number;
  ofwMonthlyEBITDANoIncrease: number;
  grossMarginRate: number;
}

export interface CalcResults {
  toPayAllWorkersHourly: number;
  requiredMenuIncreasePercent: number;
  currentMonthlyProfit: number;
  breakEven: ScenarioResult;
  comfortable: ScenarioResult;
  matchCurrent: ScenarioResult;
  staffing: DerivedStaffing;
  minimumWage: number;
  tippedMinWage: number;
  targetOFWWage: number;
  diagnostics: CalcDiagnostics;
}

const PAYROLL_TAX_RATE = 0.0765;
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
const OT_MULTIPLIER = 1.5;

export function deriveStaffing(
  waitstaffCount: number,
  cooksCount: number,
  dishwashersCount: number,
  profile: RestaurantProfile
): DerivedStaffing {
  const nonMgmt = waitstaffCount + cooksCount + dishwashersCount;
  const managementCount = Math.max(1, Math.round((nonMgmt * profile.managementPerTenStaff) / 10));
  return {
    waitstaffCount,
    cooksCount,
    dishwashersCount,
    fohCount: waitstaffCount,
    bohCount: cooksCount + dishwashersCount,
    managementCount,
    totalStaff: nonMgmt + managementCount,
  };
}

function annualLaborCost(
  staffing: DerivedStaffing,
  profile: RestaurantProfile,
  waitstaffWage: number,
  cooksWage: number,
  dishwashersWage: number,
  targetWage: number
): { current: number; atTarget: number } {
  const fohRegHours = staffing.waitstaffCount * (profile.avgHoursPerWeekFOH - profile.overtimeHoursPerWeekFOH) * WEEKS_PER_YEAR;
  const fohOTHours  = staffing.waitstaffCount * profile.overtimeHoursPerWeekFOH * WEEKS_PER_YEAR;

  const cooksRegHours  = staffing.cooksCount * (profile.avgHoursPerWeekBOH - profile.overtimeHoursPerWeekBOH) * WEEKS_PER_YEAR;
  const cooksOTHours   = staffing.cooksCount * profile.overtimeHoursPerWeekBOH * WEEKS_PER_YEAR;

  const dishRegHours   = staffing.dishwashersCount * (profile.avgHoursPerWeekBOH - profile.overtimeHoursPerWeekBOH) * WEEKS_PER_YEAR;
  const dishOTHours    = staffing.dishwashersCount * profile.overtimeHoursPerWeekBOH * WEEKS_PER_YEAR;

  const mgmtAnnual = staffing.managementCount * profile.managementAnnualSalary;
  const turnoverCost = staffing.totalStaff * profile.annualTurnoverRate * profile.onboardingCostPerEmployee;

  // Current — use each role's user-entered wage
  const curFOH  = fohRegHours * waitstaffWage   + fohOTHours  * waitstaffWage   * OT_MULTIPLIER;
  const curCook = cooksRegHours * cooksWage      + cooksOTHours * cooksWage      * OT_MULTIPLIER;
  const curDish = dishRegHours  * dishwashersWage + dishOTHours * dishwashersWage * OT_MULTIPLIER;
  const curBase = curFOH + curCook + curDish + mgmtAnnual;
  const current = curBase + (curFOH + curCook + curDish) * PAYROLL_TAX_RATE + turnoverCost;

  // OFW model — every non-management worker earns the state target wage
  // Use Math.max so a worker already above target is not reduced
  const effectiveTarget = Math.max(targetWage, 0);
  const tgtFOH  = fohRegHours  * effectiveTarget + fohOTHours  * effectiveTarget * OT_MULTIPLIER;
  const tgtCook = cooksRegHours * effectiveTarget + cooksOTHours * effectiveTarget * OT_MULTIPLIER;
  const tgtDish = dishRegHours  * effectiveTarget + dishOTHours  * effectiveTarget * OT_MULTIPLIER;
  const tgtBase = tgtFOH + tgtCook + tgtDish + mgmtAnnual;
  const atTarget = tgtBase + (tgtFOH + tgtCook + tgtDish) * PAYROLL_TAX_RATE + turnoverCost;

  return { current, atTarget };
}

function buildScenario(
  menuIncreasePercent: number,
  menuPrice: number,
  tipRatePercent: number,
  annualRevenue: number,
  profile: RestaurantProfile,
  atTargetLaborCost: number
): ScenarioResult {
  const multiplier = 1 + menuIncreasePercent / 100;
  const newMenuPrice = menuPrice * multiplier;
  const newRevenue = annualRevenue * multiplier;
  const cogs = newRevenue * profile.cogsPercent;
  const opex = annualRevenue * profile.operatingExpensePercent;
  const monthlyProfit = (newRevenue - cogs - atTargetLaborCost - opex) / MONTHS_PER_YEAR;

  const customerPaidBefore = menuPrice * (1 + tipRatePercent);
  const customerPaysWithNewSystem = newMenuPrice;

  return {
    menuIncreasePercent,
    newMenuPrice,
    customerPaysWithNewSystem,
    customerPaidBefore,
    customerDelta: customerPaysWithNewSystem - customerPaidBefore,
    monthlyProfit,
  };
}

export function calculate(
  inputs: FormInputs,
  profile: RestaurantProfile,
  minimumWage: number,
  tippedMinWage: number,
  targetOFWWage: number
): CalcResults {
  const staffing = deriveStaffing(
    inputs.waitstaff.count,
    inputs.cooks.count,
    inputs.dishwashers.count,
    profile
  );

  const labor = annualLaborCost(
    staffing,
    profile,
    inputs.waitstaff.wage,
    inputs.cooks.wage,
    inputs.dishwashers.wage,
    targetOFWWage
  );

  const currentRevenue = inputs.annualRevenue;
  const currentCOGS = currentRevenue * profile.cogsPercent;
  const currentOpex = currentRevenue * profile.operatingExpensePercent;
  const currentMonthlyProfit = (currentRevenue - currentCOGS - labor.current - currentOpex) / MONTHS_PER_YEAR;
  const currentAnnualProfit = currentMonthlyProfit * MONTHS_PER_YEAR;

  const grossMarginRate = 1 - profile.cogsPercent;

  // ── Break-even: zero-profit floor in OFW model (can legitimately be 0%)
  const breakEvenRevenue = (currentOpex + labor.atTarget) / grossMarginRate;
  const breakEvenPct = Math.max(0, ((breakEvenRevenue - currentRevenue) / currentRevenue) * 100);

  // ── Comfortable: 5% net margin in OFW model
  const comfortableRevenue = (currentOpex + labor.atTarget) / (grossMarginRate - 0.05);
  const comfortablePct = Math.max(0, ((comfortableRevenue - currentRevenue) / currentRevenue) * 100);

  // ── Match Current: maintain today's profit
  const matchRevenue = (currentOpex + labor.atTarget + currentAnnualProfit) / grossMarginRate;
  const matchPct = Math.max(0, ((matchRevenue - currentRevenue) / currentRevenue) * 100);

  // ── Required hero number: the increase that covers the full payroll gap so
  //    customers — not the owner — bear the wage increase.
  //    Formula:  (OFW payroll − current payroll) / (revenue × gross margin rate)
  //    This is algebraically identical to matchPct, but stays correct even when
  //    matchPct would be rounded to 0 through floating-point noise.
  const payrollGap = Math.max(0, labor.atTarget - labor.current);
  const requiredMenuIncreasePercent =
    grossMarginRate > 0 && currentRevenue > 0
      ? (payrollGap / (grossMarginRate * currentRevenue)) * 100
      : 0;

  const args = [inputs.menuPrice, profile.tipRatePercent, inputs.annualRevenue, profile, labor.atTarget] as const;

  const ofwMonthlyEBITDANoIncrease =
    (currentRevenue - currentCOGS - labor.atTarget - currentOpex) / MONTHS_PER_YEAR;

  return {
    toPayAllWorkersHourly: targetOFWWage,
    requiredMenuIncreasePercent,
    currentMonthlyProfit,
    breakEven:    buildScenario(breakEvenPct,  ...args),
    comfortable:  buildScenario(comfortablePct, ...args),
    matchCurrent: buildScenario(matchPct,       ...args),
    staffing,
    minimumWage,
    tippedMinWage,
    targetOFWWage,
    diagnostics: {
      currentMonthlyPayroll: labor.current / MONTHS_PER_YEAR,
      ofwMonthlyPayroll:     labor.atTarget / MONTHS_PER_YEAR,
      payrollGapMonthly:     (labor.atTarget - labor.current) / MONTHS_PER_YEAR,
      annualCOGS:            currentCOGS,
      annualOpex:            currentOpex,
      currentMonthlyEBITDA:  currentMonthlyProfit,
      ofwMonthlyEBITDANoIncrease,
      grossMarginRate,
    },
  };
}
