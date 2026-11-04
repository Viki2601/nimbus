"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./components/sidebar";
import { WelcomeScreen } from "./components/welcome-screen";
import { MessageList, type Msg } from "./components/message-list";
import { Composer } from "./components/composer";
import { ChatMenu } from "./components/chat-menu";
import {
  toAttachment,
  composeMessage,
  fileToAttachment,
  MAX_ATTACH_FILES,
  type Attachment,
} from "./components/attachments";
import type { ConversationSummary } from "./components/types";

/* Layout class strings (kept identical to the original plain-CSS values). */
const APP_SHELL =
  "relative flex h-dvh w-full min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_76%_34%,rgba(73,139,212,0.09),transparent_32%),var(--background)]";
const SIDEBAR_BACKDROP =
  "hidden border-0 bg-[rgba(34,57,86,0.3)] backdrop-blur-[3px] fixed z-[19] inset-0 [@media(max-width:720px)]:block";
const CHAT_PANEL =
  "relative flex min-w-0 flex-1 flex-col isolate before:pointer-events-none before:absolute before:z-[-1] before:inset-0 before:content-[''] before:bg-[radial-gradient(ellipse_at_50%_45%,rgba(76,142,216,0.10),transparent_55%),radial-gradient(ellipse_at_90%_90%,rgba(59,114,185,0.08),transparent_42%)]";
const CONVERSATION =
  "flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-color:rgba(106,142,184,0.35)_transparent] [scrollbar-width:thin]";

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState("");
  /**
   * ID of the conversation currently being fetched when switching.
   * Unlike `loading`, this does NOT lock the sidebar or the send button —
   * it only shows a spinner in the chat area while the switch is in flight.
   */
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  /** Which chat's context menu is open (by conversation id), plus its viewport anchor. */
  const [menuFor, setMenuFor] = useState<{
    id: string;
    right: number;
    top: number;
    bottom: number;
    flip: boolean;
  } | null>(null);
  /** Conversation id currently being renamed inline, and its draft text. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectionRequestRef = useRef(0);
  const pasteCountRef = useRef(0);
  const renameInputRef = useRef<HTMLInputElement>(null);
  /** Guards against Enter + blur both firing a rename commit. */
  const renameCommittedRef = useRef(false);

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    const attachment = toAttachment(text, pasteCountRef.current + 1);
    if (!attachment) return; // short/plain paste: let the browser handle it
    event.preventDefault();
    pasteCountRef.current += 1;
    setAttachments((current) => [...current, attachment]);
  }

  /** Read picked/dropped files into attachments (binaries go via the extract route). */
  async function handleAttachFiles(files: File[]) {
    if (files.length === 0) return;
    setAttachError("");
    const room = MAX_ATTACH_FILES - attachments.length;
    if (room <= 0) {
      setAttachError(`You can attach up to ${MAX_ATTACH_FILES} files.`);
      return;
    }
    const batch = files.slice(0, room);
    if (batch.length < files.length)
      setAttachError(`Only the first ${batch.length} file(s) were attached.`);
    setAttaching(true);
    try {
      for (const file of batch) {
        const result = await fileToAttachment(file);
        if (result.attachment) {
          setAttachments((current) => [...current, result.attachment!]);
        } else if (result.error) {
          setAttachError(result.error);
        }
      }
    } finally {
      setAttaching(false);
      inputRef.current?.focus();
    }
  }

  const startNewChat = useCallback(() => {
    if (loading) return;
    setHistoryError("");

    // Start a fresh chat purely locally — nothing is persisted until the
    // first message is sent (see `send`). This stops empty "New chat" rows
    // from piling up in the sidebar when a chat is opened and abandoned.
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setAttachError("");
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, [loading]);

  async function generateConversationTitle(conversationId: string) {
    const response = await fetch(
      `/api/conversations/${encodeURIComponent(conversationId)}/title`,
      { method: "POST" },
    );
    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as { title: string };
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title: result.title, titleGenerated: true }
          : conversation,
      ),
    );
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const response = await fetch("/api/conversations", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await response.text());
        // The list API inlines `initialMessages` on the first conversation
        // so we can skip a second round-trip.
        const raw: (ConversationSummary & { initialMessages?: Msg[] })[] =
          await response.json();
        if (!active) return;

        // Only surface conversations that actually have messages. Any empty
        // "New chat" rows (created before this fix) are hidden here.
        const withMessages = raw.filter(
          (conversation) => conversation.hasMessages,
        );
        const savedConversations: ConversationSummary[] = withMessages.map(
          ({ initialMessages: _omit, ...rest }) => rest,
        );
        setConversations(savedConversations);

        // Load the most-recent conversation's messages from the inline payload.
        const first = withMessages[0];
        if (first) {
          setActiveConversationId(first.id);
          setMessages(first.initialMessages ?? []);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }

        // Generate any missing titles in parallel — cosmetic, never blocks load.
        void Promise.allSettled(
          savedConversations
            .filter((c) => c.hasMessages && !c.titleGenerated)
            .map((c) =>
              generateConversationTitle(c.id).catch((error) => {
                console.error(
                  "Could not update a saved conversation overview.",
                  error,
                );
                if (active)
                  setHistoryError(
                    "Some conversation overviews could not be generated.",
                  );
              }),
            ),
        );
      } catch (error) {
        console.error("Could not load conversation history.", error);
        if (active)
          setHistoryError("Conversation history could not be loaded.");
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!loading) {
          void startNewChat();
        }
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [loading, startNewChat]);

  async function send(text: string) {
    const content = composeMessage(text, attachments);
    if (!content || loading || historyLoading) return;

    setInput("");
    setAttachments([]);
    setAttachError("");
    setLoading(true);
    if (inputRef.current) inputRef.current.style.height = "auto";

    let next: Msg[] = [...messages, { role: "user", content }];
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const createResponse = await fetch("/api/conversations", {
          method: "POST",
        });
        if (!createResponse.ok) throw new Error(await createResponse.text());
        const created = (await createResponse.json()) as {
          id: string;
          title: string;
        };
        conversationId = created.id;
        setActiveConversationId(conversationId);
        setConversations((current) => [
          {
            id: created.id,
            title: created.title,
            titleGenerated: false,
            hasMessages: false,
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...current,
        ]);
      }

      next = [...messages, { role: "user", content }];
      setMessages([...next, { role: "assistant", content: "" }]);
      setConversations((current) => {
        const existing = current.find(
          (conversation) => conversation.id === conversationId,
        );
        const updated: ConversationSummary = {
          id: conversationId,
          title: existing?.title || "New chat",
          titleGenerated: existing?.titleGenerated ?? false,
          hasMessages: true,
          pinned: existing?.pinned ?? false,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const rest = current.filter(
          (conversation) => conversation.id !== conversationId,
        );
        // Keep pinned chats on top; the active chat floats to the top of its group.
        if (updated.pinned) return [updated, ...rest];
        const pinnedCount = rest.filter(
          (conversation) => conversation.pinned,
        ).length;
        return [
          ...rest.slice(0, pinnedCount),
          updated,
          ...rest.slice(pinnedCount),
        ];
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: reply }]);
      }
      setMessages([...next, { role: "assistant", content: reply }]);
      const currentConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      if (!currentConversation?.titleGenerated) {
        try {
          await generateConversationTitle(conversationId);
        } catch (error) {
          console.error("Could not generate the conversation overview.", error);
          setHistoryError(
            "The conversation was saved, but its overview could not be generated.",
          );
        }
      }
    } catch (error) {
      console.error("Could not send chat message.", error);
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            error instanceof Error && error.message
              ? error.message
              : "Sorry, something went wrong. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function openConversation(conversationId: string) {
    // Already open — do nothing.
    if (conversationId === activeConversationId) return;
    // Already fetching this exact conversation.
    if (switchingId === conversationId) return;
    // Don't allow switching while a message is being sent.
    if (loading || historyLoading) return;

    const requestId = ++selectionRequestRef.current;
    // Show a per-chat loading indicator WITHOUT locking the rest of the UI.
    setSwitchingId(conversationId);
    setHistoryError("");

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await response.text());
      const conversation = (await response.json()) as {
        messages: Msg[];
        title: string;
        titleGenerated: boolean;
        updatedAt: string;
      };
      if (requestId !== selectionRequestRef.current) return;
      setMessages(conversation.messages);
      setActiveConversationId(conversationId);
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                title: conversation.title,
                titleGenerated: conversation.titleGenerated,
                hasMessages: conversation.messages.length > 0,
                updatedAt: conversation.updatedAt,
              }
            : item,
        ),
      );
      setInput("");
      setSidebarOpen(false);
    } catch (error) {
      console.error("Could not open conversation.", error);
      if (requestId === selectionRequestRef.current) {
        setHistoryError("That conversation could not be opened.");
      }
    } finally {
      if (requestId === selectionRequestRef.current) setSwitchingId(null);
    }
  }

  // Close the chat context menu on outside click or Escape.
  useEffect(() => {
    if (!menuFor) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (
        !target.closest("[data-chat-menu]") &&
        !target.closest("[data-chat-menu-trigger]")
      )
        setMenuFor(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuFor(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuFor]);

  // Focus the rename field as soon as one opens, and re-arm the commit guard.
  useEffect(() => {
    if (renamingId) {
      renameCommittedRef.current = false;
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  /** Optimistically reorder/pin the local list, then reconcile with the server. */
  async function patchConversation(
    id: string,
    body: Record<string, unknown>,
    errorMessage: string,
  ) {
    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error(await response.text());
      await refreshConversations();
    } catch (error) {
      console.error(errorMessage, error);
      setHistoryError(errorMessage);
    }
  }

  /** Re-fetch the ordered conversation list without disturbing the open chat. */
  async function refreshConversations() {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const raw = (await response.json()) as (ConversationSummary & {
      initialMessages?: Msg[];
    })[];
    setConversations(
      raw
        .filter((c) => c.hasMessages)
        .map(({ initialMessages: _omit, ...rest }) => rest),
    );
  }

  function togglePin(conversation: ConversationSummary) {
    setMenuFor(null);
    void patchConversation(
      conversation.id,
      { pinned: !conversation.pinned },
      "That chat could not be updated.",
    );
  }

  function startRename(conversation: ConversationSummary) {
    setMenuFor(null);
    setRenameDraft(conversation.title);
    setRenamingId(conversation.id);
  }

  function commitRename() {
    if (!renamingId || renameCommittedRef.current) return;
    renameCommittedRef.current = true;
    const trimmed = renameDraft.replace(/\s+/g, " ").trim();
    const original =
      conversations.find((c) => c.id === renamingId)?.title ?? "";
    setRenamingId(null);
    if (!trimmed || trimmed === original) return;
    void patchConversation(
      renamingId,
      { title: trimmed },
      "That chat could not be renamed.",
    );
  }

  function cancelRename() {
    renameCommittedRef.current = true;
    setRenamingId(null);
  }

  function moveConversation(
    conversation: ConversationSummary,
    direction: "up" | "down",
  ) {
    setMenuFor(null);
    // Optimistically swap in the visible list so the UI feels instant.
    setConversations((current) => {
      const index = current.findIndex((c) => c.id === conversation.id);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || target < 0 || target >= current.length)
        return current;
      // Only allow moving within the same pinned group.
      if (current[target].pinned !== conversation.pinned) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    void patchConversation(
      conversation.id,
      { move: direction },
      "That chat could not be moved.",
    );
  }

  async function deleteConversation(conversation: ConversationSummary) {
    setMenuFor(null);
    if (
      !window.confirm(`Delete "${conversation.title}"? This cannot be undone.`)
    )
      return;
    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(conversation.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(await response.text());
      setConversations((current) =>
        current.filter((c) => c.id !== conversation.id),
      );
      if (activeConversationId === conversation.id) startNewChat();
    } catch (error) {
      console.error("Could not delete that chat.", error);
      setHistoryError("That chat could not be deleted.");
    }
  }

  /** Open the context menu for a chat, anchored to its trigger button. */
  function triggerMenu(conversationId: string, rect: DOMRect) {
    const menuHeight = 254;
    const flip = rect.bottom + menuHeight > window.innerHeight;
    setMenuFor({
      id: conversationId,
      right: window.innerWidth - rect.right,
      top: rect.bottom + 4,
      bottom: window.innerHeight - rect.top + 4,
      flip,
    });
  }

  // The chat area is switching if we're loading a different conversation.
  const isSwitching = switchingId !== null;

  return (
    <main className={APP_SHELL}>
      {sidebarOpen && (
        <button
          className={SIDEBAR_BACKDROP}
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => void startNewChat()}
        loading={loading}
        historyLoading={historyLoading}
        historyError={historyError}
        conversations={conversations}
        activeConversationId={activeConversationId}
        switchingId={switchingId}
        openMenuId={menuFor?.id ?? null}
        renamingId={renamingId}
        renameDraft={renameDraft}
        renameInputRef={renameInputRef}
        onOpenConversation={(id) => void openConversation(id)}
        onRenameDraftChange={setRenameDraft}
        onCommitRename={commitRename}
        onCancelRename={cancelRename}
        onTriggerMenu={triggerMenu}
      />

      <section className={CHAT_PANEL}>
        <div className={CONVERSATION}>
          {isSwitching ? (
            <WelcomeScreen mode="loading" />
          ) : messages.length === 0 ? (
            <WelcomeScreen mode="empty" />
          ) : (
            <MessageList
              messages={messages}
              loading={loading}
              bottomRef={bottomRef}
            />
          )}
        </div>

        <Composer
          input={input}
          attachments={attachments}
          loading={loading}
          historyLoading={historyLoading}
          attaching={attaching}
          attachError={attachError}
          inputRef={inputRef}
          onInputChange={setInput}
          onPaste={handlePaste}
          onAttachFiles={(files) => void handleAttachFiles(files)}
          onRemoveAttachment={(id) =>
            setAttachments((c) => c.filter((x) => x.id !== id))
          }
          onSend={() => void send(input)}
        />
      </section>

      {menuFor &&
        (() => {
          const conversation = conversations.find((c) => c.id === menuFor.id);
          if (!conversation) return null;
          const index = conversations.findIndex(
            (c) => c.id === conversation.id,
          );
          const canMoveUp =
            index > 0 &&
            conversations[index - 1].pinned === conversation.pinned;
          const canMoveDown =
            index < conversations.length - 1 &&
            conversations[index + 1].pinned === conversation.pinned;
          return (
            <ChatMenu
              style={
                menuFor.flip
                  ? { bottom: menuFor.bottom, right: menuFor.right }
                  : { top: menuFor.top, right: menuFor.right }
              }
              pinned={conversation.pinned}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onTogglePin={() => togglePin(conversation)}
              onStartRename={() => startRename(conversation)}
              onMoveUp={() => moveConversation(conversation, "up")}
              onMoveDown={() => moveConversation(conversation, "down")}
              // eslint-disable-next-line react-hooks/refs -- delete only runs in the click handler; the ref focus is event-only.
              onDelete={() => void deleteConversation(conversation)}
            />
          );
        })()}
    </main>
  );
}
