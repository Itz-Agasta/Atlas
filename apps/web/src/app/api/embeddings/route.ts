import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json({ 
        success: false, 
        error: "Text is required" 
      }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: "Gemini API key not configured",
        suggestion: "Please add NEXT_PUBLIC_GEMINI_API_KEY to your environment variables"
      }, { status: 400 });
    }

    console.log("Generating Gemini embedding for:", text.substring(0, 50) + "...");
    
    try {
      // Use Gemini's text embedding model
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      
      const result = await model.embedContent(text);
      const embedding = result.embedding;
      
      if (!embedding || !embedding.values) {
        throw new Error("No embedding returned from Gemini");
      }
      
      console.log("Gemini embedding generated successfully");
      
      return NextResponse.json({ 
        success: true, 
        embedding: embedding.values,
        model: "text-embedding-004",
        dimensions: embedding.values.length,
        source: "gemini"
      });
      
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
      
      return NextResponse.json({ 
        success: false, 
        error: geminiError instanceof Error ? geminiError.message : "Gemini API error",
        suggestion: "Check your Gemini API key and quota limits"
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error("Embedding generation error:", error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      suggestion: "Check your request format and API configuration"
    }, { status: 500 });
  }
}

// Health check for embedding service
export async function GET() {
  return NextResponse.json({
    service: "Gemini Embedding Generator",
    model: "text-embedding-004",
    provider: "Google AI",
    hasApiKey: !!process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    note: "Using Google's Gemini embedding model for vector generation"
  });
}