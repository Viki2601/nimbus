"use client";
import { useState } from "react";
import { Icon } from "./icon";

export function FileCard({
  name,
  code,
  onRemove,
}: {
  name: string;
  code: string;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const lines = code.split("\n").length;
  return (
    <div
      data-file-card=""
      className="max-w-full overflow-hidden rounded-xl border border-black/10 bg-white/70"
    >
      <div className="flex items-center">
        <button
          type="button"
          className="flex min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-2 text-left text-[13px] text-inherit"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <Icon name="file" size={16} />
          <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold">
            {name}
          </span>
          <span className="whitespace-nowrap text-xs opacity-60">
            {lines} {lines === 1 ? "line" : "lines"}
          </span>
        </button>
        {onRemove && (
          <button
            type="button"
            className="mr-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-inherit opacity-60 hover:bg-black/[0.06] hover:opacity-100"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {open && (
        <pre className="m-0 max-h-[320px] overflow-auto border-t border-black/[0.08] bg-black/[0.03] px-[14px] py-3 text-left text-[12.5px] leading-normal">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
