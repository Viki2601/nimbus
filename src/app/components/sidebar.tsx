"use client";
import type { RefObject } from "react";
import { Icon } from "./icon";
import SidebarProfile from "../profile/sidebar-profile";
import type { ConversationSummary } from "./types";

/* Class strings kept identical to the original plain-CSS values. */
const SIDEBAR_BASE =
  "relative z-20 flex w-[270px] min-w-[270px] flex-col border-r border-line bg-sidebar px-[15px] pt-[22px] pb-[15px] backdrop-blur-[26px] [@media(max-width:720px)]:fixed [@media(max-width:720px)]:inset-y-0 [@media(max-width:720px)]:left-0 [@media(max-width:720px)]:w-[min(290px,calc(100vw_-_54px))] [@media(max-width:720px)]:min-w-0 [@media(max-width:720px)]:shadow-[12px_0_40px_rgba(47,80,122,0.16)] [@media(max-width:720px)]:transition-transform [@media(max-width:720px)]:duration-200 [@media(max-width:720px)]:ease-[ease]";
const SIDEBAR_TOP = "flex items-center justify-between px-[7px]";
const BRAND =
  "flex items-center gap-[10px] font-[family-name:var(--font-display)] text-[18px] font-[weight:800] tracking-[4px] text-foreground uppercase no-underline";
const EMBLEM =
  "grid flex-none place-items-center text-white shadow-[0_8px_26px_rgba(48,137,231,0.24)] bg-[linear-gradient(145deg,var(--accent-bright),var(--accent-dark))]";
const BRAND_MARK = `${EMBLEM} h-[34px] w-[34px] rounded-[12px]`;
const SIDEBAR_CLOSE =
  "hidden h-[34px] w-[34px] cursor-pointer place-items-center rounded-[9px] border-0 bg-transparent text-muted hover:bg-[rgba(96,142,198,0.12)] [@media(max-width:720px)]:grid";
const NEW_CHAT_BUTTON =
  "mt-[30px] flex h-[43px] w-full cursor-pointer items-center gap-[10px] rounded-xl border border-line bg-surface px-[12px] text-left text-[12px] font-[weight:560] transition-[background,border-color,transform] duration-150 ease hover:-translate-y-px hover:border-[rgba(91,160,241,0.45)] hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60";
const SHORTCUT = "ml-auto text-[10px] text-muted";
const SIDEBAR_SECTION =
  "mt-[31px] flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden";
const SIDEBAR_LABEL =
  "mx-[9px] mb-[10px] mt-0 text-[9px] font-bold tracking-[1.4px] text-muted";
const HISTORY_LIST =
  "grid min-h-0 w-full min-w-0 flex-1 content-start gap-1 max-h-[min(65vh,500px)] overflow-x-hidden overflow-y-auto [grid-auto-rows:min-content] [scrollbar-color:rgba(106,142,184,0.35)_transparent] [scrollbar-width:thin]";
const HISTORY_STATUS = "mx-[9px] my-1 text-[10px] leading-[1.5] text-muted";
const HISTORY_ERROR = "mx-[9px] my-1 text-[10px] leading-[1.5] text-[#a64b4b]";
const HISTORY_ITEM_BASE =
  "group relative flex min-h-[33px] w-full min-w-0 items-center gap-[2px] rounded-[10px] border border-transparent pr-1 text-left text-[11px] text-foreground transition-[border-color,background] duration-150 ease";
const HISTORY_ITEM_HOVER = "hover:border-line hover:bg-surface-hover";
const HISTORY_ITEM_ACTIVE =
  "border-[rgba(40,127,223,0.1)] bg-[rgba(64,121,191,0.12)]";
const HISTORY_ITEM_SWITCHING =
  "border-[rgba(40,127,223,0.18)] bg-[rgba(64,121,191,0.09)] animate-[pulse-opacity_1s_ease-in-out_infinite]";
const HISTORY_OPEN =
  "flex min-w-0 flex-1 cursor-pointer items-center gap-[10px] border-none bg-transparent px-[6px] text-left text-[11px] text-inherit disabled:cursor-wait disabled:opacity-65";
const HISTORY_SPAN =
  "inline-flex min-w-0 flex-1 items-center gap-[5px] overflow-hidden text-ellipsis whitespace-nowrap [&_svg]:flex-none [&_svg]:text-accent-bright";
const RENAME_INPUT =
  "w-full min-w-0 rounded-[6px] border border-accent bg-surface-strong px-[6px] py-[3px] text-[11px] text-foreground focus:shadow-[0_0_0_2px_rgba(40,127,223,0.25)] focus:outline-none";
const MENU_TRIGGER_BASE =
  "grid h-[26px] w-[26px] flex-none cursor-pointer place-items-center rounded-[7px] border-none bg-transparent p-0 text-muted transition-[opacity,background,color] duration-[120ms] hover:bg-[rgba(64,121,191,0.16)] hover:text-foreground";
const SIDEBAR_BOTTOM = "mt-auto";

type SidebarProps = {
  sidebarOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  loading: boolean;
  historyLoading: boolean;
  historyError: string;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  switchingId: string | null;
  openMenuId: string | null;
  renamingId: string | null;
  renameDraft: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  onOpenConversation: (id: string) => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onTriggerMenu: (id: string, rect: DOMRect) => void;
};

export function Sidebar({
  sidebarOpen,
  onClose,
  onNewChat,
  loading,
  historyLoading,
  historyError,
  conversations,
  activeConversationId,
  switchingId,
  openMenuId,
  renamingId,
  renameDraft,
  renameInputRef,
  onOpenConversation,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onTriggerMenu,
}: SidebarProps) {
  return (
    <aside
      className={`${SIDEBAR_BASE} ${sidebarOpen ? "[@media(max-width:720px)]:translate-x-0" : "[@media(max-width:720px)]:-translate-x-full"}`}
    >
      <div className={SIDEBAR_TOP}>
        <a
          className={BRAND}
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onNewChat();
          }}
        >
          <span className={BRAND_MARK}>
            <Icon name="spark" size={20} />
          </span>
          <span>Nimbot</span>
        </a>
        <button
          className={SIDEBAR_CLOSE}
          aria-label="Close menu"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>

      <button
        className={NEW_CHAT_BUTTON}
        onClick={onNewChat}
        disabled={loading || historyLoading}
      >
        <Icon name="plus" size={17} />
        <span>New chat</span>
        <span className={SHORTCUT}>⌘ K</span>
      </button>

      <div className={SIDEBAR_SECTION}>
        <p className={SIDEBAR_LABEL}>Chats</p>
        <div className={HISTORY_LIST}>
          {historyLoading ? (
            <p className={HISTORY_STATUS}>Loading chats...</p>
          ) : conversations.length ? (
            conversations.map((conversation) => {
              const isRenaming = renamingId === conversation.id;
              const isActive = conversation.id === activeConversationId;
              const isSwitching = switchingId === conversation.id;
              const isExpanded = openMenuId === conversation.id;
              return (
                <div
                  className={`${HISTORY_ITEM_BASE} ${isActive ? HISTORY_ITEM_ACTIVE : ""} ${isSwitching ? HISTORY_ITEM_SWITCHING : ""} ${!isActive && !isSwitching ? HISTORY_ITEM_HOVER : ""}`}
                  key={conversation.id}
                >
                  <button
                    className={HISTORY_OPEN}
                    onClick={() => {
                      if (!isRenaming) onOpenConversation(conversation.id);
                    }}
                    disabled={loading}
                    title={conversation.title}
                  >
                    <Icon name="message" size={16} />
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        className={RENAME_INPUT}
                        value={renameDraft}
                        onChange={(event) =>
                          onRenameDraftChange(event.target.value)
                        }
                        onClick={(event) => event.stopPropagation()}
                        onBlur={onCommitRename}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            onCommitRename();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            onCancelRename();
                          }
                        }}
                        maxLength={80}
                        aria-label="Rename chat"
                      />
                    ) : (
                      <span className={HISTORY_SPAN}>
                        {conversation.pinned && <Icon name="pin" size={12} />}
                        {conversation.title}
                      </span>
                    )}
                  </button>
                  {!isRenaming && (
                    <button
                      className={`${MENU_TRIGGER_BASE} ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
                      data-chat-menu-trigger=""
                      aria-label={`Options for ${conversation.title}`}
                      aria-haspopup="menu"
                      aria-expanded={isExpanded}
                      onClick={(event) =>
                        onTriggerMenu(
                          conversation.id,
                          event.currentTarget.getBoundingClientRect(),
                        )
                      }
                    >
                      <Icon name="dots" size={16} />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className={HISTORY_STATUS}>
              {historyError || "Your chats will appear here."}
            </p>
          )}
        </div>
        {historyError && conversations.length > 0 && (
          <p className={HISTORY_ERROR}>{historyError}</p>
        )}
      </div>

      <div className={SIDEBAR_BOTTOM}>
        <SidebarProfile />
      </div>
    </aside>
  );
}
