import { auth } from "@/../auth";
import { conversationsCollection, type ConversationDocument } from "@/lib/user-data";
import { ensureIndexes } from "@/lib/mongodb";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    await ensureIndexes();

    // Housekeeping: conversations are only created at the moment the first
    // message is sent, so anything still empty is an abandoned leftover from
    // an older flow. Remove empty rows, but only ones older than an hour so
    // we never race with a message that is mid-send. The $or also catches
    // legacy docs that predate the `messageCount` field.
    await conversationsCollection().deleteMany({
      userId,
      $or: [{ messageCount: 0 }, { messageCount: { $exists: false }, "messages.0": { $exists: false } }],
      updatedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    // Backfill: conversations saved before pinned/order existed get an order
    // derived from their recency so they keep a sensible position.
    await conversationsCollection().updateMany(
      { userId, order: { $exists: false } },
      [{ $set: { order: { $toLong: "$updatedAt" }, pinned: { $ifNull: ["$pinned", false] } } }],
    );

    // Fetch metadata only — no messages array to keep the payload small.
    // We also fetch the most-recent conversation's messages inline so the
    // client can display it without a second round-trip.
    const conversations = await conversationsCollection()
      .find({
        userId,
        $or: [{ messageCount: { $gt: 0 } }, { messageCount: { $exists: false }, "messages.0": { $exists: true } }],
      })
      .sort({ pinned: -1, order: -1 })
      .project({
        conversationId: 1,
        title: 1,
        titleGenerated: 1,
        messageCount: 1,
        pinned: 1,
        // Include messages only for the very first result (we limit to 1
        // separately below, so this projection is harmless for the rest).
        messages: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .toArray();

    // The first conversation gets its messages inlined so the client can skip
    // an extra GET /api/conversations/:id on mount.
    const mapped = conversations.map(
      ({ conversationId, title, titleGenerated, messageCount, pinned, messages, createdAt, updatedAt }, index) => {
        const hasMessages =
          typeof messageCount === "number" ? messageCount > 0 : (messages?.length ?? 0) > 0;
        const base = {
          id: conversationId,
          title:
            title ||
            messages?.find((m) => m.role === "user")?.content.slice(0, 60) ||
            "New chat",
          titleGenerated: titleGenerated === true,
          hasMessages,
          pinned: pinned === true,
          createdAt,
          updatedAt,
        };
        if (index === 0 && messages) {
          return { ...base, initialMessages: messages };
        }
        return base;
      },
    );

    return Response.json(mapped, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Could not load saved conversations.", error);
    return Response.json(
      { error: "Saved conversations are unavailable." },
      { status: 503 },
    );
  }
}

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const now = new Date();
  const conversation: ConversationDocument = {
    conversationId: crypto.randomUUID(),
    userId,
    title: "New chat",
    titleGenerated: false,
    messages: [],
    messageCount: 0,
    pinned: false,
    // Newest chats float to the top of the unpinned group.
    order: now.getTime(),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await ensureIndexes();
    await conversationsCollection().insertOne(conversation);
    return Response.json(
      { id: conversation.conversationId, title: conversation.title },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Could not create a new conversation.", error);
    return Response.json(
      { error: "A new conversation could not be created." },
      { status: 503 },
    );
  }
}
