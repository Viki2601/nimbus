"use client";
import type { CSSProperties } from "react";
import { Icon } from "./icon";

/* Class strings kept identical to the original plain-CSS values. */
const CHAT_MENU =
  "fixed z-[60] min-w-[178px] rounded-xl border border-line bg-surface-strong p-[5px] shadow-card backdrop-blur-[20px] animate-[rise-in_140ms_ease_both]";
const MENU_BUTTON =
  "flex w-full cursor-pointer items-center gap-[9px] rounded-lg border-none bg-transparent px-[10px] py-2 text-left text-[11.5px] text-foreground transition-[background] duration-[120ms] disabled:cursor-not-allowed disabled:text-muted disabled:opacity-[0.55]";
const MENU_BUTTON_HOVER = "hover:enabled:bg-[rgba(64,121,191,0.14)]";
const MENU_DIVIDER = "mx-[6px] my-1 h-px bg-line";

type ChatMenuProps = {
  style: CSSProperties;
  pinned: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onTogglePin: () => void;
  onStartRename: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

export function ChatMenu({
  style,
  pinned,
  canMoveUp,
  canMoveDown,
  onTogglePin,
  onStartRename,
  onMoveUp,
  onMoveDown,
  onDelete,
}: ChatMenuProps) {
  return (
    <div
      className={CHAT_MENU}
      data-chat-menu=""
      role="menu"
      style={style}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        role="menuitem"
        className={`${MENU_BUTTON} ${MENU_BUTTON_HOVER}`}
        onClick={onTogglePin}
      >
        <Icon name={pinned ? "unpin" : "pin"} size={15} />
        {pinned ? "Unpin chat" : "Pin chat"}
      </button>
      <button
        role="menuitem"
        className={`${MENU_BUTTON} ${MENU_BUTTON_HOVER}`}
        onClick={onStartRename}
      >
        <Icon name="pencil" size={15} />
        Rename
      </button>
      <div className={MENU_DIVIDER} />
      <button
        role="menuitem"
        className={`${MENU_BUTTON} ${MENU_BUTTON_HOVER}`}
        onClick={onMoveUp}
        disabled={!canMoveUp}
      >
        <Icon name="arrow-up" size={15} />
        Move up
      </button>
      <button
        role="menuitem"
        className={`${MENU_BUTTON} ${MENU_BUTTON_HOVER}`}
        onClick={onMoveDown}
        disabled={!canMoveDown}
      >
        <Icon name="arrow-down" size={15} />
        Move down
      </button>
      <div className={MENU_DIVIDER} />
      <button
        role="menuitem"
        className={`${MENU_BUTTON} text-[#b34747] hover:bg-[rgba(179,71,71,0.12)]`}
        onClick={onDelete}
      >
        <Icon name="trash" size={15} />
        Delete
      </button>
    </div>
  );
}
