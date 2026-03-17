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

  // Current
  const curFOH  = fohRegHours * waitstaffWage   + fohOTHours  * waitstaffWage   * OT_MULTIPLIER;
  const curCook = cooksRegHours * cooksWage      + cooksOTHours * cooksWage      * OT_MULTIPLIER;
  const curDish = dishRegHours  * dishwashersWage + dishOTHours * dishwashersWage * OT_MULTIPLIER;
  const curBase = curFOH + curCook + curDish + mgmtAnnual;
  const current = curBase + (curFOH + curCook + curDish) * PAYROLL_TAX_RATE + turnoverCost;

  // At target (everyone gets targetWage, no tips)
  const tgtFOH  = fohRegHours  * targetWage + fohOTHours  * targetWage * OT_MULTIPLIER;
  const tgtCook = cooksRegHours * targetWage + cooksOTHours * targetWage * OT_MULTIPLIER;
  const tgtDish = dishRegHours  * targetWage + dishOTHours  * targetWage * OT_MULTIPLIER;
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

  const breakEvenRevenue = (currentOpex + labor.atTarget) / grossMarginRate;
  const breakEvenPct = Math.max(0, ((breakEvenRevenue - currentRevenue) / currentRevenue) * 100);

  const comfortableRevenue = (currentOpex + labor.atTarget) / (grossMarginRate - 0.05);
  const comfortablePct = Math.max(0, ((comfortableRevenue - currentRevenue) / currentRevenue) * 100);

  const matchRevenue = (currentOpex + labor.atTarget + currentAnnualProfit) / grossMarginRate;
  const matchPct = Math.max(0, ((matchRevenue - currentRevenue) / currentRevenue) * 100);

  const args = [inputs.menuPrice, profile.tipRatePercent, inputs.annualRevenue, profile, labor.atTarget] as const;

  return {
    toPayAllWorkersHourly: targetOFWWage,
    requiredMenuIncreasePercent: breakEvenPct,
    currentMonthlyProfit,
    breakEven:    buildScenario(breakEvenPct,  ...args),
    comfortable:  buildScenario(comfortablePct, ...args),
    matchCurrent: buildScenario(matchPct,       ...args),
    staffing,
    minimumWage,
    tippedMinWage,
    targetOFWWage,
  };
}
