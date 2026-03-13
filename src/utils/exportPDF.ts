import jsPDF from "jspdf";
import type { CalcResults } from "../calc/engine";

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(n: number) { return n.toFixed(1) + "%"; }
function fmtDelta(n: number) { return (n < 0 ? "-$" : "+$") + fmt(Math.abs(n)); }
function fmtProfit(n: number) { return (n < 0 ? "-$" : "$") + fmt(Math.abs(n), 0); }

interface ExportOptions {
  results: CalcResults;
  state: string;
  restaurantType: string;
  annualRevenue: number;
  menuPrice: number;
}

// Draw a cell with background fill, border, and centered text
function cell(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  text: string,
  opts: {
    fill?: [number, number, number];
    textColor?: [number, number, number];
    bold?: boolean;
    fontSize?: number;
    align?: "left" | "center" | "right";
  } = {}
) {
  const { fill, textColor = [40, 10, 10], bold = false, fontSize = 9, align = "center" } = opts;
  if (fill) {
    doc.setFillColor(...fill);
    doc.rect(x, y, w, h, "F");
  }
  // border
  doc.setDrawColor(210, 180, 180);
  doc.rect(x, y, w, h, "S");

  doc.setFontSize(fontSize);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setTextColor(...textColor);

  const padding = 4;
  const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - padding : x + padding;
  const ty = y + h / 2 + fontSize * 0.35;
  doc.text(text, tx, ty, { align });
}

export function exportPDF({ results, state, restaurantType, annualRevenue, menuPrice }: ExportOptions) {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const PW = doc.internal.pageSize.getWidth();   // 612
  const PH = doc.internal.pageSize.getHeight();  // 792
  const M = 36; // margin

  // ── Background ──────────────────────────────────────────────────
  doc.setFillColor(252, 232, 232);
  doc.rect(0, 0, PW, PH, "F");

  // ── Header bar ──────────────────────────────────────────────────
  doc.setFillColor(26, 10, 10);
  doc.rect(0, 0, PW, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ONE FAIR WAGE", M, 32);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Restaurant Wage Calculator — Results", PW - M, 32, { align: "right" });

  let y = 68;

  // ── Title ────────────────────────────────────────────────────────
  doc.setTextColor(61, 18, 18);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Menu Price Increase Analysis", M, y);
  y += 20;

  // ── Inputs summary ───────────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 40, 40);
  const summaryItems = [
    `State: ${state}`,
    `Type: ${restaurantType}`,
    `Annual Revenue: $${fmt(annualRevenue, 0)}`,
    `Menu Price: $${fmt(menuPrice)}`,
    `Staff: ${results.staffing.totalStaff} (FOH: ${results.staffing.fohCount} / BOH: ${results.staffing.bohCount} / Mgmt: ${results.staffing.managementCount})`,
    `Min Wage: $${results.minimumWage}  |  Tipped Min: $${results.tippedMinWage}  |  OFW Target: $${results.targetOFWWage}/hr`,
  ];
  summaryItems.forEach((line) => {
    doc.text(line, M, y);
    y += 13;
  });
  y += 6;

  // ── Hero result box ──────────────────────────────────────────────
  const heroH = 70;
  doc.setFillColor(61, 18, 18);
  doc.roundedRect(M, y, PW - M * 2, heroH, 6, 6, "F");

  // Left side
  doc.setTextColor(200, 160, 160);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("TO PAY ALL WORKERS", M + 14, y + 18);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(`$${results.targetOFWWage}/hr`, M + 14, y + 42);

  // Divider
  doc.setDrawColor(255, 255, 255, 0.2);
  doc.setLineWidth(0.5);
  doc.line(PW / 2, y + 10, PW / 2, y + heroH - 10);

  // Right side
  doc.setTextColor(200, 160, 160);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("REQUIRED MENU PRICE INCREASE", PW / 2 + 14, y + 18);
  doc.setTextColor(248, 113, 113);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(fmtPct(results.requiredMenuIncreasePercent), PW / 2 + 14, y + 46);

  y += heroH + 16;

  // ── Customer context sentence ────────────────────────────────────
  doc.setFillColor(240, 210, 210);
  doc.roundedRect(M, y, PW - M * 2, 32, 4, 4, "F");
  doc.setTextColor(61, 18, 18);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const ctxLine1 = `Your $${fmt(menuPrice)} plate → $${fmt(results.breakEven.newMenuPrice)} (no tip). Customer currently pays $${fmt(results.breakEven.customerPaidBefore)} with tip.`;
  const ctxLine2 = `They'd pay $${fmt(results.breakEven.customerPaysWithNewSystem)} without. That's ${fmtDelta(results.breakEven.customerDelta)} ${results.breakEven.customerDelta <= 0 ? "less" : "more"}.`;
  doc.text(ctxLine1, M + 10, y + 12);
  doc.text(ctxLine2, M + 10, y + 24);
  y += 46;

  // ── Scenario Comparison Table ────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(61, 18, 18);
  doc.text("Scenario Comparison", M, y);
  y += 14;

  const usableW = PW - M * 2;
  const col0W = 148; // row label column
  const colW = (usableW - col0W) / 3; // 3 scenario columns
  const ROW_H = 26;

  // Header row
  const headerCells: [string, [number,number,number]][] = [
    ["", [61, 18, 18]],
    ["Break-Even", [180, 30, 30]],
    ["Comfortable", [180, 100, 20]],
    ["Match Current", [20, 100, 60]],
  ];
  headerCells.forEach(([label, fill], i) => {
    const x = M + (i === 0 ? 0 : col0W + (i - 1) * colW);
    const w = i === 0 ? col0W : colW;
    cell(doc, x, y, w, ROW_H, label, { fill, textColor: [255, 255, 255], bold: true, fontSize: 9 });
  });
  y += ROW_H;

  // Data rows
  const EVEN_BG: [number,number,number] = [250, 225, 225];
  const ODD_BG: [number,number,number] = [245, 210, 210];

  const rows: { label: string; values: string[]; valueColors: [number,number,number][] }[] = [
    {
      label: "Menu Increase",
      values: [
        fmtPct(results.breakEven.menuIncreasePercent),
        fmtPct(results.comfortable.menuIncreasePercent),
        fmtPct(results.matchCurrent.menuIncreasePercent),
      ],
      valueColors: [[180,30,30],[180,100,20],[20,100,60]],
    },
    {
      label: "$20 Plate Becomes",
      values: [
        "$" + fmt(20 * (1 + results.breakEven.menuIncreasePercent / 100)),
        "$" + fmt(20 * (1 + results.comfortable.menuIncreasePercent / 100)),
        "$" + fmt(20 * (1 + results.matchCurrent.menuIncreasePercent / 100)),
      ],
      valueColors: [[61,18,18],[61,18,18],[61,18,18]],
    },
    {
      label: "Customer vs Today w/Tip",
      values: [
        fmtDelta(results.breakEven.customerDelta),
        fmtDelta(results.comfortable.customerDelta),
        fmtDelta(results.matchCurrent.customerDelta),
      ],
      valueColors: [
        results.breakEven.customerDelta <= 0 ? [21,128,61] : [185,28,28],
        results.comfortable.customerDelta <= 0 ? [21,128,61] : [185,28,28],
        results.matchCurrent.customerDelta <= 0 ? [21,128,61] : [185,28,28],
      ],
    },
    {
      label: "Monthly Profit",
      values: [
        fmtProfit(results.breakEven.monthlyProfit),
        fmtProfit(results.comfortable.monthlyProfit),
        fmtProfit(results.matchCurrent.monthlyProfit),
      ],
      valueColors: [
        results.breakEven.monthlyProfit >= 0 ? [21,128,61] : [185,28,28],
        results.comfortable.monthlyProfit >= 0 ? [21,128,61] : [185,28,28],
        results.matchCurrent.monthlyProfit >= 0 ? [21,128,61] : [185,28,28],
      ],
    },
  ];

  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? EVEN_BG : ODD_BG;
    // Label cell
    cell(doc, M, y, col0W, ROW_H, row.label, { fill: bg, textColor: [61,18,18], bold: false, fontSize: 8.5, align: "left" });
    // Value cells
    row.values.forEach((val, ci) => {
      cell(doc, M + col0W + ci * colW, y, colW, ROW_H, val, {
        fill: bg,
        textColor: row.valueColors[ci],
        bold: true,
        fontSize: 9,
      });
    });
    y += ROW_H;
  });

  y += 20;

  // ── Staffing breakdown table ─────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(61, 18, 18);
  doc.text("Staffing Breakdown", M, y);
  y += 14;

  const staffCols: [string, string][] = [
    ["Total Staff", String(results.staffing.totalStaff)],
    ["FOH", String(results.staffing.fohCount)],
    ["BOH", String(results.staffing.bohCount)],
    ["Management", String(results.staffing.managementCount)],
    ["Min Wage", "$" + results.minimumWage],
    ["Tipped Min", "$" + results.tippedMinWage],
    ["OFW Target", "$" + results.targetOFWWage + "/hr"],
  ];
  const staffColW = usableW / staffCols.length;
  staffCols.forEach(([label, val], i) => {
    cell(doc, M + i * staffColW, y, staffColW, 22, label, { fill: [61,18,18], textColor: [255,255,255], bold: true, fontSize: 8 });
    cell(doc, M + i * staffColW, y + 22, staffColW, 22, val, { fill: EVEN_BG, textColor: [61,18,18], bold: false, fontSize: 9 });
  });
  y += 44 + 20;

  // ── Footer ───────────────────────────────────────────────────────
  doc.setFillColor(61, 18, 18);
  doc.rect(0, PH - 36, PW, 36, "F");
  doc.setTextColor(200, 160, 160);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("©2026 One Fair Wage. All rights reserved.  |  onefairwage.org", PW / 2, PH - 14, { align: "center" });

  doc.save("OFW-wage-calculator-results.pdf");
}
