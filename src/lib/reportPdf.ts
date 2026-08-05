import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatINRFromPaise } from "./money";
import {
  BalanceTrendPoint,
  CategoryPiePoint,
  IncomeExpensePoint,
} from "./reports";

export interface ReportTransactionRow {
  date: string;
  type: "income" | "expense" | "transfer";
  note: string;
  category: string;
  fromWallet: string;
  toWallet: string;
  amountInPaise: number;
}

export interface ReportPdfSection {
  presetLabel: string;
  title: string;
  rangeLabel: string;
  totalIncomeInPaise: number;
  totalExpenseInPaise: number;
  netChangeInPaise: number;
  startingBalanceInPaise: number;
  series: IncomeExpensePoint[];
  balanceTrend: BalanceTrendPoint[];
  expensePie: CategoryPiePoint[];
  incomePie: CategoryPiePoint[];
  transactions: ReportTransactionRow[];
}

function addSection(doc: jsPDF, section: ReportPdfSection, isFirst: boolean) {
  if (!isFirst) doc.addPage();

  const margin = 14;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("LEDGER — Financial Report", margin, y);

  y += 10;
  doc.setFontSize(12);
  doc.text(`${section.title} (${section.presetLabel})`, margin, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(section.rangeLabel, margin, y);
  doc.text(`Generated ${format(new Date(), "dd MMM yyyy, HH:mm")}`, margin, y + 5);
  doc.setTextColor(0);

  y += 16;
  autoTable(doc, {
    startY: y,
    head: [["Summary", "Amount"]],
    body: [
      ["Total income", formatINRFromPaise(section.totalIncomeInPaise)],
      ["Total expense", formatINRFromPaise(section.totalExpenseInPaise)],
      [
        "Net change",
        `${section.netChangeInPaise >= 0 ? "+" : "−"}${formatINRFromPaise(Math.abs(section.netChangeInPaise))}`,
      ],
      ["Starting balance", formatINRFromPaise(section.startingBalanceInPaise)],
      [
        "Ending balance",
        formatINRFromPaise(
          section.balanceTrend[section.balanceTrend.length - 1]?.balanceInPaise ??
            section.startingBalanceInPaise
        ),
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [8, 12, 20], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y += 8;

  if (section.series.some((p) => p.incomeInPaise > 0 || p.expenseInPaise > 0)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Income vs expense", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y + 2,
      head: [["Period", "Income", "Expense"]],
      body: section.series.map((point) => [
        point.label,
        formatINRFromPaise(point.incomeInPaise),
        formatINRFromPaise(point.expenseInPaise),
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 212, 170], textColor: [8, 12, 20] },
      margin: { left: margin, right: margin },
    });

    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

  const addCategoryTable = (label: string, items: CategoryPiePoint[]) => {
    if (items.length === 0) return;

    if (y > 240) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, margin, y);
    y += 4;

    const total = items.reduce((sum, item) => sum + item.valueInPaise, 0);

    autoTable(doc, {
      startY: y + 2,
      head: [["Category", "Amount", "%"]],
      body: items.map((item) => {
        const pct = total > 0 ? Math.round((item.valueInPaise / total) * 100) : 0;
        return [item.label, formatINRFromPaise(item.valueInPaise), `${pct}%`];
      }),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [82, 82, 91], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  };

  addCategoryTable("Expenses by category", section.expensePie);
  addCategoryTable("Income by category", section.incomePie);

  if (section.transactions.length > 0) {
    if (y > 220) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Transactions", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y + 2,
      head: [["Date", "Type", "Description", "Category", "Wallet", "Amount"]],
      body: section.transactions.map((tx) => [
        tx.date,
        tx.type === "income" ? "Income" : tx.type === "expense" ? "Expense" : "Transfer",
        tx.note || "—",
        tx.category || "—",
        tx.type === "transfer" ? `${tx.fromWallet} → ${tx.toWallet}` : tx.fromWallet,
        formatINRFromPaise(tx.amountInPaise),
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [8, 12, 20], textColor: 255 },
      margin: { left: margin, right: margin },
    });
  }
}

export async function downloadReportPdf(sections: ReportPdfSection[], filename?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  sections.forEach((section, index) => {
    addSection(doc, section, index === 0);
  });

  const name =
    filename ??
    (sections.length === 1
      ? `ledger-report-${sections[0].presetLabel.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`
      : `ledger-report-all-periods-${format(new Date(), "yyyy-MM-dd")}.pdf`);

  const { saveBytesAsFile } = await import("./desktopFs");
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const saved = await saveBytesAsFile({
    defaultFilename: name,
    contents: bytes,
    mimeType: "application/pdf",
    filterName: "PDF",
    extensions: ["pdf"],
  });
  if (!saved) throw new Error("PDF export cancelled.");
}

export type BuildReportSectionInput = {
  presetLabel: string;
  title: string;
  rangeLabel: string;
  startingBalanceInPaise: number;
  series: IncomeExpensePoint[];
  balanceTrend: BalanceTrendPoint[];
  expensePie: CategoryPiePoint[];
  incomePie: CategoryPiePoint[];
  transactions: ReportTransactionRow[];
};

export function buildReportPdfSection(input: BuildReportSectionInput): ReportPdfSection {
  const totalIncomeInPaise = input.series.reduce((sum, p) => sum + p.incomeInPaise, 0);
  const totalExpenseInPaise = input.series.reduce((sum, p) => sum + p.expenseInPaise, 0);

  return {
    presetLabel: input.presetLabel,
    title: input.title,
    rangeLabel: input.rangeLabel,
    totalIncomeInPaise,
    totalExpenseInPaise,
    netChangeInPaise: totalIncomeInPaise - totalExpenseInPaise,
    startingBalanceInPaise: input.startingBalanceInPaise,
    series: input.series,
    balanceTrend: input.balanceTrend,
    expensePie: input.expensePie,
    incomePie: input.incomePie,
    transactions: input.transactions,
  };
}
