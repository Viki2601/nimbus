import { auth } from "@/../auth";
import { conversationsCollection } from "@/lib/user-data";
import { createOpenRouterClient, OPENROUTER_MODEL } from "@/lib/openrouter";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "OpenRouter is not configured. Set OPENROUTER_API_KEY and try again.",
      },
      { status: 503 },
    );
  }

  const { id } = await params;
  try {
    const collection = conversationsCollection();
    const conversation = await collection.findOne({
      conversationId: id,
      userId,
    });

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    if (conversation.titleGenerated) {
      return Response.json({ title: conversation.title });
    }

    const userMessages = conversation.messages
      .filter((message) => message.role === "user")
      .slice(0, 4)
      .map((message) => message.content.slice(0, 2_000)); // attachments can be huge

    if (
      userMessages.length === 0 ||
      !conversation.messages.some((message) => message.role === "assistant")
    ) {
      return Response.json(
        {
          error:
            "The conversation needs a completed reply before it can be titled.",
        },
        { status: 409 },
      );
    }

    const client = createOpenRouterClient();
    const response = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      temperature: 0.2,
      max_tokens: 32,
      messages: [
        {
          role: "system",
          content:
            "Create a concise overview title for this support chat, like a conversation title in a chat app. Summarize the topic or user goal in 3 to 7 words. Do not answer the user, repeat their full message, or add quotes, punctuation, or a label. Return only the title.",
        },
        { role: "user", content: userMessages.join("\n") },
      ],
    });

    const title = response.choices[0]?.message.content
      ?.replace(/^["'\s]+|["'\s]+$/g, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);

    if (!title) {
      console.error("OpenRouter returned an empty conversation title.", {
        conversationId: id,
      });
      return Response.json(
        { error: "A conversation overview could not be generated." },
        { status: 503 },
      );
    }

    await collection.updateOne(
      { conversationId: id, userId, titleGenerated: { $ne: true } },
      { $set: { title, titleGenerated: true } },
    );

    return Response.json({ title });
  } catch (error) {
    console.error("Could not generate the conversation overview.", error);
    return Response.json(
      { error: "A conversation overview could not be generated." },
      { status: 503 },
    );
  }
}
