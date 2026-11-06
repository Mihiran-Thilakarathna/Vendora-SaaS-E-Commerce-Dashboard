import { formatCurrency } from "./formatCurrency";

/** Brand colours (RGB) used in the PDF. */
const INK = [15, 15, 15];
const LIME = [225, 251, 21];
const MUTED = [110, 110, 110];
const TILE = [244, 244, 245];

const LOGO_SRC = "/vendora-logo.png";
let logoCache = null;

/**
 * The logo file is a large PNG; draw it onto a small canvas first so the PDF stays light.
 * Returns { dataUrl, ratio } (ratio = width / height), or null if it can't be loaded.
 */
const loadLogo = async () => {
  if (logoCache) return logoCache;
  try {
    const img = new Image();
    img.src = LOGO_SRC;
    await img.decode();
    const height = 160;
    const width = Math.round((img.naturalWidth / img.naturalHeight) * height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    logoCache = { dataUrl: canvas.toDataURL("image/png"), ratio: width / height };
    return logoCache;
  } catch {
    return null;
  }
};

const text = (value) => (value === null || value === undefined ? "" : String(value));
const pct = (part, total) => (total ? Math.round((Number(part || 0) / total) * 1000) / 10 : 0);

/** "2026-11-06" -> "6 Nov 2026" (plain ASCII, safe for the built-in PDF fonts). */
const prettyDate = (key) => {
  const [y, m, d] = String(key || "").split("-").map(Number);
  if (!y || !m || !d) return text(key);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * Builds and downloads the Vendora performance report.
 *
 * @param {object} opts
 * @param {object} opts.data       analytics summary from GET /orders/analytics/summary
 * @param {string} opts.periodName range label, e.g. "Last 7 days", "This month", "Custom range"
 * @param {{startDate: string, endDate: string, label: string}} opts.range
 * @param {string} [opts.storeName]
 * @returns {Promise<string>} the downloaded file name
 */
export const downloadReportPdf = async ({ data, periodName, range, storeName = "" }) => {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadLogo(),
  ]);

  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const periodText = `${prettyDate(range.startDate)} to ${prettyDate(range.endDate)}`;
  const generatedText = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  // ---------- Brand header band ----------
  const bandHeight = 84;
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, bandHeight, "F");
  doc.setFillColor(...LIME);
  doc.rect(0, bandHeight, pageWidth, 3, "F");

  let brandX = marginX;
  if (logo) {
    const logoHeight = 46;
    const logoWidth = logoHeight * logo.ratio;
    doc.addImage(logo.dataUrl, "PNG", marginX, (bandHeight - logoHeight) / 2, logoWidth, logoHeight);
    brandX = marginX + logoWidth + 10;
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Vendora", brandX, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(170, 170, 170);
  doc.text("Store operations report", brandX, 59);

  const rightX = pageWidth - marginX;
  if (storeName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(text(storeName), rightX, 40, { align: "right" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...LIME);
  doc.text("PERFORMANCE REPORT", rightX, storeName ? 56 : 44, { align: "right" });

  // ---------- Title ----------
  let y = bandHeight + 40;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${periodName} performance report`, marginX, y);
  y += 17;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Period: ${periodText}  |  Generated: ${generatedText}`, marginX, y);
  y += 22;

  // ---------- Summary tiles ----------
  const tiles = [
    ["Revenue", formatCurrency(data.totalRevenue)],
    ["Orders", text(data.ordersCount)],
    ["Net profit", formatCurrency(data.grossProfit)],
    ["Average order", data.ordersCount > 0 ? formatCurrency(data.avgOrderValue) : "-"],
  ];
  const gap = 10;
  const tileWidth = (contentWidth - gap * (tiles.length - 1)) / tiles.length;
  const tileHeight = 54;
  tiles.forEach(([label, value], i) => {
    const x = marginX + i * (tileWidth + gap);
    doc.setFillColor(...TILE);
    doc.roundedRect(x, y, tileWidth, tileHeight, 6, 6, "F");
    doc.setFillColor(...LIME);
    doc.rect(x, y + 10, 3, tileHeight - 20, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 12, y + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text(value, x + 12, y + 39, { maxWidth: tileWidth - 18 });
  });
  y += tileHeight + 24;

  const tableBase = {
    styles: { fontSize: 9.5, cellPadding: 6, textColor: 30, lineColor: [228, 228, 231], lineWidth: 0.5 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: marginX, right: marginX, top: 48, bottom: 48 },
  };
  const ROW = 24.5; // approximate table row height at this font size
  /** Start a new page when a small table (or the start of a long one) won't fit. */
  const ensureSpace = (rowsToKeep) => {
    if (y + 28 + (rowsToKeep + 1) * ROW > pageHeight - 60) {
      doc.addPage();
      y = 56;
    }
  };
  const right = (content) => ({ content, styles: { halign: "right" } });
  const section = (title) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(title, marginX, y);
    return y + 8;
  };

  // ---------- Key metrics ----------
  autoTable(doc, {
    ...tableBase,
    startY: section("Key metrics"),
    head: [["Metric", right("Value")]],
    body: [
      ["Total revenue", formatCurrency(data.totalRevenue)],
      ["Prior period revenue", formatCurrency(data.previousWeekRevenue)],
      ["Growth vs prior period", data.weekOverWeekChangePercent === null ? "-" : `${data.weekOverWeekChangePercent}%`],
      ["Orders", text(data.ordersCount)],
      ["Average order", data.ordersCount > 0 ? formatCurrency(data.avgOrderValue) : "-"],
      ["Estimated cost", formatCurrency(data.totalCost)],
      ["Net profit", formatCurrency(data.grossProfit)],
      ["Gross margin", data.grossMarginPercent === null ? "-" : `${data.grossMarginPercent}%`],
      ["Low-stock products (under 10 units)", text(data.lowStockCount)],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });
  y = doc.lastAutoTable.finalY + 24;

  // ---------- Orders by status ----------
  if (data.statusBreakdown?.length) {
    ensureSpace(data.statusBreakdown.length);
    autoTable(doc, {
      ...tableBase,
      startY: section("Orders by status"),
      head: [["Status", right("Orders"), right("Share")]],
      body: data.statusBreakdown.map((s) => [text(s.name), text(s.count ?? 0), `${pct(s.count, data.ordersCount)}%`]),
      headStyles: { ...tableBase.headStyles, fillColor: LIME, textColor: INK },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 24;
  }

  // ---------- Top products ----------
  if (data.topSellingProducts?.length) {
    ensureSpace(data.topSellingProducts.length);
    autoTable(doc, {
      ...tableBase,
      startY: section("Top selling products"),
      head: [["Product", right("Units sold"), right("Revenue")]],
      body: data.topSellingProducts.map((p) => [text(p.name), text(p.quantitySold), formatCurrency(p.revenue || 0)]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 24;
  }

  // ---------- Daily order value ----------
  // Keep the heading with at least a few of its rows.
  ensureSpace(Math.min(5, (data.salesTrendData || []).length));
  autoTable(doc, {
    ...tableBase,
    startY: section("Order value by day"),
    head: [["Date", right("Order value")]],
    body: (data.salesTrendData || []).map((row) => [text(row.label), formatCurrency(row.sales || 0)]),
    columnStyles: { 1: { halign: "right" } },
  });

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageHeight - 32, pageWidth - marginX, pageHeight - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Vendora${storeName ? `  |  ${text(storeName)}` : ""}  |  Report for ${periodText}`, marginX, pageHeight - 18);
    doc.text(`Page ${i} of ${pages}`, pageWidth - marginX, pageHeight - 18, { align: "right" });
  }

  const filename =
    range.startDate === range.endDate
      ? `vendora-report-${range.endDate}.pdf`
      : `vendora-report-${range.startDate}-to-${range.endDate}.pdf`;
  doc.save(filename);
  return filename;
};
