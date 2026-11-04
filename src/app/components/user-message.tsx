import { FileCard } from "./file-card";

export type UserPart =
  | { type: "text"; text: string }
  | { type: "file"; name: string; lang: string; code: string };

export function parseUserContent(content: string): UserPart[] {
  const re =
    /^(`{3,})([\w+#.-]*)[^\S\n]*(?:file=([^\n]+))?\n([\s\S]*?)\n\1[^\S\n]*$/gm;
  const parts: UserPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const before = content.slice(last, m.index).trim();
    if (before) parts.push({ type: "text", text: before });
    parts.push({
      type: "file",
      name: (m[3] ?? "snippet.txt").trim(),
      lang: m[2],
      code: m[4],
    });
    last = re.lastIndex;
  }
  const rest = content.slice(last).trim();
  if (rest) parts.push({ type: "text", text: rest });
  return parts;
}

export function UserMessage({ content }: { content: string }) {
  return (
    <>
      {parseUserContent(content).map((part, i) =>
        part.type === "text" ? (
          <span
            className="block whitespace-pre-wrap [overflow-wrap:anywhere]"
            key={i}
          >
            {part.text}
          </span>
        ) : (
          <FileCard key={i} name={part.name} code={part.code} />
        ),
      )}
    </>
  );
}
