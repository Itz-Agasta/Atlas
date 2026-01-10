import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, UIMessage } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    // Check if API key is available
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Groq API key is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = streamText({
      model: groq("openai/gpt-oss-20b"),
      messages: convertToModelMessages(messages),
      system:
        "You are Ocean Data Assistant, an AI assistant that helps users find information about oceanographic data, Argo floats, and related topics. Provide accurate and concise answers based on the user's questions. If you don't know the answer, it's okay to say you don't know. Always speak in english.",
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
