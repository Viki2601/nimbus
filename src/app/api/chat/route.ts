import { buildSystemPrompt } from "@/lib/systemPrompt";
import { normalizeFileBlocks } from "@/lib/file-blocks";
import { createOpenRouterClient, OPENROUTER_MODEL } from "@/lib/openrouter";
import { auth } from "@/../auth";
import {
  conversationsCollection,
  settingsCollection,
  type ChatMessage,
  type UserSettings,
} from "@/lib/user-data";

const MAX_MESSAGE_CHARS = 90_000;
const MAX_HISTORY = 20;
const MAX_HISTORY_CHARS = 48_000;
const MAX_STORED_MESSAGES = 100;
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Authentication required", { status: 401 });
  }
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return new Response(
      "OpenRouter is not configured. Set OPENROUTER_API_KEY and try again.",
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("messages" in body) ||
    !("conversationId" in body) ||
    typeof body.conversationId !== "string" ||
    !body.conversationId ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > MAX_STORED_MESSAGES
  ) {
    return new Response("A valid messages list is required.", { status: 400 });
  }

  const messages: ChatMessage[] = [];
  for (const value of body.messages) {
    if (
      typeof value !== "object" ||
      value === null ||
      !("role" in value) ||
      !("content" in value) ||
      (value.role !== "user" && value.role !== "assistant") ||
      typeof value.content !== "string" ||
      value.content.length > MAX_MESSAGE_CHARS
    ) {
      return new Response("Invalid message in chat history.", { status: 400 });
    }

    messages.push({ role: value.role, content: value.content });
  }

  if (messages[messages.length - 1]?.role !== "user") {
    return new Response("The latest message must be from the user.", {
      status: 400,
    });
  }

  const conversationId = body.conversationId;
  let profile: UserSettings["profile"];
  try {
    const collection = conversationsCollection();
    const existing = await collection.findOne({ conversationId, userId });
    if (!existing) {
      return new Response("Conversation not found.", { status: 404 });
    }

    const isContinuation =
      messages.length > existing.messages.length &&
      existing.messages.every(
        (message, index) =>
          message.role === messages[index]?.role &&
          message.content === messages[index]?.content,
      );
    if (!isContinuation) {
      return new Response(
        "Conversation history is out of date. Reload the conversation and try again.",
        {
          status: 409,
        },
      );
    }

    profile = (await settingsCollection().findOne({ userId }))?.profile;
    const now = new Date();

    await collection.updateOne(
      { conversationId, userId },
      { $set: { messages, messageCount: messages.length, updatedAt: now } },
    );
  } catch (error) {
    console.error("Could not save the authenticated chat.", error);
    return new Response(
      "Chat storage is unavailable. Please try again later.",
      {
        status: 503,
      },
    );
  }

  const recent = messages.slice(-MAX_HISTORY);
  const history: { role: "user" | "assistant"; content: string }[] = [];
  let used = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const { role, content } = recent[i];
    const isLatest = i === recent.length - 1;
    if (used + content.length > MAX_HISTORY_CHARS) {
      if (!isLatest) break;
      history.unshift({ role, content: content.slice(0, MAX_HISTORY_CHARS) });
      break;
    }
    history.unshift({ role, content });
    used += content.length;
  }

  let stream;
  try {
    const client = createOpenRouterClient();
    stream = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      stream: true,
      temperature: 0.3,
      messages: [{ role: "system", content: buildSystemPrompt(profile) }, ...history],
    });
  } catch (err: unknown) {
    const status =
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      typeof err.status === "number"
        ? err.status
        : undefined;

    if (status === 404) {
      return new Response(
        "OpenRouter's free model router is unavailable. Try again later.",
        { status: 404 },
      );
    }
    if (status === 429) {
      return new Response(
        "OpenRouter's free model limit may have been reached. Try again later.",
        { status: 429 },
      );
    }
    if (status === 401 || status === 403) {
      return new Response(
        "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in your deployment settings.",
        { status: 503 },
      );
    }
    if (status === undefined) {
      return new Response(
        "Could not connect to OpenRouter. Check your server configuration and try again.",
        { status: 503 },
      );
    }

    console.error("OpenRouter chat completion request failed.", { status });
    return new Response(
      "OpenRouter could not complete the request. Please try again.",
      { status },
    );
  }

  // Collect the full model reply first so it can be normalized into real file
  // fences before it is streamed to the browser and persisted.
  let rawReply = "";
  try {
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) rawReply += text;
    }
  } catch (error) {
    console.error("OpenRouter response stream failed.", error);
    return new Response(
      "OpenRouter stopped responding part-way through the reply. Try again.",
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  // Turn any `file=Name.ext` marker the model emitted into a real file fence,
  // both for the live stream and the copy we persist, so the download card
  // renders even when the model ignores the fence syntax.
  const reply = normalizeFileBlocks(rawReply);
  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(reply));
        const finalMessages = [
          ...messages,
          { role: "assistant" as const, content: reply },
        ];
        const collection = conversationsCollection();
        await collection.updateOne(
          { conversationId, userId },
          {
            $set: {
              messages: finalMessages,
              messageCount: finalMessages.length,
              updatedAt: new Date(),
            },
          },
        );
      } catch (error) {
        console.error("Could not persist the assistant reply.", error);
        controller.error(error);
        return;
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
