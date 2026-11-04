/**
 * Makes the AI's file output render as a real downloadable file card, even
 * when the model does not follow the ```file=name.ext fence convention
 * perfectly (small local models often emit `file=name.pdf` as plain text, or
 * a fake `https://.../file=name.pdf` link).
 *
 * This is pure string logic with no DOM / Node APIs so it can run both on the
 * server (to normalize the streamed reply before it is stored and re-streamed
 * to the browser) and on the client (as a fallback for legacy stored chats).
 *
 * After normalization a "file block" always looks like a normal fenced block
 * whose info line contains `file=Name.ext`, which is exactly what the markdown
 * renderer turns into a DownloadableFile card:
 *
 *   ```file=report.pdf
 *   ...content...
 *   ```
 */

/** Extensions that make a `file=...` marker believable as a generated file. */
const FILE_EXT =
  "pdf|docx?|xlsx?|pptx?|md|markdown|txt|text|csv|tsv|html?|css|json|xml|ya?ml|js|ts|jsx|tsx|py|sql|svg|log|ini|cfg|conf|rtf";

const MARKER = String.raw`file=[\w][\w .\-()]*?\.(?:${FILE_EXT})`;

/** Split into lines but remember whether the source used CRLF. */
function splitLines(text: string): { lines: string[]; eol: string } {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { lines: text.split(/\r?\n/), eol };
}

/** Clean up a filename that may be wrapped in quotes or trailing punctuation. */
function cleanFileName(raw: string): string {
  return raw
    .replace(/^["'`(]+/, "")
    .replace(/["'`)\],.;:]+$/, "")
    .trim();
}

/** Does this info line already open a file fence? Returns the cleaned name. */
function fenceMarkerName(info: string): string | null {
  const m = info.match(new RegExp(String.raw`(?:^|\s)(${MARKER})\b`));
  return m ? cleanFileName(m[1].slice("file=".length)) : null;
}

function isFenceLine(line: string): boolean {
  return /^\s*```/.test(line);
}

function fenceFitsName(name: string): boolean {
  // Inside a fence we cannot see the real extension, so any marker whose stem
  // matches is good enough to adopt.
  return new RegExp(String.raw`^[\w][\w .\-()]*?\.(?:${FILE_EXT})$`).test(name);
}

function readFenceBlock(
  lines: string[],
  start: number,
): { info: string; body: string[]; end: number } {
  const info = lines[start].trim().replace(/^`+/, "").trim();
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && !isFenceLine(lines[i])) body.push(lines[i++]);
  return { info, body, end: i < lines.length ? i + 1 : i };
}

/** Recover a filename from a fake `.../file=Name.pdf` style URL. */
function nameFromUrl(line: string): string | null {
  const idx = line.indexOf("file=");
  if (idx === -1) return null;
  const cleaned = cleanFileName(line.slice(idx + "file=".length));
  return fenceFitsName(cleaned) ? cleaned : null;
}

/** Is there a plausible "the file is here" cue on this line? */
function looksLikeLinkLine(line: string): boolean {
  return /https?:\/\/|download (?:the )?file|save (?:it|this) as|click (?:the )?(?:link|button)/i.test(
    line,
  );
}

/** Short human label for a file extension, used in the chat prose. */
function extLabel(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const labels: Record<string, string> = {
    pdf: "PDF",
    doc: "Word document",
    docx: "Word document",
    xls: "Excel spreadsheet",
    xlsx: "Excel spreadsheet",
    ppt: "PowerPoint",
    pptx: "PowerPoint",
    md: "Markdown",
    csv: "CSV",
    txt: "text file",
    html: "HTML",
    json: "JSON",
  };
  return labels[ext] ?? ext.toUpperCase() + " file";
}

/** Does this line consist of a file marker (plus optional punctuation)? */
function isOwnLineMarker(line: string): boolean {
  const t = line.trim();
  const m = t.match(new RegExp("^(" + MARKER + ")[)\\].,:;!?'" + '"`]*$'));
  return !!m;
}

/**
 * Build a real file fence from a marker line plus the content that follows.
 * Returns the fence lines and how many of `body` were consumed, so the caller
 * can advance exactly (re-consuming lines would duplicate them as prose).
 */
function buildFence(
  name: string,
  body: string[],
  addBlankAfter: boolean,
): { fence: string[]; consumed: number } {
  const content: string[] = [];
  let started = false;
  let consumed = 0;
  for (const line of body) {
    const trimmed = line.trim();
    // Stop at a structural marker, a new file marker, or when the prose resumes.
    if (
      trimmed &&
      (isFenceLine(line) || looksLikeLinkLine(line) || isOwnLineMarker(line))
    )
      break;
    consumed++;
    if (!trimmed && !started) continue; // skip leading blank lines
    if (trimmed) started = true;
    content.push(line.replace(/\s+$/, ""));
  }
  // Don't count trailing blank lines we trimmed off the content.
  while (consumed > 0 && !body[consumed - 1].trim()) consumed--;
  while (content.length && !content[content.length - 1].trim()) content.pop();
  const fence = ["```file=" + name, ...content, "```"];
  if (addBlankAfter) fence.push("");
  return { fence, consumed };
}

/**
 * Rewrite a model reply so every `file=Name.ext` marker becomes a real file
 * fence that the markdown renderer turns into a download card. Idempotent:
 * content that already follows the convention is left untouched.
 */
export function normalizeFileBlocks(reply: string): string {
  if (!reply || reply.indexOf("file=") === -1) return reply;

  const { lines } = splitLines(reply);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Case 1: a fenced block whose info line carries the marker -> keep, but
    // normalize the header. If instead the FIRST content line inside the fence
    // is the marker (e.g. ```excel \n file=world.xlsx \n rows...), promote it
    // to the header so the whole block becomes a file card.
    if (isFenceLine(line)) {
      const { info, body, end } = readFenceBlock(lines, i);
      const name = fenceMarkerName(info);
      if (name) {
        out.push(`\`\`\`file=${name}`, ...body, "```");
      } else {
        const firstBody = body.findIndex((l) => l.trim());
        const bodyMarker =
          firstBody !== -1 && isOwnLineMarker(body[firstBody])
            ? cleanFileName(
                body[firstBody]
                  .trim()
                  .replace(/[)\].,:;!?'"`]+$/, "")
                  .slice(5),
              )
            : null;
        if (bodyMarker) {
          out.push(
            `\`\`\`file=${bodyMarker}`,
            ...body.slice(firstBody + 1),
            "```",
          );
        } else {
          for (let k = i; k < end; k++) out.push(lines[k]);
        }
      }
      i = end;
      continue;
    }

    // Case 2: a plain-text `file=Name.ext` marker on a line of its own -> wrap
    // the content that follows into a real fence. A marker embedded mid-sentence
    // (e.g. "I generated file=report.txt with your notes") is treated as prose,
    // because we can't tell where the file's content would start.
    const marker = line.match(new RegExp(String.raw`(?:^|\s)(${MARKER})\b`));
    if (marker && marker.index !== undefined) {
      const markerStart = marker.index;
      const name = cleanFileName(marker[1].slice("file=".length));
      const before = line.slice(0, markerStart).trim();
      const after = line.slice(markerStart + marker[1].length).trim();
      // The marker must end the line (only trailing punctuation allowed).
      if (after && !/^[)\].,:;!?'"`]*$/.test(after)) {
        out.push(line);
        i++;
        continue;
      }
      if (before) out.push(before);

      let j = i + 1;
      // Skip an optional stray opening fence the model sometimes adds.
      if (
        j < lines.length &&
        isFenceLine(lines[j]) &&
        !fenceMarkerName(lines[j].replace(/^`+/, "").trim())
      )
        j++;
      // Tolerate an immediate closing fence (an "empty" file the model closed).
      if (j < lines.length && isFenceLine(lines[j])) {
        out.push(`\`\`\`file=${name}`, "```");
        i = j + 1;
        continue;
      }
      const { fence, consumed } = buildFence(name, lines.slice(j), true);
      out.push(...fence);
      i = j + consumed;
      continue;
    }

    // Case 3: a fake `https://.../file=Name.pdf` "download link" the model
    // invented. There is no real file behind it, and the surrounding prose is
    // not reliably the file's content, so don't try to guess. Keep the prose,
    // drop the dead link, and append a real download card for the name.
    if (line.includes("file=") && looksLikeLinkLine(line)) {
      const urlName = nameFromUrl(line);
      if (urlName) {
        out.push("", `Here is the ${extLabel(urlName)} you asked for:`, "");
        out.push(`\`\`\`file=${urlName}`, "```", "");
        i++;
        continue;
      }
    }

    out.push(line);
    i++;
  }

  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join("\n");
}
