/**
 * Parses the AI's rich-text markup into structured blocks that the PDF and
 * DOCX renderers typeset into a professional-looking document.
 *
 * Supported markup (see the system prompt's RICH TEXT MARKUP section):
 *   !> title            !>> subtitle        @> contact/meta line
 *   # ## ### headings    |> callout/sidebar  > quote
 *   --- divider          | table rows         - bullet / 1. numbered
 *   ``` code block       **bold** *italic* __underline__ ~~strike~~ `mono`
 *
 * This module is pure string logic with no DOM / Node APIs so it can be
 * imported by the browser-side generator and unit-tested directly.
 */

/* ------------------------------------------------------------------ */
/* Inline spans                                                        */
/* ------------------------------------------------------------------ */

export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  mono?: boolean;
};

/**
 * Turn a line of markup into styled spans. Markers toggle on/off, so
 * `**bold**`, `*italic*`, `__underline__`, ~~strike~~ and `code` all nest.
 */
export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let buf = "";
  let i = 0;
  const state = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    mono: false,
  };

  function flush() {
    if (buf) {
      spans.push({
        text: buf,
        ...(state.bold ? { bold: true } : {}),
        ...(state.italic ? { italic: true } : {}),
        ...(state.underline ? { underline: true } : {}),
        ...(state.strike ? { strike: true } : {}),
        ...(state.mono ? { mono: true } : {}),
      });
      buf = "";
    }
  }

  while (i < text.length) {
    // Two-character markers must be checked before the single-character ones.
    if (text.startsWith("**", i)) {
      flush();
      state.bold = !state.bold;
      i += 2;
      continue;
    }
    if (text.startsWith("__", i)) {
      flush();
      state.underline = !state.underline;
      i += 2;
      continue;
    }
    if (text.startsWith("~~", i)) {
      flush();
      state.strike = !state.strike;
      i += 2;
      continue;
    }
    if (text[i] === "`") {
      flush();
      state.mono = !state.mono;
      i += 1;
      continue;
    }
    if (text[i] === "*") {
      flush();
      state.italic = !state.italic;
      i += 1;
      continue;
    }
    buf += text[i];
    i++;
  }
  flush();
  return spans.length ? spans : [{ text }];
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

export type TableCell = InlineSpan[];

export type Block =
  | { kind: "title"; spans: InlineSpan[] }
  | { kind: "subtitle"; spans: InlineSpan[] }
  | { kind: "contact"; spans: InlineSpan[] }
  | { kind: "heading1"; spans: InlineSpan[] }
  | { kind: "heading2"; spans: InlineSpan[] }
  | { kind: "heading3"; spans: InlineSpan[] }
  | { kind: "callout"; lines: InlineSpan[][] }
  | { kind: "quote"; lines: InlineSpan[][] }
  | { kind: "divider" }
  | { kind: "table"; header: TableCell[]; rows: TableCell[][] }
  | { kind: "bullets"; items: { level: number; spans: InlineSpan[] }[] }
  | { kind: "numbered"; items: { level: number; spans: InlineSpan[] }[] }
  | { kind: "code"; lines: string[] }
  | { kind: "paragraph"; lines: InlineSpan[][] };

/** Does this trimmed line begin a new block type? */
function isSpecial(trimmed: string): boolean {
  return /^(#{1,3}\s|!>>\s|!>\s|@>\s|\|>\s|>\s|```|\||[-*+]\s|\d+[.)]\s|(-{3,}|\*{3,}|_{3,})$)/.test(
    trimmed,
  );
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function indentLevel(raw: string): number {
  const leading = raw.length - raw.trimStart().length;
  return Math.max(0, Math.floor(leading / 2));
}

/** Parse a markdown-style table (already reduced to `|...|` lines). */
function parseTable(tableLines: string[]): Block {
  const rows = tableLines.map(splitRow);
  const header = (rows[0] ?? []).map((c) => parseInline(c));
  const body = rows
    .slice(1)
    .filter((r) => !isSeparatorRow(r))
    .map((r) => r.map((c) => parseInline(c)));
  return { kind: "table", header, rows: body };
}

/** Parse a whole document body into blocks. */
export function parseRichDoc(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    if (!t) {
      i++;
      continue;
    }

    // Title / subtitle / contact -------------------------------------
    if (t.startsWith("!>> ")) {
      blocks.push({ kind: "subtitle", spans: parseInline(t.slice(4)) });
      i++;
      continue;
    }
    if (t.startsWith("!> ")) {
      blocks.push({ kind: "title", spans: parseInline(t.slice(3)) });
      i++;
      continue;
    }
    if (t.startsWith("@> ")) {
      blocks.push({ kind: "contact", spans: parseInline(t.slice(3)) });
      i++;
      continue;
    }

    // Callout (|>) ----------------------------------------------------
    if (t.startsWith("|>")) {
      const calloutLines: InlineSpan[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|>")) {
        calloutLines.push(parseInline(lines[i].trim().slice(2).trim()));
        i++;
      }
      blocks.push({ kind: "callout", lines: calloutLines });
      continue;
    }

    // Quote (>) -------------------------------------------------------
    if (t.startsWith(">")) {
      const quoteLines: InlineSpan[][] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(parseInline(lines[i].trim().replace(/^>\s?/, "")));
        i++;
      }
      blocks.push({ kind: "quote", lines: quoteLines });
      continue;
    }

    // Divider ---------------------------------------------------------
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      blocks.push({ kind: "divider" });
      i++;
      continue;
    }

    // Headings --------------------------------------------------------
    if (t.startsWith("### ")) {
      blocks.push({ kind: "heading3", spans: parseInline(t.slice(4)) });
      i++;
      continue;
    }
    if (t.startsWith("## ")) {
      blocks.push({ kind: "heading2", spans: parseInline(t.slice(3)) });
      i++;
      continue;
    }
    if (t.startsWith("# ")) {
      blocks.push({ kind: "heading1", spans: parseInline(t.slice(2)) });
      i++;
      continue;
    }

    // Code fence ------------------------------------------------------
    if (/^```/.test(t)) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip the closing fence
      blocks.push({ kind: "code", lines: codeLines });
      continue;
    }

    // Table -----------------------------------------------------------
    if (t.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      blocks.push(parseTable(tableLines));
      continue;
    }

    // Bullets ---------------------------------------------------------
    if (/^[-*+]\s/.test(t)) {
      const items: { level: number; spans: InlineSpan[] }[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i].trim())) {
        const line = lines[i];
        items.push({
          level: indentLevel(line),
          spans: parseInline(line.trim().replace(/^[-*+]\s+/, "")),
        });
        i++;
      }
      blocks.push({ kind: "bullets", items });
      continue;
    }

    // Numbered list ---------------------------------------------------
    if (/^\d+[.)]\s/.test(t)) {
      const items: { level: number; spans: InlineSpan[] }[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        const line = lines[i];
        items.push({
          level: indentLevel(line),
          spans: parseInline(line.trim().replace(/^\d+[.)]\s+/, "")),
        });
        i++;
      }
      blocks.push({ kind: "numbered", items });
      continue;
    }

    // Plain paragraph (group consecutive plain lines) ------------------
    const paraLines: InlineSpan[][] = [];
    while (i < lines.length) {
      const line = lines[i];
      const lt = line.trim();
      if (!lt || isSpecial(lt)) break;
      paraLines.push(parseInline(lt));
      i++;
    }
    if (paraLines.length) {
      blocks.push({ kind: "paragraph", lines: paraLines });
    } else {
      i++; // safety: never stall
    }
  }

  return blocks;
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

/** Shared professional color palette (RGB for jsPDF, hex for docx). */
export const DOC_THEME = {
  primary: [31, 78, 121] as [number, number, number], // #1F4E79 deep blue
  accent: [49, 133, 224] as [number, number, number], // #3185E0 app accent
  text: [28, 44, 64] as [number, number, number], // #1C2C40 near-black
  muted: [90, 107, 127] as [number, number, number], // #5A6B7F
  border: [200, 214, 230] as [number, number, number], // #C8D6E6
  calloutBg: [238, 244, 251] as [number, number, number], // #EEF4FB
  codeBg: [240, 243, 247] as [number, number, number], // #F0F3F7
  white: [255, 255, 255] as [number, number, number],
};

/** The same palette as hex strings (no #) for the docx renderer. */
export const DOC_HEX = {
  primary: "1F4E79",
  accent: "3185E0",
  text: "1C2C40",
  muted: "5A6B7F",
  border: "C8D6E6",
  calloutBg: "EEF4FB",
  codeBg: "F0F3F7",
  white: "FFFFFF",
};
