import type { Collection } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ConversationDocument = {
  conversationId: string;
  userId: string;
  title: string;
  titleGenerated?: boolean;
  messages: ChatMessage[];
  /** Denormalized count kept in sync by the chat API. Used by the list API to avoid loading messages. */
  messageCount: number;
  /** Whether the chat is pinned. Pinned chats are always listed before unpinned ones. */
  pinned?: boolean;
  /** Manual sort key, descending (bigger = higher in the list). Set on create and re-indexed on pin/move. */
  order?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type UserSettings = {
  userId: string;
  profile?: {
    fullName?: string;
    preferredName?: string;
    occupation?: string;
    instructions?: string;
    avatar?: string | null;
  };
  preferences: {
    appearance: "light";
    compactMode: boolean;
    notifications: boolean;
    language: string;
  };
  updatedAt: Date;
};

export function conversationsCollection(): Collection<ConversationDocument> {
  return getDatabase().collection<ConversationDocument>("conversations");
}

export function settingsCollection(): Collection<UserSettings> {
  return getDatabase().collection<UserSettings>("settings");
}