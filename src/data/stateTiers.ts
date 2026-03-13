export interface StateData {
  name: string;
  abbreviation: string;
  minimumWage: number;
  tippedMinWage: number;
  targetOFWWage: number;
  tier: 1 | 2 | 3 | 4;
}

// Tipped minimum wages — federal floor is $2.13; states vary
// Using approximate 2024/2025 rates
const STATE_DATA: Record<string, StateData> = {
  AL: { name: "Alabama", abbreviation: "AL", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  AK: { name: "Alaska", abbreviation: "AK", minimumWage: 11.73, tippedMinWage: 11.73, targetOFWWage: 25, tier: 2 },
  AZ: { name: "Arizona", abbreviation: "AZ", minimumWage: 14.35, tippedMinWage: 11.35, targetOFWWage: 25, tier: 2 },
  AR: { name: "Arkansas", abbreviation: "AR", minimumWage: 11.00, tippedMinWage: 2.63, targetOFWWage: 20, tier: 4 },
  CA: { name: "California", abbreviation: "CA", minimumWage: 16.00, tippedMinWage: 16.00, targetOFWWage: 30, tier: 1 },
  CO: { name: "Colorado", abbreviation: "CO", minimumWage: 14.42, tippedMinWage: 11.40, targetOFWWage: 25, tier: 2 },
  CT: { name: "Connecticut", abbreviation: "CT", minimumWage: 15.69, tippedMinWage: 8.23, targetOFWWage: 30, tier: 1 },
  DC: { name: "Washington D.C.", abbreviation: "DC", minimumWage: 17.50, tippedMinWage: 10.00, targetOFWWage: 30, tier: 1 },
  DE: { name: "Delaware", abbreviation: "DE", minimumWage: 13.25, tippedMinWage: 2.23, targetOFWWage: 25, tier: 2 },
  FL: { name: "Florida", abbreviation: "FL", minimumWage: 13.00, tippedMinWage: 9.98, targetOFWWage: 22, tier: 3 },
  GA: { name: "Georgia", abbreviation: "GA", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  HI: { name: "Hawaii", abbreviation: "HI", minimumWage: 14.00, tippedMinWage: 12.75, targetOFWWage: 30, tier: 1 },
  ID: { name: "Idaho", abbreviation: "ID", minimumWage: 7.25, tippedMinWage: 3.35, targetOFWWage: 20, tier: 4 },
  IL: { name: "Illinois", abbreviation: "IL", minimumWage: 14.00, tippedMinWage: 8.40, targetOFWWage: 25, tier: 2 },
  IN: { name: "Indiana", abbreviation: "IN", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  IA: { name: "Iowa", abbreviation: "IA", minimumWage: 7.25, tippedMinWage: 4.35, targetOFWWage: 22, tier: 3 },
  KS: { name: "Kansas", abbreviation: "KS", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  KY: { name: "Kentucky", abbreviation: "KY", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  LA: { name: "Louisiana", abbreviation: "LA", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  ME: { name: "Maine", abbreviation: "ME", minimumWage: 14.15, tippedMinWage: 7.08, targetOFWWage: 22, tier: 3 },
  MD: { name: "Maryland", abbreviation: "MD", minimumWage: 15.00, tippedMinWage: 3.63, targetOFWWage: 25, tier: 2 },
  MA: { name: "Massachusetts", abbreviation: "MA", minimumWage: 15.00, tippedMinWage: 7.95, targetOFWWage: 30, tier: 1 },
  MI: { name: "Michigan", abbreviation: "MI", minimumWage: 10.33, tippedMinWage: 3.84, targetOFWWage: 22, tier: 3 },
  MN: { name: "Minnesota", abbreviation: "MN", minimumWage: 10.85, tippedMinWage: 10.85, targetOFWWage: 25, tier: 2 },
  MS: { name: "Mississippi", abbreviation: "MS", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  MO: { name: "Missouri", abbreviation: "MO", minimumWage: 12.30, tippedMinWage: 6.15, targetOFWWage: 20, tier: 4 },
  MT: { name: "Montana", abbreviation: "MT", minimumWage: 10.30, tippedMinWage: 10.30, targetOFWWage: 20, tier: 4 },
  NE: { name: "Nebraska", abbreviation: "NE", minimumWage: 12.00, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  NV: { name: "Nevada", abbreviation: "NV", minimumWage: 12.00, tippedMinWage: 12.00, targetOFWWage: 22, tier: 3 },
  NH: { name: "New Hampshire", abbreviation: "NH", minimumWage: 7.25, tippedMinWage: 3.27, targetOFWWage: 25, tier: 2 },
  NJ: { name: "New Jersey", abbreviation: "NJ", minimumWage: 15.49, tippedMinWage: 5.26, targetOFWWage: 30, tier: 1 },
  NM: { name: "New Mexico", abbreviation: "NM", minimumWage: 12.00, tippedMinWage: 3.00, targetOFWWage: 22, tier: 3 },
  NY: { name: "New York", abbreviation: "NY", minimumWage: 16.00, tippedMinWage: 10.65, targetOFWWage: 30, tier: 1 },
  NC: { name: "North Carolina", abbreviation: "NC", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 22, tier: 3 },
  ND: { name: "North Dakota", abbreviation: "ND", minimumWage: 7.25, tippedMinWage: 4.86, targetOFWWage: 20, tier: 4 },
  OH: { name: "Ohio", abbreviation: "OH", minimumWage: 10.45, tippedMinWage: 5.25, targetOFWWage: 22, tier: 3 },
  OK: { name: "Oklahoma", abbreviation: "OK", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  OR: { name: "Oregon", abbreviation: "OR", minimumWage: 14.70, tippedMinWage: 14.70, targetOFWWage: 25, tier: 2 },
  PA: { name: "Pennsylvania", abbreviation: "PA", minimumWage: 7.25, tippedMinWage: 2.83, targetOFWWage: 22, tier: 3 },
  RI: { name: "Rhode Island", abbreviation: "RI", minimumWage: 14.00, tippedMinWage: 3.89, targetOFWWage: 25, tier: 2 },
  SC: { name: "South Carolina", abbreviation: "SC", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  SD: { name: "South Dakota", abbreviation: "SD", minimumWage: 11.20, tippedMinWage: 5.60, targetOFWWage: 20, tier: 4 },
  TN: { name: "Tennessee", abbreviation: "TN", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  TX: { name: "Texas", abbreviation: "TX", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
  UT: { name: "Utah", abbreviation: "UT", minimumWage: 7.25, tippedMinWage: 2.13, targetOFWWage: 22, tier: 3 },
  VT: { name: "Vermont", abbreviation: "VT", minimumWage: 13.67, tippedMinWage: 6.84, targetOFWWage: 25, tier: 2 },
  VA: { name: "Virginia", abbreviation: "VA", minimumWage: 12.00, tippedMinWage: 2.13, targetOFWWage: 22, tier: 3 },
  WA: { name: "Washington", abbreviation: "WA", minimumWage: 16.28, tippedMinWage: 16.28, targetOFWWage: 30, tier: 1 },
  WV: { name: "West Virginia", abbreviation: "WV", minimumWage: 8.75, tippedMinWage: 2.62, targetOFWWage: 20, tier: 4 },
  WI: { name: "Wisconsin", abbreviation: "WI", minimumWage: 7.25, tippedMinWage: 2.33, targetOFWWage: 22, tier: 3 },
  WY: { name: "Wyoming", abbreviation: "WY", minimumWage: 5.15, tippedMinWage: 2.13, targetOFWWage: 20, tier: 4 },
};

export const STATES_LIST = Object.values(STATE_DATA).sort((a, b) =>
  a.name.localeCompare(b.name)
);

export function getStateData(abbreviation: string): StateData | undefined {
  return STATE_DATA[abbreviation];
}
