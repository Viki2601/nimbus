/**
 * Turns a `file=name.ext` fence body into a real downloadable Blob.
 *
 * Text formats (.md, .csv, .html, ...) download as-is. Binary formats are
 * built in the browser from the plain-text body the model wrote:
 *   .pdf/.docx  <- rich markup parsed by src/lib/rich-doc.ts (titles, styled
 *                  headings, tables, callouts, quotes, dividers, bold/italic/
 *                  underline, bullets, code blocks)
 *   .xlsx       <- CSV rows, sheets split by "=== sheet: Name ==="
 *   .pptx       <- slides split by "---", first line = title, rest = bullets
 *
 * Libraries are dynamically imported so they only load when a file is
 * actually downloaded.
 */

import {
  parseRichDoc,
  DOC_THEME,
  DOC_HEX,
  type InlineSpan,
  type Block,
} from "@/lib/rich-doc";

type TitleBlock = Extract<Block, { kind: "title" }>;
type SubtitleBlock = Extract<Block, { kind: "subtitle" }>;
type ContactBlock = Extract<Block, { kind: "contact" }>;

/** Pull a title plus the optional subtitle/contact that directly follow it. */
function readHeader(blocks: Block[], start: number) {
  let j = start + 1;
  let subtitle: SubtitleBlock | null = null;
  let contact: ContactBlock | null = null;
  const s = blocks[j];
  if (s && s.kind === "subtitle") {
    subtitle = s;
    j++;
  }
  const c = blocks[j];
  if (c && c.kind === "contact") {
    contact = c;
    j++;
  }
  return { title: blocks[start] as TitleBlock, subtitle, contact, next: j };
}

const TEXT_MIME: Record<string, string> = {
  md: "text/markdown;charset=utf-8",
  markdown: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  csv: "text/csv;charset=utf-8",
  tsv: "text/tab-separated-values;charset=utf-8",
  html: "text/html;charset=utf-8",
  htm: "text/html;charset=utf-8",
  css: "text/css;charset=utf-8",
  json: "application/json;charset=utf-8",
  xml: "application/xml;charset=utf-8",
  yaml: "text/yaml;charset=utf-8",
  yml: "text/yaml;charset=utf-8",
  js: "text/javascript;charset=utf-8",
  ts: "text/plain;charset=utf-8",
  py: "text/x-python;charset=utf-8",
  sql: "application/sql;charset=utf-8",
  svg: "image/svg+xml;charset=utf-8",
};

const BINARY_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const DOWNLOADABLE_EXTENSIONS = new Set([
  ...Object.keys(TEXT_MIME),
  "docx",
  "xlsx",
  "pptx",
]);

export function fileExtension(name: string) {
  return (name.split(".").pop() ?? "").toLowerCase();
}

/** Human label for the file-type badge. */
export function fileKindLabel(name: string) {
  const labels: Record<string, string> = {
    md: "Markdown",
    markdown: "Markdown",
    txt: "Text",
    csv: "CSV",
    tsv: "TSV",
    html: "HTML",
    htm: "HTML",
    css: "CSS",
    json: "JSON",
    xml: "XML",
    yaml: "YAML",
    yml: "YAML",
    js: "JavaScript",
    ts: "TypeScript",
    py: "Python",
    sql: "SQL",
    svg: "SVG image",
    pdf: "PDF document",
    docx: "Word document",
    xlsx: "Excel spreadsheet",
    pptx: "PowerPoint presentation",
  };
  return (
    labels[fileExtension(name)] ?? fileExtension(name).toUpperCase() + " file"
  );
}

/** Strip anything unsafe from the name the model produced. */
export function safeFileName(name: string) {
  const base = name.split(/[\\/]/).pop()?.trim() || "download";
  return base.replace(/[<>:"|?*\u0000-\u001f]/g, "_").slice(0, 120);
}

export async function generateFileBlob(
  name: string,
  content: string,
): Promise<Blob> {
  const ext = fileExtension(name);
  switch (ext) {
    case "pdf":
      return buildPdf(content);
    case "docx":
      return buildDocx(content);
    case "xlsx":
    case "xls":
      return buildXlsx(content);
    case "pptx":
      return buildPptx(content);
    default:
      return new Blob([content], {
        type: TEXT_MIME[ext] ?? "text/plain;charset=utf-8",
      });
  }
}

/* ------------------------------------------------------------------ PDF */

/** Instance type of a jsPDF document (the class's instance). */
type JsDoc = import("jspdf").jsPDF;

/** Style flags only (no text) — used for the per-word style on `Word`. */
type SpanStyle = Omit<InlineSpan, "text">;

/** A word (or whitespace run) tagged with the style it should render in. */
type Word = { text: string; style: SpanStyle };

/** Choose the jsPDF font family + style for a span. */
function applyStyle(doc: JsDoc, size: number, s: SpanStyle) {
  const family = s.mono ? "courier" : "helvetica";
  let style = "normal";
  if (s.bold && s.italic) style = "bolditalic";
  else if (s.bold) style = "bold";
  else if (s.italic) style = "italic";
  doc.setFont(family, style);
  doc.setFontSize(size);
}

/** Total width of a single unwrapped run of styled spans. */
function spansWidth(doc: JsDoc, spans: InlineSpan[], size: number) {
  let w = 0;
  for (const s of spans) {
    applyStyle(doc, size, s);
    w += doc.getTextWidth(s.text);
  }
  return w;
}

/** Split styled spans into wrapped lines of words that fit `maxWidth`. */
function layoutSpans(
  doc: JsDoc,
  spans: InlineSpan[],
  size: number,
  maxWidth: number,
): Word[][] {
  const words: Word[] = [];
  for (const s of spans) {
    const { text, ...style } = s;
    const parts = text.split(/(\s+)/);
    for (const p of parts) if (p !== "") words.push({ text: p, style });
  }
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let curW = 0;
  for (const w of words) {
    applyStyle(doc, size, w.style);
    const wW = doc.getTextWidth(w.text);
    if (curW + wW > maxWidth && cur.length > 0) {
      lines.push(cur);
      cur = [];
      curW = 0;
      if (!w.text.trim()) continue; // drop the space that triggered the wrap
    }
    cur.push(w);
    curW += wW;
  }
  if (cur.length) lines.push(cur);
  return lines.length ? lines : [[{ text: "", style: {} }]];
}

/** Draw one already-wrapped line of words, honouring underline / strike. */
function drawWords(
  doc: JsDoc,
  words: Word[],
  x: number,
  y: number,
  size: number,
  color: [number, number, number],
) {
  let cx = x;
  doc.setTextColor(color[0], color[1], color[2]);
  for (const w of words) {
    applyStyle(doc, size, w.style);
    const wW = doc.getTextWidth(w.text);
    doc.text(w.text, cx, y);
    if (w.style.underline || w.style.strike) {
      doc.setLineWidth(0.6);
      doc.setDrawColor(color[0], color[1], color[2]);
      if (w.style.underline) {
        const uy = y + size * 0.14;
        doc.line(cx, uy, cx + wW, uy);
      }
      if (w.style.strike) {
        const sy = y - size * 0.3;
        doc.line(cx, sy, cx + wW, sy);
      }
    }
    cx += wW;
  }
}

async function buildPdf(content: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const T = DOC_THEME;
  const BODY = 10.5;
  const LINE = 15;
  const GAP = 7;

  function newPage() {
    doc.addPage();
    y = margin;
  }
  function need(h: number) {
    if (y + h > pageHeight - margin) newPage();
  }

  /** Draw a (possibly wrapped) run of styled spans, advancing y. */
  function emit(
    spans: InlineSpan[],
    size: number,
    opts: {
      x?: number;
      width?: number;
      lineHeight?: number;
      color?: [number, number, number];
      after?: number;
    } = {},
  ) {
    const x = opts.x ?? margin;
    const width = opts.width ?? maxWidth;
    const lh = opts.lineHeight ?? size * 1.35;
    const color = opts.color ?? T.text;
    const lines = layoutSpans(doc, spans, size, width);
    for (const words of lines) {
      need(lh);
      drawWords(doc, words, x, y + size * 0.82, size, color);
      y += lh;
    }
    y += opts.after ?? 0;
  }

  const blocks = parseRichDoc(content);
  let idx = 0;

  while (idx < blocks.length) {
    const b = blocks[idx];

    switch (b.kind) {
      /* ---- Title banner (+ optional subtitle & contact) ---- */
      case "title": {
        const { title, subtitle, contact, next } = readHeader(blocks, idx);

        const titleSize = 24;
        const subSize = 12.5;
        const titleLines = layoutSpans(
          doc,
          title.spans,
          titleSize,
          maxWidth - 48,
        );
        const subLines = subtitle
          ? layoutSpans(doc, subtitle.spans, subSize, maxWidth - 48)
          : [];
        const bannerH =
          26 +
          titleLines.length * (titleSize * 1.2) +
          subLines.length * 17 +
          22;

        doc.setFillColor(T.primary[0], T.primary[1], T.primary[2]);
        doc.rect(0, y, pageWidth, bannerH, "F");
        // accent underline inside the banner
        doc.setFillColor(T.accent[0], T.accent[1], T.accent[2]);
        doc.rect(0, y + bannerH - 4, pageWidth, 4, "F");

        let by = y + 30;
        for (const words of titleLines) {
          drawWords(doc, words, margin, by, titleSize, T.white);
          by += titleSize * 1.2;
        }
        for (const words of subLines) {
          drawWords(doc, words, margin, by, subSize, [214, 228, 244]);
          by += 17;
        }
        y += bannerH + 12;

        if (contact) {
          emit(contact.spans, 9, {
            x: margin,
            width: maxWidth,
            color: T.muted,
            after: 6,
          });
        }
        idx = next;
        break;
      }

      /* ---- Contact without a title ---- */
      case "contact": {
        emit(b.spans, 9.5, { color: T.muted, after: 4 });
        idx++;
        break;
      }

      /* ---- Headings ---- */
      case "heading1": {
        need(46);
        y += 6;
        emit(b.spans, 15, { color: T.primary, after: 3 });
        doc.setFillColor(T.accent[0], T.accent[1], T.accent[2]);
        doc.rect(margin, y, maxWidth, 2.5, "F");
        y += 12;
        idx++;
        break;
      }
      case "heading2": {
        need(34);
        y += 4;
        emit(b.spans, 12.5, { color: T.primary, after: 2 });
        doc.setDrawColor(T.border[0], T.border[1], T.border[2]);
        doc.setLineWidth(0.8);
        doc.line(margin, y, margin + maxWidth, y);
        y += 8;
        idx++;
        break;
      }
      case "heading3": {
        need(24);
        y += 2;
        emit(b.spans, 11, { color: T.text, after: 1 });
        idx++;
        break;
      }

      /* ---- Callout / sidebar ---- */
      case "callout": {
        const pad = 10;
        const inner = maxWidth - pad - 12;
        const allLines: Word[][] = [];
        for (const line of b.lines) {
          for (const words of layoutSpans(doc, line, BODY, inner))
            allLines.push(words);
        }
        const boxH = allLines.length * LINE + pad * 2;
        need(boxH + 4);
        doc.setFillColor(T.calloutBg[0], T.calloutBg[1], T.calloutBg[2]);
        doc.rect(margin, y, maxWidth, boxH, "F");
        doc.setFillColor(T.accent[0], T.accent[1], T.accent[2]);
        doc.rect(margin, y, 3.5, boxH, "F");
        let cy = y + pad + BODY * 0.8;
        for (const words of allLines) {
          drawWords(doc, words, margin + pad + 8, cy, BODY, T.text);
          cy += LINE;
        }
        y += boxH + GAP + 2;
        idx++;
        break;
      }

      /* ---- Quote ---- */
      case "quote": {
        const indent = 18;
        const inner = maxWidth - indent - 8;
        const allLines: Word[][] = [];
        for (const line of b.lines) {
          for (const words of layoutSpans(doc, line, BODY, inner))
            allLines.push(
              words.map((w) => ({ ...w, style: { ...w.style, italic: true } })),
            );
        }
        const boxH = allLines.length * LINE + 6;
        need(boxH + 4);
        doc.setFillColor(T.primary[0], T.primary[1], T.primary[2]);
        doc.rect(margin, y, 2.5, boxH, "F");
        let cy = y + 3 + BODY * 0.8;
        for (const words of allLines) {
          drawWords(doc, words, margin + indent, cy, BODY, T.muted);
          cy += LINE;
        }
        y += boxH + GAP + 2;
        idx++;
        break;
      }

      /* ---- Divider ---- */
      case "divider": {
        need(16);
        y += 5;
        doc.setDrawColor(T.border[0], T.border[1], T.border[2]);
        doc.setLineWidth(0.8);
        doc.line(margin, y, margin + maxWidth, y);
        y += 11;
        idx++;
        break;
      }

      /* ---- Table ---- */
      case "table": {
        const table = b;
        const cols = Math.max(1, table.header.length);
        const colW = tableColWidths(doc, table, cols, maxWidth);
        const cellPad = 6;

        const drawHeader = () => {
          const headerLines = table.header.map((cell, c) =>
            layoutSpans(
              doc,
              cell.map((s) => ({ ...s, bold: true })),
              BODY,
              (colW[c] ?? maxWidth) - cellPad * 2,
            ),
          );
          const hH =
            Math.max(...headerLines.map((l) => l.length), 1) * LINE +
            cellPad * 2;
          need(hH);
          doc.setFillColor(T.primary[0], T.primary[1], T.primary[2]);
          doc.rect(margin, y, maxWidth, hH, "F");
          let cx = margin;
          for (let c = 0; c < table.header.length; c++) {
            let cy = y + cellPad + BODY * 0.8;
            for (const words of headerLines[c] ?? []) {
              drawWords(doc, words, cx + cellPad, cy, BODY, T.white);
              cy += LINE;
            }
            cx += colW[c] ?? 0;
          }
          y += hH;
        };

        drawHeader();
        table.rows.forEach((row, r) => {
          const cellLines = row.map((cell, c) =>
            layoutSpans(doc, cell, BODY, (colW[c] ?? maxWidth) - cellPad * 2),
          );
          const rH =
            Math.max(...cellLines.map((l) => l.length), 1) * LINE + cellPad * 2;
          if (y + rH > pageHeight - margin) {
            newPage();
            drawHeader();
          }
          if (r % 2 === 1) {
            doc.setFillColor(T.calloutBg[0], T.calloutBg[1], T.calloutBg[2]);
            doc.rect(margin, y, maxWidth, rH, "F");
          }
          let cx = margin;
          for (let c = 0; c < row.length; c++) {
            let cy = y + cellPad + BODY * 0.8;
            for (const words of cellLines[c] ?? []) {
              drawWords(doc, words, cx + cellPad, cy, BODY, T.text);
              cy += LINE;
            }
            cx += colW[c] ?? 0;
          }
          doc.setDrawColor(T.border[0], T.border[1], T.border[2]);
          doc.setLineWidth(0.6);
          doc.line(margin, y + rH, margin + maxWidth, y + rH);
          y += rH;
        });
        y += GAP + 2;
        idx++;
        break;
      }

      /* ---- Bullets ---- */
      case "bullets": {
        for (const item of b.items) {
          const indent = 12 + item.level * 16;
          const hang = 12;
          const lines = layoutSpans(
            doc,
            item.spans,
            BODY,
            maxWidth - indent - hang,
          );
          lines.forEach((words, li) => {
            need(LINE);
            if (li === 0) {
              doc.setTextColor(T.accent[0], T.accent[1], T.accent[2]);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(BODY);
              doc.text("\u2022", margin + indent, y + BODY * 0.8);
            }
            drawWords(
              doc,
              words,
              margin + indent + hang,
              y + BODY * 0.8,
              BODY,
              T.text,
            );
            y += LINE;
          });
          y += 1.5;
        }
        y += GAP - 1.5;
        idx++;
        break;
      }

      /* ---- Numbered list ---- */
      case "numbered": {
        b.items.forEach((item, n) => {
          const indent = 12 + item.level * 16;
          const hang = 16;
          const lines = layoutSpans(
            doc,
            item.spans,
            BODY,
            maxWidth - indent - hang,
          );
          lines.forEach((words, li) => {
            need(LINE);
            if (li === 0) {
              doc.setTextColor(T.accent[0], T.accent[1], T.accent[2]);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(BODY);
              doc.text(`${n + 1}.`, margin + indent, y + BODY * 0.8);
            }
            drawWords(
              doc,
              words,
              margin + indent + hang,
              y + BODY * 0.8,
              BODY,
              T.text,
            );
            y += LINE;
          });
          y += 1.5;
        });
        y += GAP - 1.5;
        idx++;
        break;
      }

      /* ---- Code block ---- */
      case "code": {
        const size = 9.5;
        const codeLines: string[] = [];
        for (const l of b.lines) {
          for (const piece of doc.splitTextToSize(
            l || " ",
            maxWidth - 20,
          ) as string[])
            codeLines.push(piece);
        }
        const boxH = codeLines.length * (size * 1.4) + 16;
        need(boxH);
        doc.setFillColor(T.codeBg[0], T.codeBg[1], T.codeBg[2]);
        doc.rect(margin, y, maxWidth, boxH, "F");
        doc.setDrawColor(T.border[0], T.border[1], T.border[2]);
        doc.setLineWidth(0.6);
        doc.rect(margin, y, maxWidth, boxH, "S");
        let cy = y + 12;
        doc.setFont("courier", "normal");
        doc.setFontSize(size);
        doc.setTextColor(T.text[0], T.text[1], T.text[2]);
        for (const l of codeLines) {
          doc.text(l, margin + 10, cy);
          cy += size * 1.4;
        }
        y += boxH + GAP;
        idx++;
        break;
      }

      /* ---- Subtitle (when it appears without a title above it) ---- */
      case "subtitle": {
        emit(b.spans, 12.5, { color: T.muted, after: 4 });
        idx++;
        break;
      }

      /* ---- Paragraph ---- */
      default: {
        for (const line of b.lines) emit(line, BODY, { after: 3 });
        y += GAP - 3;
        idx++;
        break;
      }
    }
  }

  return doc.output("blob");
}

/** Distribute table column widths by content, capped so nothing overflows. */
function tableColWidths(
  doc: JsDoc,
  table: Extract<Block, { kind: "table" }>,
  cols: number,
  maxWidth: number,
): number[] {
  const natural: number[] = [];
  for (let c = 0; c < cols; c++) {
    let w = 0;
    const headerCell = table.header[c];
    if (headerCell)
      w = Math.max(
        w,
        spansWidth(
          doc,
          headerCell.map((s) => ({ ...s, bold: true })),
          BODY_PT,
        ),
      );
    for (const row of table.rows) {
      const cell = row[c];
      if (cell) w = Math.max(w, spansWidth(doc, cell, BODY_PT));
    }
    natural.push(Math.max(w, 30));
  }
  const total = natural.reduce((a, b) => a + b, 0) || 1;
  const minCol = Math.min(56, (maxWidth / cols) * 0.6);
  let widths = natural.map((w) => (w / total) * maxWidth);
  // lift any column that fell below the minimum, then re-normalize
  widths = widths.map((w) => Math.max(w, minCol));
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum > maxWidth) widths = widths.map((w) => (w / sum) * maxWidth);
  return widths;
}

// Measurement size used when sizing table columns.
const BODY_PT = 10.5;

/* ----------------------------------------------------------------- DOCX */

async function buildDocx(content: string) {
  const {
    BorderStyle,
    Document,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const HEX = DOC_HEX;
  type RunBase = {
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
    strike?: boolean;
    font?: string;
    color?: string;
  };
  const runs = (spans: InlineSpan[], base: RunBase = {}) =>
    spans.map(
      (s) =>
        new TextRun({
          text: s.text,
          bold: s.bold || base.bold,
          italics: s.italic || base.italics,
          underline: s.underline || base.underline ? {} : undefined,
          strike: s.strike || base.strike,
          font: s.mono ? "Courier New" : base.font,
          color: base.color,
        }),
    );

  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: HEX.border },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: HEX.border },
    left: { style: BorderStyle.SINGLE, size: 4, color: HEX.border },
    right: { style: BorderStyle.SINGLE, size: 4, color: HEX.border },
  };

  const children: (
    InstanceType<typeof Paragraph> | InstanceType<typeof Table>
  )[] = [];
  const blocks = parseRichDoc(content);
  let idx = 0;

  while (idx < blocks.length) {
    const b = blocks[idx];
    switch (b.kind) {
      case "title": {
        const { title, subtitle, contact, next } = readHeader(blocks, idx);
        children.push(
          new Paragraph({
            alignment: "center",
            spacing: { before: 0, after: subtitle ? 20 : 60 },
            children: runs(title.spans, {
              bold: true,
              color: HEX.primary,
              font: "Calibri",
            }),
          }),
        );
        if (subtitle)
          children.push(
            new Paragraph({
              alignment: "center",
              spacing: { before: 0, after: 60 },
              children: runs(subtitle.spans, { color: HEX.muted }),
            }),
          );
        if (contact)
          children.push(
            new Paragraph({
              alignment: "center",
              spacing: { before: 0, after: 160 },
              children: runs(contact.spans, { color: HEX.muted }),
            }),
          );
        idx = next;
        break;
      }
      case "contact":
        children.push(
          new Paragraph({
            alignment: "center",
            spacing: { after: 80 },
            children: runs(b.spans, { color: HEX.muted }),
          }),
        );
        idx++;
        break;
      case "heading1":
        children.push(
          new Paragraph({
            spacing: { before: 240, after: 120 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: HEX.accent,
              },
            },
            children: runs(b.spans, { bold: true, color: HEX.primary }),
          }),
        );
        idx++;
        break;
      case "heading2":
        children.push(
          new Paragraph({
            spacing: { before: 200, after: 80 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 4, color: HEX.border },
            },
            children: runs(b.spans, { bold: true, color: HEX.primary }),
          }),
        );
        idx++;
        break;
      case "heading3":
        children.push(
          new Paragraph({
            spacing: { before: 160, after: 60 },
            children: runs(b.spans, { bold: true, color: HEX.text }),
          }),
        );
        idx++;
        break;
      case "callout": {
        const row = new TableRow({
          children: [
            new TableCell({
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: HEX.border },
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 4,
                  color: HEX.border,
                },
                right: {
                  style: BorderStyle.SINGLE,
                  size: 4,
                  color: HEX.border,
                },
                left: {
                  style: BorderStyle.SINGLE,
                  size: 24,
                  color: HEX.accent,
                },
              },
              shading: { fill: HEX.calloutBg },
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: b.lines.map(
                (line) =>
                  new Paragraph({
                    spacing: { after: 40 },
                    children: runs(line),
                  }),
              ),
            }),
          ],
        });
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [row],
          }),
          new Paragraph({ children: [], spacing: { after: 80 } }),
        );
        idx++;
        break;
      }
      case "quote":
        for (const line of b.lines)
          children.push(
            new Paragraph({
              indent: { left: 280 },
              spacing: { after: 40 },
              border: {
                left: {
                  style: BorderStyle.SINGLE,
                  size: 18,
                  color: HEX.primary,
                },
              },
              children: runs(line, { italics: true, color: HEX.muted }),
            }),
          );
        children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
        idx++;
        break;
      case "divider":
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 120 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: HEX.border },
            },
            children: [],
          }),
        );
        idx++;
        break;
      case "table": {
        const table = b;
        const cols = Math.max(1, table.header.length);
        const mkRow = (cells: InlineSpan[][], isHeader: boolean) =>
          new TableRow({
            tableHeader: isHeader,
            children: Array.from({ length: cols }, (_, c) => {
              const cell = cells[c] ?? [];
              return new TableCell({
                borders: cellBorders,
                shading: isHeader ? { fill: HEX.primary } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: runs(
                      cell,
                      isHeader ? { bold: true, color: HEX.white } : {},
                    ),
                  }),
                ],
              });
            }),
          });
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              mkRow(table.header, true),
              ...table.rows.map((r) => mkRow(r, false)),
            ],
          }),
          new Paragraph({ children: [], spacing: { after: 120 } }),
        );
        idx++;
        break;
      }
      case "bullets":
        for (const item of b.items)
          children.push(
            new Paragraph({
              bullet: { level: Math.min(item.level, 4) },
              spacing: { after: 40 },
              children: runs(item.spans),
            }),
          );
        idx++;
        break;
      case "numbered":
        b.items.forEach((item, n) =>
          children.push(
            new Paragraph({
              indent: { left: 280 + item.level * 240, hanging: 280 },
              spacing: { after: 40 },
              children: [
                new TextRun({ text: `${n + 1}. `, bold: true }),
                ...runs(item.spans),
              ],
            }),
          ),
        );
        idx++;
        break;
      case "code":
        for (const l of b.lines)
          children.push(
            new Paragraph({
              shading: { fill: HEX.codeBg },
              spacing: { after: 20 },
              children: [new TextRun({ text: l || " ", font: "Courier New" })],
            }),
          );
        children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
        idx++;
        break;
      case "subtitle":
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: runs(b.spans, { color: HEX.muted }),
          }),
        );
        idx++;
        break;
      default:
        for (const line of b.lines)
          children.push(
            new Paragraph({ spacing: { after: 80 }, children: runs(line) }),
          );
        idx++;
        break;
    }
  }

  const document = new Document({ sections: [{ children }] });
  return Packer.toBlob(document);
}

/* ----------------------------------------------------------------- XLSX */

const SHEET_MARKER = /^\s*===\s*sheet:\s*(.+?)\s*===\s*$/i;

async function buildXlsx(content: string) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  // Split on "=== sheet: Name ===" markers; a lone chunk becomes "Sheet1".
  const chunks: { name: string; csv: string }[] = [];
  let current: { name: string; csv: string } | null = null;
  for (const line of content.split("\n")) {
    const marker = line.match(SHEET_MARKER);
    if (marker) {
      current = { name: marker[1], csv: "" };
      chunks.push(current);
    } else if (current) {
      current.csv += line + "\n";
    } else {
      current = { name: "Sheet1", csv: "" };
      chunks.push(current);
      current.csv += line + "\n";
    }
  }

  for (const [index, chunk] of chunks.entries()) {
    const parsed = XLSX.read(chunk.csv, { type: "string" });
    const sheet = parsed.Sheets[parsed.SheetNames[0]];
    if (!sheet) continue;
    const safeName =
      chunk.name.replace(/[[\]:*?/\\]/g, "").slice(0, 31) ||
      `Sheet${index + 1}`;
    XLSX.utils.book_append_sheet(workbook, sheet, safeName);
  }
  if (workbook.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([[]]),
      "Sheet1",
    );
  }
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: BINARY_MIME.xlsx });
}

/* ----------------------------------------------------------------- PPTX */

async function buildPptx(content: string) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const sections = content
    .split(/^\s*---+\s*$/m)
    .map((section) => section.trim())
    .filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n").filter((line) => line.trim());
    const titleLine = lines.shift() ?? "Slide";
    const title = titleLine.replace(/^#{1,6}\s*/, "").trim() || "Slide";
    const bullets = lines
      .map((line) => line.replace(/^\s*[-*+]\s*/, "").trim())
      .filter(Boolean);

    const slide = pptx.addSlide();
    slide.addText(title, {
      x: 0.6,
      y: 0.5,
      w: 12.2,
      h: 1,
      fontSize: 30,
      bold: true,
      color: "1F2933",
    });
    if (bullets.length) {
      slide.addText(
        bullets.map((text) => ({
          text,
          options: { bullet: { characterCode: "2022" }, breakLine: true },
        })),
        { x: 0.85, y: 1.9, w: 11.6, h: 4.6, fontSize: 17, color: "40506B" },
      );
    }
  }
  if (sections.length === 0) {
    pptx.addSlide().addText("Empty presentation", { x: 0.6, y: 0.5 });
  }
  const out = await pptx.write({ outputType: "arraybuffer" });
  return new Blob([out as ArrayBuffer], { type: BINARY_MIME.pptx });
}
