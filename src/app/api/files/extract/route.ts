import { auth } from "@/../auth";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import * as XLSX from "xlsx";

const MAX_BASE64_CHARS = 7_000_000; // ≈5 MB of binary
const MAX_EXTRACTED_CHARS = 24_000;

function decodeXmlEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/g, "&");
}

/** DOCX: word/document.xml with paragraph tags turned into newlines. */
async function extractDocx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("Missing word/document.xml");
  const xml = await entry.async("string");
  return decodeXmlEntities(
    xml
      .replace(/<w:tab[^>]*\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

/** PPTX: every ppt/slides/slideN.xml in numeric order, paragraphs as lines. */
async function extractPptx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort(
      (a, b) =>
        Number(a.match(/slide(\d+)/)?.[1] ?? 0) -
        Number(b.match(/slide(\d+)/)?.[1] ?? 0),
    );
  const slides: string[] = [];
  for (const [index, name] of slideNames.entries()) {
    const xml = await zip.files[name].async("string");
    const text = decodeXmlEntities(
      xml
        .replace(/<a:br[^>]*\/>/g, "\n")
        .replace(/<\/a:p>/g, "\n")
        .replace(/<[^>]+>/g, ""),
    ).trim();
    slides.push(`--- Slide ${index + 1} ---\n${text}`);
  }
  return slides.join("\n\n");
}

/** XLSX/XLS: one CSV block per sheet. */
function extractXlsx(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames.map(
    (sheetName) =>
      `[Sheet: ${sheetName}]\n` +
      XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]),
  ).join("\n\n");
}

/**
 * pdf.js caches its fake-worker bootstrap promise on the PDFWorker class.
 * If an early request failed (before the worker global existed), that
 * REJECTED promise sticks and every later parse fails too. Re-prime the
 * cache with a resolved promise holding the real in-process handler
 * (identical to what pdf.js's own loader would return). `shadow()` defines
 * the property as configurable, so redefining it is safe.
 */
function primePdfWorkerBootstrapCache() {
  const globals = globalThis as Record<string, unknown>;
  const pdfjs = globals.pdfjs as typeof import("pdfjs-dist") | undefined;
  const workerClass = pdfjs?.PDFWorker as unknown as
    Record<string, unknown> | undefined;
  const handler = (
    globals.pdfjsWorker as { WorkerMessageHandler?: unknown } | undefined
  )?.WorkerMessageHandler;
  if (!workerClass || !handler) return;
  Object.defineProperty(workerClass, "_setupFakeWorkerGlobal", {
    value: Promise.resolve(handler),
    enumerable: true,
    configurable: true,
    writable: false,
  });
}

/** PDF: pdf-parse v2 API. */
async function extractPdf(buffer: Buffer) {
  // Expose pdf-parse's bundled pdf.js as globalThis.pdfjs (no workerSrc change).
  PDFParse.setWorker();
  // Register pdf.js's in-process ("fake") worker via its side-effect global.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  primePdfWorkerBootstrapCache();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ pageJoiner: "\n" });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Authentication required", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("name" in body) ||
    !("data" in body) ||
    typeof body.name !== "string" ||
    typeof body.data !== "string" ||
    !body.data
  ) {
    return new Response("A file name and base64 data are required.", {
      status: 400,
    });
  }
  const { name, data } = body as { name: string; data: string };
  if (data.length > MAX_BASE64_CHARS) {
    return new Response("That file is larger than 5 MB.", { status: 413 });
  }

  const ext = name.toLowerCase().split(".").pop() ?? "";
  const buffer = Buffer.from(data, "base64");

  let text: string;
  try {
    if (ext === "pdf") text = await extractPdf(buffer);
    else if (ext === "docx") text = await extractDocx(buffer);
    else if (ext === "pptx") text = await extractPptx(buffer);
    else if (ext === "xlsx" || ext === "xls") text = extractXlsx(buffer);
    else
      return new Response(`Files of type ".${ext}" cannot be read.`, {
        status: 415,
      });
  } catch (error) {
    console.error("Could not extract text from the uploaded file.", {
      name,
      error,
    });
    return new Response("That file could not be read.", { status: 422 });
  }

  if (!text.trim()) text = "(No readable text was found in this file.)";
  if (text.length > MAX_EXTRACTED_CHARS) {
    text = text.slice(0, MAX_EXTRACTED_CHARS) + "\n\n[... file truncated ...]";
  }
  return Response.json({ text });
}
