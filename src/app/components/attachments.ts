export type Attachment = {
  id: string;
  name: string;
  lang: string;
  code: string;
};

/** Best-effort language sniffing. Returns null if it doesn't look like code. */
export function detectCode(text: string): { lang: string; ext: string } | null {
  const t = text.trim();
  if (/^[\[{]/.test(t)) {
    try {
      JSON.parse(t);
      return { lang: "json", ext: "json" };
    } catch {
      /* not JSON */
    }
  }
  if (/^\s*<\?php/m.test(t)) return { lang: "php", ext: "php" };
  if (/^\s*#include\s*[<"]/m.test(t)) return { lang: "cpp", ext: "cpp" };
  if (
    /^\s*(def \w+\(|class \w+(\(.*\))?:|from \w+ import |import \w+$)/m.test(t)
  )
    return { lang: "python", ext: "py" };
  if (
    /\b(SELECT[\s\S]+FROM|INSERT INTO|CREATE TABLE|UPDATE \w+ SET)\b/i.test(t)
  )
    return { lang: "sql", ext: "sql" };
  if (/<!DOCTYPE html|<html[\s>]/i.test(t))
    return { lang: "html", ext: "html" };
  if (
    /(import .+ from|export (default )?(function|const|class)|\bconst \w+\s*=|function \w+\(|=>|useState|require\()/.test(
      t,
    )
  ) {
    const jsx = /<\w+[^>]*\/?>/.test(t) && /(return\s*\(|\/>)/.test(t);
    const ts =
      /(:\s*(string|number|boolean)\b|\binterface \w+|\btype \w+\s*=)/.test(t);
    if (jsx)
      return ts ? { lang: "tsx", ext: "tsx" } : { lang: "jsx", ext: "jsx" };
    return ts ? { lang: "ts", ext: "ts" } : { lang: "js", ext: "js" };
  }
  if (/^[\s\S]*[.#]?[\w-]+\s*\{[^}]*:\s*[^}]+;[^}]*\}/.test(t))
    return { lang: "css", ext: "css" };
  if (/^\s*(\$ |npm |npx |git |cd |sudo |pip )/m.test(t))
    return { lang: "bash", ext: "sh" };

  // Generic fallback: lots of code punctuation + indentation
  const symbols = (t.match(/[{}();=<>\[\]]/g) ?? []).length;
  if (
    t.split("\n").length >= 4 &&
    symbols / t.length > 0.05 &&
    /^\s{2,}\S/m.test(t)
  ) {
    return { lang: "", ext: "txt" };
  }
  return null;
}

/** Decide whether a paste should become a file card. Returns null to paste normally. */
export function toAttachment(text: string, n: number): Attachment | null {
  const lineCount = text.split("\n").length;
  const code = detectCode(text);
  if (code && lineCount >= 4) {
    return {
      id: crypto.randomUUID(),
      name: `snippet-${n}.${code.ext}`,
      lang: code.lang,
      code: text,
    };
  }
  if (text.length > 1500 || lineCount > 25) {
    return {
      id: crypto.randomUUID(),
      name: `pasted-text-${n}.txt`,
      lang: "",
      code: text,
    };
  }
  return null;
}

/** Typed text + attachments -> one string (attachments become fenced blocks). */
export function composeMessage(text: string, attachments: Attachment[]) {
  const files = attachments.map((a) => {
    const longestRun = Math.max(
      0,
      ...(a.code.match(/`{3,}/g) ?? []).map((r) => r.length),
    );
    const fence = "`".repeat(Math.max(3, longestRun + 1));
    return `${fence}${a.lang} file=${a.name}\n${a.code.replace(/\n+$/, "")}\n${fence}`;
  });
  return [text.trim(), ...files].filter(Boolean).join("\n\n");
}

/* ---------------------------------------------------------------------------
   Uploaded files (paperclip / drag-and-drop).
   --------------------------------------------------------------------------- */

export const MAX_ATTACH_FILES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_CHARS = 15_000;

/** Formats the browser can read as text without a server round-trip. */
const TEXT_EXTENSIONS = new Set([
  "md",
  "markdown",
  "txt",
  "text",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "xml",
  "html",
  "htm",
  "css",
  "scss",
  "sass",
  "less",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "sh",
  "bash",
  "zsh",
  "bat",
  "ps1",
  "sql",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "log",
  "env",
  "svg",
  "vue",
  "svelte",
  "dart",
  "kt",
  "swift",
  "scala",
  "lua",
  "r",
  "pl",
  "ex",
  "exs",
]);

/** Binary formats whose text is extracted by POST /api/files/extract. */
const EXTRACT_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "xls", "pptx"]);

/** Extension -> highlight.js language (only ones registered in markdown.tsx). */
const LANG_BY_EXT: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "",
  php: "",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  bat: "bash",
  ps1: "bash",
  html: "xml",
  htm: "xml",
  svg: "xml",
  xml: "xml",
  json: "json",
  jsonl: "json",
  yaml: "yaml",
  yml: "yaml",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  sql: "sql",
  java: "java",
  c: "cpp",
  h: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  cs: "",
  go: "go",
  rs: "",
  kt: "",
  swift: "",
  scala: "",
  lua: "",
  r: "",
  dart: "",
  vue: "",
  svelte: "",
  pl: "",
  ex: "",
  exs: "",
  md: "",
  markdown: "",
  txt: "",
  text: "",
  log: "",
  ini: "",
  cfg: "",
  conf: "",
  env: "",
  toml: "",
  csv: "",
  tsv: "",
};

function fileExtension(name: string) {
  return (name.split(".").pop() ?? "").toLowerCase();
}

/** Read a picked/dropped file into an attachment (text directly, binaries via the extract route). */
export async function fileToAttachment(
  file: File,
): Promise<{ attachment?: Attachment; error?: string }> {
  if (file.size > MAX_FILE_BYTES) {
    return { error: `"${file.name}" is larger than 5 MB.` };
  }
  const ext = fileExtension(file.name);
  const isText =
    TEXT_EXTENSIONS.has(ext) || (!ext && file.type.startsWith("text/"));

  let code: string;
  if (isText) {
    code = await file.text();
  } else if (EXTRACT_EXTENSIONS.has(ext)) {
    const base64 = await fileToBase64(file);
    const response = await fetch("/api/files/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, data: base64 }),
    });
    if (!response.ok) {
      const message = await response.text();
      return { error: message || `"${file.name}" could not be read.` };
    }
    const result = (await response.json()) as { text: string };
    code = result.text;
  } else {
    return {
      error: `"${file.name}" is not a supported file type (try PDF, DOCX, XLSX, PPTX, MD, CSV, TXT, HTML, JSON...).`,
    };
  }

  if (!code.trim() && !isText) {
    return { error: `No readable text was found in "${file.name}".` };
  }
  if (code.length > MAX_ATTACHMENT_CHARS) {
    code = code.slice(0, MAX_ATTACHMENT_CHARS) + "\n\n[... file truncated ...]";
  }
  return {
    attachment: {
      id: crypto.randomUUID(),
      name: file.name,
      lang: LANG_BY_EXT[ext] ?? "",
      code,
    },
  };
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000; // avoids blowing the argument limit
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
