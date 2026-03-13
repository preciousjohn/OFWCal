import jsPDF from "jspdf";
import type { CalcResults } from "../calc/engine";

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(n: number) {
  return n.toFixed(1) + "%";
}

function fmtDollar(n: number) {
  const sign = n < 0 ? "-" : "+";
  return sign + "$" + fmt(Math.abs(n));
}

interface ExportOptions {
  results: CalcResults;
  state: string;
  restaurantType: string;
  annualRevenue: number;
  menuPrice: number;
}

export function exportPDF({ results, state, restaurantType, annualRevenue, menuPrice }: ExportOptions) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 48;

  // Background
  doc.setFillColor(252, 232, 232);
  doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), "F");

  // Header bar
  doc.setFillColor(26, 10, 10);
  doc.rect(0, 0, W, 56, "F");

  // Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("OFW", margin, 36);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Let's Price This Out — Results", W / 2, 36, { align: "center" });

  let y = 88;

  // Title
  doc.setTextColor(61, 18, 18);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Your Restaurant Wage Calculator Results", margin, y);
  y += 28;

  // Meta info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 42, 42);
  doc.text(`State: ${state}   |   Type: ${restaurantType}   |   Annual Revenue: $${fmt(annualRevenue, 0)}   |   Menu Price: $${fmt(menuPrice)}`, margin, y);
  y += 32;

  // Hero box
  doc.setFillColor(61, 18, 18);
  doc.roundedRect(margin, y, W - margin * 2, 110, 10, 10, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("To pay all workers", margin + 16, y + 28);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`$${results.toPayAllWorkersHourly}/hr`, W - margin - 16, y + 28, { align: "right" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("You need to increase menu prices by", margin + 16, y + 58);
  doc.setTextColor(248, 113, 113);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(fmtPct(results.requiredMenuIncreasePercent), W - margin - 16, y + 62, { align: "right" });

  doc.setTextColor(200, 180, 180);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const customerText = `$${fmt(menuPrice)} plate → $${fmt(results.breakEven.newMenuPrice)} (no tip). Customer currently pays $${fmt(results.breakEven.customerPaidBefore)} w/tip. Delta: ${fmtDollar(results.breakEven.customerDelta)}`;
  doc.text(customerText, margin + 16, y + 94);

  y += 130;

  // Staffing info
  doc.setTextColor(61, 18, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Staffing Breakdown:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Total: ${results.staffing.totalStaff}  |  FOH: ${results.staffing.fohCount}  |  BOH: ${results.staffing.bohCount}  |  Management: ${results.staffing.managementCount}  |  Min Wage: $${results.minimumWage}  |  Tipped Min: $${results.tippedMinWage}  |  Target: $${results.targetOFWWage}/hr`,
    margin + 110, y
  );
  y += 28;

  // Scenarios table
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(61, 18, 18);
  doc.text("Scenario Comparison", margin, y);
  y += 16;

  const cols = [margin, margin + 180, margin + 290, margin + 400];
  const headers = ["", "Break-Even", "Comfortable", "Match Current"];
  const rowHeight = 28;
  const tableData = [
    ["Menu increase", fmtPct(results.breakEven.menuIncreasePercent), fmtPct(results.comfortable.menuIncreasePercent), fmtPct(results.matchCurrent.menuIncreasePercent)],
    ["$20 plate becomes", "$" + fmt(20 * (1 + results.breakEven.menuIncreasePercent / 100)), "$" + fmt(20 * (1 + results.comfortable.menuIncreasePercent / 100)), "$" + fmt(20 * (1 + results.matchCurrent.menuIncreasePercent / 100))],
    ["Customer vs today w/tip", fmtDollar(results.breakEven.customerDelta), fmtDollar(results.comfortable.customerDelta), fmtDollar(results.matchCurrent.customerDelta)],
    ["Monthly profit",
      (results.breakEven.monthlyProfit >= 0 ? "$" : "-$") + fmt(Math.abs(results.breakEven.monthlyProfit), 0),
      (results.comfortable.monthlyProfit >= 0 ? "$" : "-$") + fmt(Math.abs(results.comfortable.monthlyProfit), 0),
      (results.matchCurrent.monthlyProfit >= 0 ? "$" : "-$") + fmt(Math.abs(results.matchCurrent.monthlyProfit), 0),
    ],
  ];

  // Header row
  doc.setFillColor(61, 18, 18);
  doc.rect(margin, y, W - margin * 2, rowHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => doc.text(h, cols[i] + 8, y + rowHeight / 2 + 4));
  y += rowHeight;

  // Data rows
  tableData.forEach((row, ri) => {
    doc.setFillColor(ri % 2 === 0 ? 245 : 252, ri % 2 === 0 ? 230 : 240, ri % 2 === 0 ? 230 : 240);
    doc.rect(margin, y, W - margin * 2, rowHeight, "F");
    doc.setTextColor(61, 18, 18);
    doc.setFont("helvetica", ri === 0 ? "bold" : "normal");
    row.forEach((cell, i) => {
      if (i > 0) {
        // Color-code values
        if (row[0] === "Customer vs today w/tip") {
          const delta = [results.breakEven.customerDelta, results.comfortable.customerDelta, results.matchCurrent.customerDelta][i - 1];
          doc.setTextColor(delta <= 0 ? 21 : 185, delta <= 0 ? 128 : 28, delta <= 0 ? 61 : 28);
        } else if (row[0] === "Monthly profit") {
          const p = [results.breakEven.monthlyProfit, results.comfortable.monthlyProfit, results.matchCurrent.monthlyProfit][i - 1];
          doc.setTextColor(p >= 0 ? 21 : 185, p >= 0 ? 128 : 28, p >= 0 ? 61 : 28);
        } else {
          doc.setTextColor(61, 18, 18);
        }
      }
      doc.text(cell, cols[i] + 8, y + rowHeight / 2 + 4);
    });
    y += rowHeight;
  });

  // Footer
  y = doc.internal.pageSize.getHeight() - 32;
  doc.setFontSize(8);
  doc.setTextColor(122, 74, 74);
  doc.setFont("helvetica", "normal");
  doc.text("©2026 One Fair Wage. All rights reserved. | Generated by the OFW Wage Calculator", W / 2, y, { align: "center" });

  doc.save("OFW-wage-calculator-results.pdf");
}
