import { QdrantClient } from "@qdrant/js-client-rest";
import { NextRequest, NextResponse } from "next/server";

// Initialize Qdrant client on server-side (avoids CORS issues)
// Only initialize if URL is properly configured
let qdrant: QdrantClient | null = null;

if (
  process.env.NEXT_PUBLIC_QDRANT_URL &&
  process.env.NEXT_PUBLIC_QDRANT_URL !== "your_qdrant_url_here" &&
  process.env.NEXT_PUBLIC_QDRANT_URL.startsWith("http")
) {
  qdrant = new QdrantClient({
    url: process.env.NEXT_PUBLIC_QDRANT_URL,
    apiKey: process.env.NEXT_PUBLIC_QDRANT_API_KEY || "",
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check if Qdrant client is initialized
    if (!qdrant) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Qdrant database not configured. Please set NEXT_PUBLIC_QDRANT_URL and NEXT_PUBLIC_QDRANT_API_KEY environment variables.",
        },
        { status: 503 },
      );
    }

    const { query, embedding } = await request.json();

    console.log("Server-side Qdrant search for:", query);

    // First check if collections exist
    const collections = await qdrant.getCollections();
    console.log("Available collections:", collections);

    // Check if any of the available collections exist (prioritize argo_papers, then vector_db)
    const availableCollections =
      collections.collections?.map((c: { name: string }) => c.name) || [];
    let collectionToUse = "";

    if (availableCollections.includes("argo_papers")) {
      collectionToUse = "argo_papers";
    } else if (availableCollections.includes("vector_db")) {
      collectionToUse = "vector_db";
    } else if (availableCollections.includes("argo_floats")) {
      collectionToUse = "argo_floats";
    }

    if (!collectionToUse) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No suitable collection found in Qdrant database. Expected: argo_papers, vector_db, or argo_floats",
          availableCollections: availableCollections,
        },
        { status: 404 },
      );
    }

    console.log(`Using collection: ${collectionToUse}`);

    // Perform vector search
    const searchResults = await qdrant.search(collectionToUse, {
      vector: embedding,
      limit: 5,
      with_payload: true,
    });

    console.log("Search results count:", searchResults.length);

    return NextResponse.json({
      success: true,
      results: searchResults,
      query: query,
      collection: collectionToUse,
      totalResults: searchResults.length,
    });
  } catch (error) {
    console.error("Server-side Qdrant error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    if (!qdrant) {
      return NextResponse.json({
        status: "not configured",
        qdrantUrl: process.env.NEXT_PUBLIC_QDRANT_URL,
        hasApiKey: !!process.env.NEXT_PUBLIC_QDRANT_API_KEY,
        error: "Qdrant client not initialized",
      });
    }

    const collections = await qdrant.getCollections();

    return NextResponse.json({
      status: "healthy",
      qdrantUrl: process.env.NEXT_PUBLIC_QDRANT_URL,
      hasApiKey: !!process.env.NEXT_PUBLIC_QDRANT_API_KEY,
      collections:
        collections.collections?.map((c: { name: string }) => c.name) || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 500 },
    );
  }
}
