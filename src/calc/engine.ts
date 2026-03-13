import type { RestaurantProfile } from "../data/restaurantProfiles";

export interface FormInputs {
  state: string;
  restaurantType: string;
  annualRevenue: number;
  totalStaff: number;
  menuPrice: number;             // avg menu item price
  kitchenStaffEarnings: number;  // current hourly wage for BOH
  tippedWorkerEarnings: number;  // current hourly wage for FOH (base, excl tips)
}

export interface DerivedStaffing {
  fohCount: number;
  bohCount: number;
  managementCount: number;
  totalStaff: number;
}

export interface AutoFilledValues {
  minimumWage: number;
  tippedMinWage: number;
  targetOFWWage: number;
  staffing: DerivedStaffing;
}

export interface ScenarioResult {
  menuIncreasePercent: number;
  newMenuPrice: number;
  customerPaysWithNewSystem: number;  // no tip at new price
  customerPaidBefore: number;         // old price + tip
  customerDelta: number;              // diff (positive = more, negative = less)
  monthlyProfit: number;
}

export interface CalcResults {
  toPayAllWorkersHourly: number;      // target OFW wage
  requiredMenuIncreasePercent: number; // break-even
  comfortableMenuIncreasePercent: number; // break-even + 5% margin
  matchCurrentMenuIncreasePercent: number; // matches current profit
  currentMonthlyProfit: number;
  breakEven: ScenarioResult;
  comfortable: ScenarioResult;
  matchCurrent: ScenarioResult;
  staffing: DerivedStaffing;
  minimumWage: number;
  tippedMinWage: number;
  targetOFWWage: number;
}

const PAYROLL_TAX_RATE = 0.0765; // FICA employer share
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
const OT_MULTIPLIER = 1.5;

export function deriveStaffing(
  totalStaff: number,
  profile: RestaurantProfile
): DerivedStaffing {
  const managementCount = Math.max(
    1,
    Math.round((totalStaff * profile.managementPerTenStaff) / 10)
  );
  const nonMgmt = totalStaff - managementCount;
  const fohCount = Math.max(1, Math.round(nonMgmt * profile.fohRatio));
  const bohCount = Math.max(1, nonMgmt - fohCount);
  return { fohCount, bohCount, managementCount, totalStaff };
}

function annualLaborCost(
  staffing: DerivedStaffing,
  profile: RestaurantProfile,
  fohWage: number,   // effective total wage per hour for FOH (base + estimated tip)
  bohWage: number,   // hourly wage BOH
  targetWage: number // target OFW hourly wage
): { current: number; atTarget: number } {
  // Current labor cost
  const fohRegHours =
    staffing.fohCount *
    (profile.avgHoursPerWeekFOH - profile.overtimeHoursPerWeekFOH) *
    WEEKS_PER_YEAR;
  const fohOTHours =
    staffing.fohCount * profile.overtimeHoursPerWeekFOH * WEEKS_PER_YEAR;

  const bohRegHours =
    staffing.bohCount *
    (profile.avgHoursPerWeekBOH - profile.overtimeHoursPerWeekBOH) *
    WEEKS_PER_YEAR;
  const bohOTHours =
    staffing.bohCount * profile.overtimeHoursPerWeekBOH * WEEKS_PER_YEAR;

  const mgmtAnnual = staffing.managementCount * profile.managementAnnualSalary;

  const currentFOHPay =
    fohRegHours * fohWage + fohOTHours * fohWage * OT_MULTIPLIER;
  const currentBOHPay =
    bohRegHours * bohWage + bohOTHours * bohWage * OT_MULTIPLIER;

  const currentBase = currentFOHPay + currentBOHPay + mgmtAnnual;
  const currentTaxes = (currentFOHPay + currentBOHPay) * PAYROLL_TAX_RATE;
  const turnoverCost =
    staffing.totalStaff * profile.annualTurnoverRate * profile.onboardingCostPerEmployee;

  const currentTotal = currentBase + currentTaxes + turnoverCost;

  // At-target labor cost (everyone gets target wage, no tips)
  const fohTargetPay =
    fohRegHours * targetWage + fohOTHours * targetWage * OT_MULTIPLIER;
  const bohTargetPay =
    bohRegHours * targetWage + bohOTHours * targetWage * OT_MULTIPLIER;

  const targetBase = fohTargetPay + bohTargetPay + mgmtAnnual;
  const targetTaxes = (fohTargetPay + bohTargetPay) * PAYROLL_TAX_RATE;
  const targetTotal = targetBase + targetTaxes + turnoverCost;

  return { current: currentTotal, atTarget: targetTotal };
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
  const opex = annualRevenue * profile.operatingExpensePercent; // opex doesn't scale with menu price
  const monthlyProfit = (newRevenue - cogs - atTargetLaborCost - opex) / MONTHS_PER_YEAR;

  // Customer comparison: old price + tip vs new price no tip
  const customerPaidBefore = menuPrice * (1 + tipRatePercent);
  const customerPaysWithNewSystem = newMenuPrice; // no tip in new model

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
  const staffing = deriveStaffing(inputs.totalStaff, profile);

  const fohCurrentWage = inputs.tippedWorkerEarnings;
  const bohCurrentWage = inputs.kitchenStaffEarnings;

  const labor = annualLaborCost(
    staffing,
    profile,
    fohCurrentWage,
    bohCurrentWage,
    targetOFWWage
  );

  // Current financials
  const currentRevenue = inputs.annualRevenue;
  const currentCOGS = currentRevenue * profile.cogsPercent;
  const currentOpex = currentRevenue * profile.operatingExpensePercent;
  const currentMonthlyProfit =
    (currentRevenue - currentCOGS - labor.current - currentOpex) / MONTHS_PER_YEAR;

  // Revenue needed to cover labor increase at break-even
  // newRevenue * (1 - COGS%) - opex - atTargetLabor = currentProfit * 12
  // newRevenue * grossMarginRate = currentAnnualProfit + opex + atTargetLabor
  const grossMarginRate = 1 - profile.cogsPercent;
  const currentAnnualProfit = currentMonthlyProfit * MONTHS_PER_YEAR;

  // Break-even: 0 profit (just cover costs)
  // newRevenue * grossMarginRate = opex + atTargetLabor
  const breakEvenRevenue =
    (currentOpex + labor.atTarget) / grossMarginRate;
  const breakEvenIncreasePercent = Math.max(
    0,
    ((breakEvenRevenue - currentRevenue) / currentRevenue) * 100
  );

  // Comfortable: 5% profit margin on new revenue
  // newRevenue * (grossMarginRate - 0.05) = opex + atTargetLabor
  const comfortableRevenue =
    (currentOpex + labor.atTarget) / (grossMarginRate - 0.05);
  const comfortableIncreasePercent = Math.max(
    0,
    ((comfortableRevenue - currentRevenue) / currentRevenue) * 100
  );

  // Match current: maintain same annual profit
  // newRevenue * grossMarginRate - opex - atTargetLabor = currentAnnualProfit
  const matchRevenue =
    (currentOpex + labor.atTarget + currentAnnualProfit) / grossMarginRate;
  const matchIncreasePercent = Math.max(
    0,
    ((matchRevenue - currentRevenue) / currentRevenue) * 100
  );

  return {
    toPayAllWorkersHourly: targetOFWWage,
    requiredMenuIncreasePercent: breakEvenIncreasePercent,
    comfortableMenuIncreasePercent: comfortableIncreasePercent,
    matchCurrentMenuIncreasePercent: matchIncreasePercent,
    currentMonthlyProfit,
    breakEven: buildScenario(
      breakEvenIncreasePercent,
      inputs.menuPrice,
      profile.tipRatePercent,
      inputs.annualRevenue,
      profile,
      labor.atTarget
    ),
    comfortable: buildScenario(
      comfortableIncreasePercent,
      inputs.menuPrice,
      profile.tipRatePercent,
      inputs.annualRevenue,
      profile,
      labor.atTarget
    ),
    matchCurrent: buildScenario(
      matchIncreasePercent,
      inputs.menuPrice,
      profile.tipRatePercent,
      inputs.annualRevenue,
      profile,
      labor.atTarget
    ),
    staffing,
    minimumWage,
    tippedMinWage,
    targetOFWWage,
  };
}
