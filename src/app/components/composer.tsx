"use client";
import { useRef, useState } from "react";
import type { ClipboardEvent, DragEvent, RefObject } from "react";
import { Icon } from "./icon";
import { FileCard } from "./file-card";
import { MAX_ATTACH_FILES, type Attachment } from "./attachments";

/* Class strings kept identical to the original plain-CSS values. */
const COMPOSER_WRAP =
  "w-[min(100%_-_48px,760px)] flex-none self-center pb-[17px] [@media(max-width:720px)]:w-[calc(100%_-_28px)] [@media(max-width:720px)]:pb-[11px]";
const COMPOSER =
  "rounded-[17px] border border-[rgba(117,168,229,0.25)] bg-surface-strong px-[14px] pt-[13px] pb-[11px] pl-[17px] shadow-[0_15px_48px_rgba(47,80,122,0.12),inset_0_1px_rgba(255,255,255,0.6)] backdrop-blur-[24px] transition-[border-color,box-shadow] duration-150 ease focus-within:none";
const TEXTAREA =
  "block max-h-[180px] w-full min-h-[29px] resize-none overflow-y-auto border-0 bg-transparent px-px pt-[3px] pb-[6px] text-xs leading-[1.55] text-foreground outline-none placeholder:text-muted";
const CONTROLS = "flex min-h-[31px] items-center justify-between";
const SEND_BUTTON =
  "grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-[rgba(147,199,255,0.28)] text-white bg-[linear-gradient(145deg,var(--accent),var(--accent-dark))] transition-[background,transform,box-shadow] duration-[140ms] hover:enabled:-translate-y-px hover:enabled:shadow-[0_5px_18px_rgba(49,133,224,0.3)] disabled:cursor-not-allowed disabled:bg-[rgba(100,124,153,0.27)] disabled:text-muted";
const ATTACH_BUTTON =
  "grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-[rgba(147,199,255,0.28)] bg-transparent text-muted transition-[background,color,transform] duration-[140ms] hover:-translate-y-px hover:bg-[rgba(83,161,246,0.12)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

type ComposerProps = {
  input: string;
  attachments: Attachment[];
  loading: boolean;
  historyLoading: boolean;
  attaching: boolean;
  attachError: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
};

export function Composer({
  input,
  attachments,
  loading,
  historyLoading,
  attaching,
  attachError,
  inputRef,
  onInputChange,
  onPaste,
  onAttachFiles,
  onRemoveAttachment,
  onSend,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) onAttachFiles(files);
  }

  const attachFull = attachments.length >= MAX_ATTACH_FILES;

  return (
    <div className={COMPOSER_WRAP}>
      <form
        className={`${COMPOSER} ${dragging ? "border-[#53a1f6a6] shadow-[0_15px_48px_rgba(47,80,122,0.12),0_0_0_3px_rgba(57,139,231,0.12)]" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={handleDrop}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-0">
            {attachments.map((a) => (
              <FileCard
                key={a.id}
                name={a.name}
                code={a.code}
                onRemove={() => onRemoveAttachment(a.id)}
              />
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          className={TEXTAREA}
          onPaste={onPaste}
          onChange={(event) => {
            onInputChange(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={
            dragging ? "Drop files to attach them" : "Message Nimbot..."
          }
          aria-label="Message Nimbot"
        />
        <div className={CONTROLS}>
          {attachError ? (
            <span className="max-w-[60%] text-[9px] text-[#a64b4b]">
              {attachError}
            </span>
          ) : (
            <span className="text-[9px] text-muted">
              {attaching
                ? "Reading file..."
                : "AI answers with Nimbus help docs for product questions"}
            </span>
          )}
          <div className="flex items-center gap-[10px]">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = ""; // allow re-picking the same file
                if (files.length) onAttachFiles(files);
              }}
            />
            <button
              className={ATTACH_BUTTON}
              type="button"
              disabled={loading || historyLoading || attaching || attachFull}
              aria-label={
                attachFull
                  ? `Attachment limit of ${MAX_ATTACH_FILES} files reached`
                  : "Attach files"
              }
              title={
                attachFull
                  ? `You can attach up to ${MAX_ATTACH_FILES} files`
                  : "Attach files (PDF, DOCX, XLSX, PPTX, MD, CSV, TXT, HTML...)"
              }
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="paperclip" size={16} />
            </button>
            <button
              className={SEND_BUTTON}
              type="submit"
              disabled={
                loading ||
                historyLoading ||
                attaching ||
                (!input.trim() && attachments.length === 0)
              }
              aria-label="Send message"
            >
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </form>
      <p className="mt-[9px] mb-0 text-center text-[9px] text-muted">
        Nimbot can make mistakes. Check important information.
      </p>
    </div>
  );
}
