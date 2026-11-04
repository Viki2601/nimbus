import { auth } from "@/../auth";
import { conversationsCollection } from "@/lib/user-data";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const conversation = await conversationsCollection().findOne({
      conversationId: id,
      userId,
    });

    if (!conversation) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }

    return Response.json(
      {
        id: conversation.conversationId,
        title: conversation.title ||
          conversation.messages.find((message) => message.role === "user")?.content.replace(/\s+/g, " ").trim().slice(0, 60) ||
          "New chat",
        titleGenerated: conversation.titleGenerated === true,
        messages: conversation.messages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Could not load the requested conversation.", error);
    return Response.json({ error: "Conversation could not be loaded." }, { status: 503 });
  }
}

/**
 * Rename / pin / move a conversation.
 * Body is one of:
 *   { title: string }                    -> rename
 *   { pinned: boolean }                  -> pin or unpin
 *   { move: "up" | "down" }              -> move within its pinned group
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { title, pinned, move } = body as {
    title?: unknown;
    pinned?: unknown;
    move?: unknown;
  };

  const collection = conversationsCollection();

  try {
    const conversation = await collection.findOne({ conversationId: id, userId });
    if (!conversation) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }

    // --- Rename ---
    if (typeof title === "string") {
      const nextTitle = title.replace(/\s+/g, " ").trim().slice(0, 80);
      if (!nextTitle) {
        return Response.json({ error: "A title is required." }, { status: 400 });
      }
      await collection.updateOne(
        { conversationId: id, userId },
        // Mark as manually titled so auto-title generation never overwrites it.
        { $set: { title: nextTitle, titleGenerated: true } },
      );
      return Response.json({ title: nextTitle, titleGenerated: true });
    }

    // --- Pin / unpin ---
    if (typeof pinned === "boolean") {
      await collection.updateOne(
        { conversationId: id, userId },
        {
          $set: {
            pinned,
            // Float to the top of its (new) group when pinned/unpinned.
            order: Date.now(),
            updatedAt: new Date(),
          },
        },
      );
      return Response.json({ pinned });
    }

    // --- Move up / down within the same pinned group ---
    if (move === "up" || move === "down") {
      const group = await collection
        .find({ userId, pinned: conversation.pinned === true })
        .sort({ order: -1 })
        .project({ conversationId: 1, order: 1 })
        .toArray();

      const index = group.findIndex((item) => item.conversationId === id);
      const targetIndex = move === "up" ? index - 1 : index + 1;

      if (index === -1 || targetIndex < 0 || targetIndex >= group.length) {
        // Already at the edge of its group — nothing to do.
        return Response.json({ moved: false });
      }

      const neighbor = group[targetIndex];
      // Swap order values so the two chats trade places.
      const myOrder = conversation.order ?? 0;
      const neighborOrder = neighbor.order ?? 0;
      await collection.updateOne(
        { conversationId: id, userId },
        { $set: { order: neighborOrder } },
      );
      await collection.updateOne(
        { conversationId: neighbor.conversationId, userId },
        { $set: { order: myOrder } },
      );
      return Response.json({ moved: true });
    }

    return Response.json({ error: "Unsupported update." }, { status: 400 });
  } catch (error) {
    console.error("Could not update the conversation.", error);
    return Response.json({ error: "Conversation could not be updated." }, { status: 503 });
  }
}

/** Delete a conversation permanently. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const result = await conversationsCollection().deleteOne({ conversationId: id, userId });
    if (result.deletedCount === 0) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("Could not delete the conversation.", error);
    return Response.json({ error: "Conversation could not be deleted." }, { status: 503 });
  }
}
