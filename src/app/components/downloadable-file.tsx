"use client";
import { useState } from "react";
import { Icon } from "./icon";
import {
  DOWNLOADABLE_EXTENSIONS,
  fileKindLabel,
  generateFileBlob,
  safeFileName,
} from "./generate-file";

/**
 * A file the AI produced for download. Rendered instead of a code block
 * whenever a fence's opening line contains `file=name.ext`.
 *
 * Styled like a Claude-style artifact card: a header with the file name and
 * type, an expandable preview of the plain-text content, and Download /
 * Copy actions. Binary formats (.pdf/.docx/.xlsx/.pptx) are built in the
 * browser from the plain-text body when Download is pressed.
 */
export function DownloadableFile({
  name,
  content,
}: {
  name: string;
  content: string;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeName = safeFileName(name);
  const ext = (safeName.split(".").pop() ?? "").toLowerCase();
  const kindLabel = fileKindLabel(safeName);
  // Binary formats have no readable inline preview; text formats do.
  const previewable =
    DOWNLOADABLE_EXTENSIONS.has(ext) &&
    !["pdf", "docx", "xlsx", "pptx", "xls"].includes(ext);

  const lineCount = content ? content.split("\n").length : 0;
  const byteSize = (() => {
    try {
      const size = new Blob([content]).size;
      return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
    } catch {
      return `${content.length} chars`;
    }
  })();

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const blob = await generateFileBlob(safeName, content);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error("Could not generate the download.", err);
      setError("That file could not be generated. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  }

  return (
    <div
      data-downloadable-file=""
      className="my-3 overflow-hidden rounded-xl border border-[rgba(18,35,58,0.14)] bg-white text-left shadow-[0_8px_28px_rgba(18,35,58,0.12)]"
    >
      {/* Header: file identity + expand toggle + actions */}
      <div className="flex items-center gap-[10px] border-b border-[rgba(18,35,58,0.09)] bg-[linear-gradient(180deg,rgba(240,246,252,0.9),rgba(255,255,255,0.6))] px-3 py-2">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-md bg-[rgba(84,157,236,0.14)] text-[#2f6db3]">
          <Icon name="file" size={15} />
        </span>
        <button
          type="button"
          onClick={() => previewable && setOpen((v) => !v)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-[7px] border-0 bg-transparent p-0 text-left"
          aria-expanded={open}
          aria-label={open ? `Collapse ${safeName}` : `Expand ${safeName}`}
        >
          {previewable && (
            <span
              className={`flex-none text-[#7a8aa0] transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
            >
              <Icon name="chevron" size={15} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-[#1c2c40]">
              {safeName}
            </span>
            <span className="block text-[10.5px] text-[#6b7a8d]">
              {kindLabel} &middot; {byteSize}
              {lineCount > 0
                ? ` \u00b7 ${lineCount} ${lineCount === 1 ? "line" : "lines"}`
                : ""}
            </span>
          </span>
        </button>

        <div className="ml-auto flex flex-none items-center gap-[6px]">
          <button
            type="button"
            onClick={copy}
            className="flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-[rgba(18,35,58,0.14)] bg-white px-[10px] py-[5px] text-[11px] text-[#3a4a5e] transition-colors hover:bg-[rgba(84,157,236,0.08)]"
            aria-label={`Copy ${safeName} contents`}
          >
            <Icon name="copy" size={13} />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy}
            className="flex cursor-pointer items-center gap-[6px] rounded-[7px] border border-[rgba(147,199,255,0.28)] bg-[linear-gradient(145deg,var(--accent,#3185e0),var(--accent-dark,#256bbd))] px-[13px] py-[5px] text-[11px] text-white transition-[transform,box-shadow] duration-[140ms] hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(49,133,224,0.3)] disabled:cursor-wait disabled:opacity-70"
            aria-label={`Download ${safeName}`}
          >
            <Icon name="download" size={13} />
            {busy ? "Generating\u2026" : "Download"}
          </button>
        </div>
      </div>

      {error && (
        <p className="m-0 border-b border-[rgba(166,75,75,0.18)] bg-[rgba(248,81,73,0.08)] px-3 py-[6px] text-[11px] text-[#a64b4b]">
          {error}
        </p>
      )}

      {/* Preview (text formats) or a type note (binary formats) */}
      {previewable ? (
        open && (
          <pre className="m-0 max-h-[360px] overflow-auto bg-[#0d1b2e] px-3 py-[10px] font-mono text-[12px] leading-[1.6] whitespace-pre-wrap text-[#d6e2f0] [overflow-wrap:anywhere] [scrollbar-color:rgba(159,179,200,0.35)_transparent] [scrollbar-width:thin]">
            {content}
          </pre>
        )
      ) : (
        <div className="flex items-center gap-2 bg-[#f6f9fc] px-3 py-[9px] text-[11px] text-[#5a6b7f]">
          <Icon name="download" size={13} />
          {kindLabel} generated from the text above &mdash; press{" "}
          <span className="font-semibold text-[#2f6db3]">Download</span> to save
          the file.
        </div>
      )}
    </div>
  );
}
