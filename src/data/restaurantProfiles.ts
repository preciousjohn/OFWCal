export interface RestaurantProfile {
  label: string;
  // Cost structure
  cogsPercent: number;       // Cost of Goods Sold as % of revenue
  operatingExpensePercent: number; // Other opex as % of revenue (rent, utilities, etc.)
  // Tipping
  tipRatePercent: number;    // Average tip % on food bill
  // Staffing ratios (FOH : BOH, management separate)
  fohRatio: number;          // e.g. 0.5 means half of non-mgmt staff is FOH
  bohRatio: number;          // e.g. 0.5 means half of non-mgmt staff is BOH
  managementPerTenStaff: number; // 1 manager per N total staff
  // Hours
  avgHoursPerWeekFOH: number;
  avgHoursPerWeekBOH: number;
  avgHoursPerWeekMgmt: number;
  overtimeHoursPerWeekFOH: number; // OT hours per worker per week
  overtimeHoursPerWeekBOH: number;
  // Pay
  managementAnnualSalary: number;
  // Turnover & onboarding
  annualTurnoverRate: number;  // fraction, e.g. 0.75
  onboardingCostPerEmployee: number;
  // Tips
  tipPoolFOHShare: number;    // fraction of tip pool that goes to FOH
  tipPoolBOHShare: number;    // fraction that goes to BOH
  // Service
  serviceHoursPerMonth: number;
}

export type RestaurantType =
  | "fast_food"
  | "fast_casual"
  | "full_service_casual"
  | "full_service_upscale"
  | "cafe_bakery"
  | "bar_nightclub";

export const RESTAURANT_PROFILES: Record<RestaurantType, RestaurantProfile> = {
  fast_food: {
    label: "Fast Food / QSR",
    cogsPercent: 0.30,
    operatingExpensePercent: 0.25,
    tipRatePercent: 0.00,
    fohRatio: 0.6,
    bohRatio: 0.4,
    managementPerTenStaff: 1,
    avgHoursPerWeekFOH: 25,
    avgHoursPerWeekBOH: 30,
    avgHoursPerWeekMgmt: 45,
    overtimeHoursPerWeekFOH: 0,
    overtimeHoursPerWeekBOH: 0,
    managementAnnualSalary: 42000,
    annualTurnoverRate: 1.00,
    onboardingCostPerEmployee: 800,
    tipPoolFOHShare: 1.0,
    tipPoolBOHShare: 0.0,
    serviceHoursPerMonth: 480,
  },
  fast_casual: {
    label: "Fast Casual",
    cogsPercent: 0.29,
    operatingExpensePercent: 0.24,
    tipRatePercent: 0.08,
    fohRatio: 0.55,
    bohRatio: 0.45,
    managementPerTenStaff: 1,
    avgHoursPerWeekFOH: 28,
    avgHoursPerWeekBOH: 32,
    avgHoursPerWeekMgmt: 45,
    overtimeHoursPerWeekFOH: 0,
    overtimeHoursPerWeekBOH: 1,
    managementAnnualSalary: 48000,
    annualTurnoverRate: 0.80,
    onboardingCostPerEmployee: 900,
    tipPoolFOHShare: 1.0,
    tipPoolBOHShare: 0.0,
    serviceHoursPerMonth: 480,
  },
  full_service_casual: {
    label: "Full-Service Casual",
    cogsPercent: 0.30,
    operatingExpensePercent: 0.26,
    tipRatePercent: 0.18,
    fohRatio: 0.55,
    bohRatio: 0.45,
    managementPerTenStaff: 1,
    avgHoursPerWeekFOH: 30,
    avgHoursPerWeekBOH: 35,
    avgHoursPerWeekMgmt: 48,
    overtimeHoursPerWeekFOH: 1,
    overtimeHoursPerWeekBOH: 2,
    managementAnnualSalary: 55000,
    annualTurnoverRate: 0.75,
    onboardingCostPerEmployee: 1000,
    tipPoolFOHShare: 0.75,
    tipPoolBOHShare: 0.25,
    serviceHoursPerMonth: 520,
  },
  full_service_upscale: {
    label: "Full-Service Upscale",
    cogsPercent: 0.28,
    operatingExpensePercent: 0.28,
    tipRatePercent: 0.20,
    fohRatio: 0.6,
    bohRatio: 0.4,
    managementPerTenStaff: 1.5,
    avgHoursPerWeekFOH: 32,
    avgHoursPerWeekBOH: 40,
    avgHoursPerWeekMgmt: 50,
    overtimeHoursPerWeekFOH: 2,
    overtimeHoursPerWeekBOH: 3,
    managementAnnualSalary: 70000,
    annualTurnoverRate: 0.60,
    onboardingCostPerEmployee: 1500,
    tipPoolFOHShare: 0.75,
    tipPoolBOHShare: 0.25,
    serviceHoursPerMonth: 560,
  },
  cafe_bakery: {
    label: "Café / Bakery",
    cogsPercent: 0.33,
    operatingExpensePercent: 0.22,
    tipRatePercent: 0.12,
    fohRatio: 0.6,
    bohRatio: 0.4,
    managementPerTenStaff: 1,
    avgHoursPerWeekFOH: 28,
    avgHoursPerWeekBOH: 30,
    avgHoursPerWeekMgmt: 44,
    overtimeHoursPerWeekFOH: 0,
    overtimeHoursPerWeekBOH: 0,
    managementAnnualSalary: 46000,
    annualTurnoverRate: 0.70,
    onboardingCostPerEmployee: 800,
    tipPoolFOHShare: 1.0,
    tipPoolBOHShare: 0.0,
    serviceHoursPerMonth: 440,
  },
  bar_nightclub: {
    label: "Bar / Nightclub",
    cogsPercent: 0.25,
    operatingExpensePercent: 0.28,
    tipRatePercent: 0.18,
    fohRatio: 0.7,
    bohRatio: 0.3,
    managementPerTenStaff: 1,
    avgHoursPerWeekFOH: 25,
    avgHoursPerWeekBOH: 30,
    avgHoursPerWeekMgmt: 50,
    overtimeHoursPerWeekFOH: 2,
    overtimeHoursPerWeekBOH: 1,
    managementAnnualSalary: 52000,
    annualTurnoverRate: 0.90,
    onboardingCostPerEmployee: 700,
    tipPoolFOHShare: 0.85,
    tipPoolBOHShare: 0.15,
    serviceHoursPerMonth: 400,
  },
};

export const RESTAURANT_TYPES_LIST = Object.entries(RESTAURANT_PROFILES).map(
  ([key, val]) => ({ value: key as RestaurantType, label: val.label })
);
