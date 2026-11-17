import "server-only";
import sharp from "sharp";

/**
 * Turn an uploaded file into something the AI can read:
 *  - images      → JPEG data URLs (tall boards are cut into overlapping slices so small print stays legible)
 *  - .xlsx       → one CSV block per sheet
 *  - .csv / .txt → text
 *  - .pdf        → text (scanned PDFs have no text layer — upload a screenshot instead)
 */

export type FileKind = "image" | "spreadsheet" | "csv" | "pdf" | "text";

export interface FileContent {
  name: string;
  kind: FileKind;
  size: number;
  meta: string;
  text?: string;
  images?: string[];
}

const MAX_TEXT = 60_000;

export function kindOf(file: File): FileKind | null {
  const n = file.name.toLowerCase();
  if (/^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/.test(n)) return "image";
  if (n.endsWith(".xlsx") || file.type.includes("spreadsheetml")) return "spreadsheet";
  if (n.endsWith(".csv") || file.type === "text/csv") return "csv";
  if (n.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (n.endsWith(".txt") || n.endsWith(".md") || file.type.startsWith("text/")) return "text";
  return null;
}

async function imageSlices(buf: Buffer): Promise<{ urls: string[]; meta: string }> {
  const img = sharp(buf, { failOn: "none" }).rotate();
  const { width = 0, height = 0 } = await img.metadata();
  if (!width || !height) throw new Error("Could not read the image.");
  const targetW = Math.min(width, 1600);
  const scaledH = Math.round((height * targetW) / width);
  const base = await img.resize({ width: targetW }).jpeg({ quality: 88 }).toBuffer();
  const sliceH = 1400, overlap = 140;
  const urls: string[] = [];
  if (scaledH <= sliceH * 1.3) {
    urls.push(`data:image/jpeg;base64,${base.toString("base64")}`);
  } else {
    for (let top = 0; top < scaledH; top += sliceH - overlap) {
      const h = Math.min(sliceH, scaledH - top);
      const part = await sharp(base).extract({ left: 0, top, width: targetW, height: h }).jpeg({ quality: 88 }).toBuffer();
      urls.push(`data:image/jpeg;base64,${part.toString("base64")}`);
      if (top + h >= scaledH || urls.length >= 6) break;
    }
  }
  return { urls, meta: `${width}×${height}px${urls.length > 1 ? ` · read in ${urls.length} slices` : ""}` };
}

async function spreadsheetText(buf: Buffer): Promise<{ text: string; meta: string }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const blocks: string[] = [];
  let rows = 0;
  wb.eachSheet((ws) => {
    const lines: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (lines.length >= 300) return;
      const cells: string[] = [];
      for (let c = 1; c <= Math.min(row.cellCount, 30); c++) {
        const t = row.getCell(c).text?.trim() ?? "";
        cells.push(/[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
      }
      if (cells.some(Boolean)) lines.push(cells.join(","));
    });
    rows += lines.length;
    if (lines.length) blocks.push(`### Sheet: ${ws.name}\n${lines.join("\n")}`);
  });
  return { text: blocks.join("\n\n").slice(0, MAX_TEXT), meta: `${wb.worksheets.length} sheet${wb.worksheets.length === 1 ? "" : "s"} · ${rows} rows` };
}

async function pdfText(buf: Buffer): Promise<{ text: string; meta: string }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const clean = text.replace(/[ \t]+/g, " ").trim();
  return { text: clean.slice(0, MAX_TEXT), meta: `${totalPages} page${totalPages === 1 ? "" : "s"}${clean.length < 40 ? " · no text layer (scanned?)" : ""}` };
}

export async function readFile(file: File): Promise<FileContent> {
  const kind = kindOf(file);
  if (!kind) throw new Error(`${file.name}: unsupported file type. Use an image, .xlsx, .csv, .pdf or .txt.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const base = { name: file.name, kind, size: file.size };
  if (kind === "image") {
    const { urls, meta } = await imageSlices(buf);
    return { ...base, images: urls, meta };
  }
  if (kind === "spreadsheet") return { ...base, ...(await spreadsheetText(buf)) };
  if (kind === "pdf") return { ...base, ...(await pdfText(buf)) };
  const text = buf.toString("utf8").slice(0, MAX_TEXT);
  return { ...base, text, meta: `${text.split(/\r?\n/).filter(Boolean).length} lines` };
}
