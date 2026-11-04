"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import hljs from "highlight.js/lib/core";
import { normalizeFileBlocks } from "@/lib/file-blocks";
import { DownloadableFile } from "./downloadable-file";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import diff from "highlight.js/lib/languages/diff";
import yaml from "highlight.js/lib/languages/yaml";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import go from "highlight.js/lib/languages/go";

Object.entries({ javascript, typescript, xml, css, json, python, bash, sql, diff, yaml, java, cpp, go, }).forEach(([name, grammar]) => hljs.registerLanguage(name, grammar));

/* Shared Tailwind class strings for markdown body typography (kept identical to the
   original plain-CSS values so the rendered output looks exactly the same). */
const MD_P = "mb-3";
const MD_HEADING_BASE = "mt-[18px] mb-2 font-bold leading-[1.35]";
const MD_LIST_BASE = "pl-[22px] list-outside";
const MD_LIST_TOP = `${MD_LIST_BASE} mt-2 mb-[14px]`;
const MD_LIST_NESTED = `${MD_LIST_BASE} my-[5px]`;
const MD_LI = "my-1 pl-[3px]";
const MD_TASK_LI = "my-1 flex list-none items-baseline gap-[7px] pl-0";
const MD_CODE = "rounded-[4px] bg-[rgba(18,35,58,0.07)] px-[5px] py-[2px] font-mono text-[0.92em]";
const MD_LINK = "text-[#1769aa] underline underline-offset-2";
const MD_BLOCKQUOTE = "my-3 border-l-[3px] border-l-[rgba(84,157,236,0.55)] py-[2px] pl-3 text-muted";
const MD_HR = "my-[14px] border-0 border-t border-[rgba(18,35,58,0.15)]";
const MD_TABLE_WRAP = "my-3 mb-4 max-w-full overflow-x-auto overscroll-x-contain rounded-[9px] border border-[rgba(18,35,58,0.13)] bg-white/[0.48]";
const MD_TABLE = "w-max min-w-full table-auto border-collapse text-[11px] leading-[1.55] [&_th:first-child]:min-w-[130px] [&_td:first-child]:min-w-[130px] [&_th:last-child]:min-w-[200px] [&_td:last-child]:min-w-[200px] [&_tr:last-child_td]:border-b-0 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0";
const MD_TH = "min-w-[110px] border-r border-b border-[rgba(18,35,58,0.1)] bg-[rgba(84,157,236,0.1)] px-[10px] py-2 align-top font-bold whitespace-nowrap [overflow-wrap:normal] [word-break:normal]";
const MD_TD = "min-w-[110px] border-r border-b border-[rgba(18,35,58,0.1)] px-[10px] py-2 align-top [overflow-wrap:normal] [word-break:normal]";
const MD_CONTAINER = "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

function renderInlineMarkdown(text: string, keyPrefix: string, depth = 0,): ReactNode[] {
  if (depth > 8) return [text];

  // Groups: 1=link, 2=link-text, 3=link-href, 4=code-full, 5=code-inner,
  //         6=bold-full, 7=bold-inner(**), 8=bold-inner(__),
  //         9=strike-full, 10=strike-inner,
  //         11=em-full, 12=em-inner(*), 13=em-inner(_)
  const BOLD = /\*\*(.+?)\*\*|__(.+?)__/;
  const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;
  const CODE = /`([^`]+)`/;
  const STRIKE = /~~(.+?)~~/;
  const EM = /\*(.+?)\*|_(.+?)_/;
  const combined = new RegExp(`(${LINK.source})|(${CODE.source})|(${BOLD.source})|(${STRIKE.source})|(${EM.source})`, "g",);
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${tokenIndex++}`;
    const [
      ,
      ,
      linkText,
      linkHref,
      ,
      codeInner,
      ,
      boldStar,
      boldUnd,
      ,
      strikeInner,
      ,
      emStar,
      emUnd,
    ] = match;

    if (linkText && linkHref) {
      if (/^(https?:\/\/|mailto:)/i.test(linkHref)) {
        nodes.push(
          <a key={key} className={MD_LINK} href={linkHref} target="_blank" rel="noopener noreferrer">
            {renderInlineMarkdown(linkText, key, depth + 1)}
          </a>,
        );
      } else {
        nodes.push(match[0]);
      }
    } else if (codeInner) {
      nodes.push(
        <code key={key} className={MD_CODE}>{codeInner}</code>,
      );
    } else if (boldStar || boldUnd) {
      nodes.push(
        <strong key={key}>{renderInlineMarkdown((boldStar || boldUnd)!, key, depth + 1)}</strong>,
      );
    } else if (strikeInner) {
      nodes.push(
        <del key={key}>{renderInlineMarkdown(strikeInner, key, depth + 1)}</del>,
      );
    } else if (emStar || emUnd) {
      nodes.push(
        <em key={key}>{renderInlineMarkdown((emStar || emUnd)!, key, depth + 1)}</em>,
      );
    } else {
      nodes.push(match[0]);
    }

    lastIndex = combined.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isMarkdownBlockStart(line: string) {
  return /^\s*(#{1,6}\s|```|>|([-*+]\s|\d+[.)]\s)|([-*_]\s*){3,}$)/.test(line);
}

function splitMarkdownTableRow(line: string) {
  const trimmed = line.trim();
  const row = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const content = row.endsWith("|") ? row.slice(0, -1) : row;
  const cells: string[] = [];
  let cell = "";
  let inCode = false;

  for (let index = 0; index < content.length; index++) {
    const character = content[index];
    if (character === "\\" && content[index + 1] === "|") {
      cell += "|";
      index++;
    } else if (character === "`") {
      inCode = !inCode;
      cell += character;
    } else if (character === "|" && !inCode) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function isMarkdownTableStart(lines: string[], index: number) {
  if (index + 1 >= lines.length || !lines[index].includes("|")) return false;
  const headers = splitMarkdownTableRow(lines[index]);
  const columns = splitMarkdownTableRow(lines[index + 1]);
  return (
    headers.length > 0 &&
    columns.length === headers.length &&
    columns.every((column) => /^:?-{3,}:?$/.test(column))
  );
}

function renderMarkdownList(lines: string[], startIndex: number, depth = 0) {
  const firstItem = lines[startIndex].match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
  if (!firstItem) return null;

  const baseIndent = firstItem[1].length;
  const ordered = /^\d/.test(firstItem[2]);
  const items: ReactNode[] = [];
  let index = startIndex;

  // Nested lists (depth >= 1) use a tighter margin and a different bullet style.
  const containerMargin = depth === 0 ? MD_LIST_TOP : MD_LIST_NESTED;
  const listType = ordered ? depth === 0 ? "list-[decimal]" : "list-[lower-alpha]" : depth === 0 ? "list-[disc]" : "list-[circle]";
  const containerClass = `${containerMargin} ${listType}`;

  while (index < lines.length) {
    const item = lines[index].match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (!item || item[1].length < baseIndent) break;
    if (item[1].length > baseIndent) break;
    if (/^\d/.test(item[2]) !== ordered) break;

    const key = `item-${index}`;
    const task = item[3].match(/^\[([ xX])\]\s+(.*)$/);
    const text = task ? task[2] : item[3];
    const children: ReactNode[] = [];
    if (task) {
      children.push(
        <input key={`${key}-checkbox`} type="checkbox" className="flex-none accent-accent-bright" checked={task[1].toLowerCase() === "x"} disabled aria-label={task[1].toLowerCase() === "x" ? "Completed" : "Not completed"} />,
      );
    }
    children.push(...renderInlineMarkdown(text, key));
    index++;

    if (index < lines.length) {
      const nested = lines[index].match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
      if (nested && nested[1].length > baseIndent) {
        const nestedList = renderMarkdownList(lines, index, depth + 1);
        if (nestedList) {
          children.push(nestedList.node);
          index = nestedList.nextIndex;
        }
      }
    }
    items.push(
      <li key={key} className={task ? MD_TASK_LI : MD_LI}>
        {children}
      </li>,
    );
  }

  return {
    node: ordered ? (
      <ol key={`list-${startIndex}`} className={containerClass}>
        {items}
      </ol>
    ) : (
      <ul key={`list-${startIndex}`} className={containerClass}>
        {items}
      </ul>
    ),
    nextIndex: index,
  };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Split highlighted HTML into lines, closing and reopening spans so every line is valid on its own. */
function splitHtmlLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let current = "";
  for (const m of html.matchAll(/<span[^>]*>|<\/span>|\n|[^<\n]+/g)) {
    const t = m[0];
    if (t === "\n") {
      current += "</span>".repeat(open.length);
      lines.push(current);
      current = open.join("");
    } else {
      if (t.startsWith("<span")) open.push(t);
      else if (t === "</span>") open.pop();
      current += t;
    }
  }
  lines.push(current);
  return lines;
}

function highlightToLines(code: string, lang: string): string[] {
  try {
    const html = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : escapeHtml(code);
    return splitHtmlLines(html);
  } catch {
    return splitHtmlLines(escapeHtml(code));
  }
}

const CHANGE_RE = /(?:\/\/|#|--|\/\*|<!--)\s*(ADDED|NEW|CHANGED|FIXED|UPDATED|REMOVED)\b/;

function changeKind(line: string, lang: string,): "added" | "changed" | "removed" | null {
  if (lang === "diff") {
    if (/^\+(?!\+\+)/.test(line)) return "added";
    if (/^-(?!--)/.test(line)) return "removed";
    return null;
  }
  const m = line.match(CHANGE_RE);
  if (!m) return null;
  if (m[1] === "ADDED" || m[1] === "NEW") return "added";
  if (m[1] === "REMOVED") return "removed";
  return "changed";
}

/* Border-left colour per changed-line kind (replaces the transparent default). */
const CODE_LINE_BASE = "code-line block w-max min-w-full min-h-[1.65em] border-l-[3px] pr-4 whitespace-pre [overflow-wrap:normal]";
const CODE_LINE_KIND: Record<string, string> = {
  added: "border-l-[#3fb950] bg-[rgba(63,185,80,0.16)]",
  changed: "border-l-[#d29922] bg-[rgba(210,153,34,0.16)]",
  removed: "border-l-[#f85149] bg-[rgba(248,81,73,0.16)]",
};

function splitHtmlAndEmbeddedCss(source: string) {
  const cssMarker = /^[ \t]*\/\*\s*style\.css\s*\*\/[ \t]*\r?$/im;
  const scriptMarker = /^[ \t]*\/\*\s*script\.js\s*\*\/[ \t]*\r?$/im;
  const cssMatch = cssMarker.exec(source);
  if (!cssMatch || cssMatch.index === undefined) {
    return { html: source, css: "" };
  }

  const cssStart = cssMatch.index + cssMatch[0].length;
  const scriptMatch = scriptMarker.exec(source.slice(cssStart));
  const cssEnd = scriptMatch ? cssStart + scriptMatch.index : source.length;
  return {
    html: source.slice(0, cssMatch.index).trimEnd(),
    css: source.slice(cssStart, cssEnd).trim(),
  };
}

function buildHtmlPreview(code: string, cssCode: string) {
  const split = splitHtmlAndEmbeddedCss(code.trim());
  const htmlCode = split.html || code;
  const combinedCss = [cssCode, split.css].filter(Boolean).join("\n\n");
  const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\' data: https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; media-src data: blob:; base-uri \'none\'; form-action \'none\'">';
  const safeCss = combinedCss.replace(/<\/style/gi, "<\\/style");
  const style = combinedCss ? `<style>${safeCss}</style>` : "";
  const headContent = `${csp}${style}`;
  let sourceHtml = htmlCode.trim().replace(/<meta\b(?=[^>]*\bhttp-equiv\s*=\s*(?:"refresh"|'refresh'|refresh\b))[^>]*>/gi, "",).replace(/\s+ping\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  if (combinedCss) {
    sourceHtml = sourceHtml.replace(/<link\b[^>]*>/gi, (tag) => {
      const rel = tag.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,);
      const href = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,);
      const relValue = rel?.[1] ?? rel?.[2] ?? rel?.[3] ?? "";
      const hrefValue = href?.[1] ?? href?.[2] ?? href?.[3] ?? "";

      if (relValue.toLowerCase().split(/\s+/).includes("stylesheet") && /\.css(?:[?#]|$)/i.test(hrefValue)) {
        return "";
      }
      return tag;
    });
  }

  if (/<html[\s>]/i.test(sourceHtml)) {
    if (/<head[\s>]/i.test(sourceHtml)) {
      return sourceHtml.replace(/<head([^>]*)>/i, (_match, attributes: string) => `<head${attributes}>${headContent}`,);
    }
    return sourceHtml.replace(
      /<html([^>]*)>/i,
      (_match, attributes: string) =>
        `<html${attributes}><head>${headContent}</head>`,
    );
  }

  if (/<head[\s>]/i.test(sourceHtml)) {
    return `<!doctype html>${sourceHtml.replace(
      /<head([^>]*)>/i,
      (_match, attributes: string) => `<head${attributes}>${headContent}`,
    )}`;
  }

  return `<!doctype html><html><head>${headContent}</head><body>${sourceHtml}</body></html>`;
}

function collectCssBlocks(lines: string[]) {
  const stylesheets: string[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!/^\s*```/.test(lines[index])) {
      index++;
      continue;
    }

    const info = lines[index].trim().replace(/^`+/, "").trim();
    const language = info.split(/\s+/)[0].toLowerCase();
    index++;

    const code: string[] = [];
    while (index < lines.length && !/^\s*```/.test(lines[index])) {
      code.push(lines[index++]);
    }
    const source = code.join("\n");
    const looksLikeCss = /(?:^|\n)\s*(?:[:.#][\w-][^{]*|[a-z][\w-]*(?:\s*,\s*[.#a-z][^{]*)?)\s*\{[^}]*:[^}]*\}/i.test(source,) || /@(?:media|supports|keyframes|import|font-face)\b/i.test(source);
    const isCss = language === "css" || /(?:^|\s)file=[^\s]+\.css(?:$|\?)/i.test(info) || /(?:^|\s)(?:style|styles)\.css(?:$|\s)/i.test(info) || (["", "text", "txt", "html", "plaintext"].includes(language) && looksLikeCss);
    if (isCss && source.trim()) {
      stylesheets.push(source.replace(/^\s*\/\*\s*style\.css\s*\*\/\s*/i, ""));
    }
    if (index < lines.length) index++;
  }

  return stylesheets.join("\n\n");
}

function CodeBlock({ code, lang, previewCss = "", }: { code: string; lang: string; previewCss?: string; }) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const htmlLines = useMemo(() => highlightToLines(code, lang), [code, lang]);
  const kinds = useMemo(() => code.split("\n").map((l) => changeKind(l, lang)), [code, lang],);
  const changeCount = kinds.filter(Boolean).length;
  const plain = !lang || !hljs.getLanguage(lang);
  const supportsPreview = lang === "html" || lang === "htm";
  const hasInlineStyles = /<style\b[^>]*>[\s\S]*?<\/style\s*>/i.test(code);
  const previewDocument = useMemo(() => (supportsPreview ? buildHtmlPreview(code, previewCss) : ""), [code, previewCss, supportsPreview],);

  useEffect(() => {
    if (!previewOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
        previewButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  function closePreview() {
    setPreviewOpen(false);
    previewButtonRef.current?.focus();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d1b2e] text-left whitespace-normal shadow-[0_8px_28px_rgba(18,35,58,0.18)]">
      <div className="flex items-center gap-[10px] border-b border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[11px] text-[#9fb3c8]">
        <span className="[font-weight:650] tracking-[0.3px]">
          {lang || "text"}
        </span>
        {changeCount > 0 && (
          <span className="text-[10px] text-[#e3b341]">
            {changeCount} {changeCount === 1 ? "change" : "changes"} highlighted
          </span>
        )}
        <div className="ml-auto flex items-center gap-[6px]">
          {supportsPreview && (
            <button ref={previewButtonRef} type="button" className="cursor-pointer rounded-[7px] border border-[rgba(147,199,255,0.28)] bg-[rgba(40,127,223,0.2)] px-[10px] py-[3px] text-[10px] text-[#dcecff] hover:bg-[rgba(40,127,223,0.34)]" onClick={() => setPreviewOpen(true)}>
              Preview
            </button>
          )}
          <button type="button" className="cursor-pointer rounded-[7px] border border-white/[0.14] bg-transparent px-[10px] py-[3px] text-[10px] text-[#c9d6e4] hover:bg-white/10" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className={`code-body max-h-[520px] overflow-auto py-[10px] [counter-reset:line] font-mono text-[12px] leading-[1.65] text-[#d6e2f0] [scrollbar-color:rgba(159,179,200,0.35)_transparent] [scrollbar-width:thin] ${plain ? "no-lines" : ""}`}>
        {htmlLines.map((html, i) => (
          <div key={i} className={`${CODE_LINE_BASE} ${CODE_LINE_KIND[kinds[i] ?? ""] ?? "border-l-transparent"}`} dangerouslySetInnerHTML={{ __html: html }} />
        ))}
      </div>
      {previewOpen ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(8,18,31,0.72)] p-3 backdrop-blur-sm [@media(max-width:600px)]:p-0" role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <section className="flex h-[min(92dvh,900px)] w-[min(1100px,100%)] flex-col overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_24px_90px_rgba(0,0,0,0.35)] [@media(max-width:600px)]:h-dvh [@media(max-width:600px)]:rounded-none" role="dialog" aria-modal="true" aria-label="HTML preview">
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[rgba(244,248,253,0.95)] px-3 py-2">
              <strong className="mr-auto text-[12px] text-foreground">
                HTML preview
              </strong>
              <div className="flex items-center gap-1 rounded-[8px] border border-line bg-white p-1" aria-label="Preview width">
                {(["desktop", "tablet", "mobile"] as const).map((width) => (
                  <button key={width} type="button" className={`rounded-[6px] px-[9px] py-[5px] text-[10px] capitalize ${previewWidth === width ? "bg-[rgba(40,127,223,0.13)] font-semibold text-accent-dark" : "text-muted hover:bg-[rgba(40,127,223,0.07)]"}`} aria-pressed={previewWidth === width} onClick={() => setPreviewWidth(width)}>
                    {width}
                  </button>
                ))}
              </div>
              <button type="button" className="grid h-[32px] w-[32px] cursor-pointer place-items-center rounded-[8px] border border-line bg-white text-[18px] text-muted hover:bg-[rgba(40,127,223,0.08)]" aria-label="Close preview" autoFocus onClick={closePreview}>
                ×
              </button>
            </div>
            <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[#e8eef5] p-3 [@media(max-width:600px)]:p-0">
              <iframe className={`h-full max-w-full flex-none border-0 bg-white shadow-[0_3px_18px_rgba(18,35,58,0.14)] ${previewWidth === "desktop" ? "w-full" : previewWidth === "tablet" ? "w-[768px]" : "w-[390px]"}`} title="HTML and CSS preview" sandbox="" referrerPolicy="no-referrer" srcDoc={previewDocument} />
            </div>
            <p className="m-0 border-t border-line px-3 py-[7px] text-[10px] text-muted">
              {!hasInlineStyles && !previewCss.trim() ? "No CSS found in this response. Ask Nimbot to regenerate a complete HTML page with CSS inside a <style> tag." : "Scripts are disabled. Google Fonts are allowed; local image files must be provided separately."}
            </p>
          </section>
        </div>,
        window.document.body,
      )
        : null}
    </div>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  // Turn any `file=Name.ext` marker the model emitted into a real file fence
  // so it renders as a download card. Idempotent for already-correct content.
  const normalized = useMemo(() => normalizeFileBlocks(content), [content]);
  const lines = normalized.split(/\r?\n/);
  const previewCss = useMemo(() => collectCssBlocks(lines), [lines]);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }

    const key = `block-${index}`;
    if (/^\s*```/.test(line)) {
      const info = line.trim().replace(/^`+/, "").trim();
      const fileMatch = info.match(/(?:^|\s)file=([^\s]+)/);
      const lang = info.split(/\s+/)[0].toLowerCase(); // ADDED: read the language tag
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        codeLines.push(lines[index++]);
      }
      if (index < lines.length) index++;
      if (fileMatch) {
        // A file the AI generated for download (e.g. ```file=report.csv).
        blocks.push(
          <DownloadableFile key={key} name={fileMatch[1]} content={codeLines.join("\n")} />,
        );
        continue;
      }
      blocks.push(
        <CodeBlock key={key} code={codeLines.join("\n")} lang={lang} previewCss={lang === "html" || lang === "htm" ? previewCss : ""} />,
      );
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const headers = splitMarkdownTableRow(line);
      const alignment = splitMarkdownTableRow(lines[index + 1]).map(
        (column) => {
          if (column.startsWith(":") && column.endsWith(":"))
            return "center" as const;
          if (column.endsWith(":")) return "right" as const;
          return "left" as const;
        },
      );
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitMarkdownTableRow(lines[index++]));
      }
      blocks.push(
        <div className={MD_TABLE_WRAP} key={key}>
          <table className={MD_TABLE}>
            <thead>
              <tr>
                {headers.map((header, columnIndex) => (
                  <th className={MD_TH} key={`header-${columnIndex}`} scope="col" style={{ textAlign: alignment[columnIndex] }}>
                    {renderInlineMarkdown(header, `${key}-header-${columnIndex}`,)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, columnIndex) => (
                    <td className={MD_TD} key={`cell-${columnIndex}`} style={{ textAlign: alignment[columnIndex] }}>
                      {renderInlineMarkdown(row[columnIndex] || "", `${key}-${rowIndex}-${columnIndex}`,)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const children = renderInlineMarkdown(heading[2], key);
      const sizeClass = level === 1 ? "text-[19px]" : level === 2 ? "text-[17px]" : level === 3 ? "text-[15px]" : "text-[13px]";
      const headingClass = `${MD_HEADING_BASE} ${sizeClass}`;
      if (level === 1)
        blocks.push(<h1 key={key} className={headingClass}>{children}</h1>,);
      else if (level === 2)
        blocks.push(<h2 key={key} className={headingClass}>{children}</h2>,);
      else if (level === 3)
        blocks.push(<h3 key={key} className={headingClass}>{children}</h3>,);
      else if (level === 4)
        blocks.push(<h4 key={key} className={headingClass}>{children}</h4>,);
      else if (level === 5)
        blocks.push(<h5 key={key} className={headingClass}>{children}</h5>,);
      else
        blocks.push(<h6 key={key} className={headingClass}>{children}</h6>,);
      index++;
      continue;
    }

    if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      blocks.push(<hr key={key} className={MD_HR} />);
      index++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoteLines.push(lines[index++].replace(/^\s*>\s?/, ""));
      }
      blocks.push(
        <blockquote key={key} className={MD_BLOCKQUOTE}>
          <MarkdownMessage content={quoteLines.join("\n")} />
        </blockquote>,
      );
      continue;
    }

    const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const list = renderMarkdownList(lines, index);
      if (list) {
        blocks.push(list.node);
        index = list.nextIndex;
        continue;
      }
    }

    const paragraphLines = [line.trim()];
    index++;
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index]) && !isMarkdownTableStart(lines, index)) {
      paragraphLines.push(lines[index++].trim());
    }
    blocks.push(
      <p key={key} className={MD_P}>
        {renderInlineMarkdown(paragraphLines.join(" "), key)}
      </p>,
    );
  }

  return <div className={MD_CONTAINER}>{blocks}</div>;
}