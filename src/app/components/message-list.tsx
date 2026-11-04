import type { RefObject } from "react";
import { Icon } from "./icons";
import { MarkdownMessage } from "./markdown";
import { UserMessage } from "./user-message";
import { TypingIndicator } from "./typing-indicator";

export type Msg = { role: "user" | "assistant"; content: string };

/* Class strings kept identical to the original plain-CSS values. */
const MESSAGE_LIST =
  "mx-auto w-[min(100%_-_48px,760px)] pt-9 pb-[42px] [@media(max-width:720px)]:w-[calc(100%_-_28px)] [@media(max-width:720px)]:pt-6";
const MESSAGE_ROW = "mb-[26px] flex gap-3 animate-[rise-in_250ms_ease_both]";
const ASSISTANT_AVATAR =
  "mt-px grid h-[29px] w-[29px] flex-none place-items-center rounded-[10px] text-white shadow-[0_8px_26px_rgba(48,137,231,0.24)] bg-[linear-gradient(145deg,var(--accent-bright),var(--accent-dark))]";
const MESSAGE_CONTENT = "min-w-0 max-w-[min(84%,640px)]";
const MESSAGE_AUTHOR =
  "mt-px mb-[7px] text-[10px] font-[weight:650] text-muted";
const BUBBLE_BASE =
  "text-xs leading-[1.75] [overflow-wrap:anywhere] whitespace-pre-wrap";
const BUBBLE_ASSISTANT = "text-foreground whitespace-normal";
const BUBBLE_USER =
  "rounded-[17px_17px_5px_17px] border border-[rgba(84,157,236,0.22)] px-[15px] py-[11px] text-foreground bg-[linear-gradient(140deg,rgba(205,229,255,0.92),rgba(226,239,255,0.95))] [&_[data-file-card]]:mt-2 [&_[data-file-card]]:block";

export function MessageList({
  messages,
  loading,
  bottomRef,
}: {
  messages: Msg[];
  loading: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={MESSAGE_LIST}>
      {messages.map((message, index) => (
        <article
          className={`${MESSAGE_ROW} ${message.role === "user" ? "justify-end" : ""}`}
          key={index}
        >
          {message.role === "assistant" && (
            <span className={ASSISTANT_AVATAR}>
              <Icon name="spark" size={16} />
            </span>
          )}
          <div className={MESSAGE_CONTENT}>
            {message.role === "assistant" && (
              <p className={MESSAGE_AUTHOR}>Nimbot</p>
            )}
            <div
              className={`${BUBBLE_BASE} ${message.role === "assistant" ? BUBBLE_ASSISTANT : BUBBLE_USER}`}
            >
              {message.role === "assistant" && message.content ? (
                <MarkdownMessage content={message.content} />
              ) : message.role === "user" ? (
                <UserMessage content={message.content} />
              ) : loading && index === messages.length - 1 ? (
                <TypingIndicator label="Nimbot is typing" />
              ) : null}
            </div>
          </div>
        </article>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
