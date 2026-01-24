"use client";

import {
  ArrowUpRight,
  BotMessageSquare,
  Clipboard,
  Mic,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Suggestion } from "@/components/ui/shadcn-io/ai/suggestion";
import { Skeleton } from "@/components/ui/skeleton";
import { queryAgent } from "@/lib/utils";

interface AgentResponseProps {
  data: Awaited<ReturnType<typeof queryAgent>>;
}

function AgentResponse({ data }: AgentResponseProps) {
  if (!data.success) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4" role="alert">
        <h2 className="font-semibold text-lg text-red-800">Error</h2>
        <p className="text-red-700">{data.error}</p>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-4xl space-y-4 p-6">
      {/* Main Response */}
      <section>
        <p className="text-gray-800 leading-relaxed">{data.response}</p>
      </section>

      {/* Citations */}
      {data.citations && data.citations.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-gray-600 text-sm">Sources</h3>
          <ol className="list-inside list-decimal space-y-1 text-gray-700 text-sm">
            {data.citations.map((citation: any, index: number) => (
              <li key={index}>{citation}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Optional: Brief Metrics (subtle, like Perplexity's footer) */}
      <footer className="border-t pt-2 text-gray-500 text-xs">
        Processed in {data.processingTimeMs} ms
        {data.dataQuality && (
          <span> • {data.dataQuality.sqlQueriesExecuted} queries executed</span>
        )}
      </footer>
    </article>
  );
}

interface ChatProps {
  onClose?: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: Awaited<ReturnType<typeof queryAgent>>;
}

export default function Chat({ onClose }: ChatProps) {
  const [input, setInput] = useState("");
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [width, setWidth] = useState(384); // Default width (max-w-md = 384px)
  const [isResizing, setIsResizing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatCardRef = useRef<HTMLDivElement>(null);

  // Argo-specific suggestion prompts
  const argoSuggestions = [
    "Analyze temperature profiles near Maldives",
    "Show salinity trends for this region",
    "What do recent measurements indicate?",
    "Compare oxygen levels across depths",
    "Show me density variations over time",
  ];

  // Handle sending message
  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsWaitingForResponse(true);
    try {
      const response = await queryAgent({ query: text });
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response,
        data: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        data: undefined,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsWaitingForResponse(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  // Auto-scroll to bottom when new messages come in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle mouse down event on the resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle mouse move event while resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate new width based on mouse position
      // Window width - mouse X position from right edge
      const newWidth = Math.max(
        320,
        Math.min(800, window.innerWidth - e.clientX)
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="fixed top-20 right-4 z-50 flex items-start">
      {/* Resize handle */}
      <div
        className={`h-[calc(100vh-6rem)] w-1 cursor-col-resize bg-transparent transition-colors hover:bg-green-500 ${isResizing ? "bg-green-500" : ""}`}
        onMouseDown={handleMouseDown}
        style={{ cursor: "col-resize" }}
        title="Drag to resize chat window"
      />
      <Card
        className="h-[calc(100vh-6rem)] border-border bg-background text-foreground shadow-xl"
        ref={chatCardRef}
        style={{ width: `${width}px` }}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="bold text-foreground">FloatChat</CardTitle>
          <Button
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X size={18} />
            <span className="sr-only">Close</span>
          </Button>
        </CardHeader>

        <CardContent
          className="flex-1 overflow-hidden p-0"
          style={{ height: "calc(100vh - 6rem - 145px)" }}
        >
          <ScrollArea className="h-full p-4">
            {messages.length === 0 && !isWaitingForResponse ? (
              <div className="flex h-full flex-col items-center justify-center space-y-6 py-8 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="rounded-full bg-blue-100 p-4 dark:bg-blue-900">
                    <BotMessageSquare
                      className="text-blue-600 dark:text-blue-400"
                      size={48}
                    />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-2xl text-foreground">
                      Argo Data Assistant
                    </h3>
                    <p className="max-w-md text-muted-foreground">
                      Ask me anything about oceanographic data, Argo floats, or
                      marine research insights.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-4">
                {messages.map((message) => (
                  <div className="w-full space-y-2" key={message.id}>
                    <div
                      className={`whitespace-pre-wrap rounded-lg p-3 ${
                        message.role === "user"
                          ? "ml-6 bg-muted"
                          : "w-full bg-background"
                      }`}
                    >
                      <div className="mb-1 font-medium text-foreground">
                        {message.role === "user" ? "You" : "Assistant"}
                      </div>
                      {message.role === "assistant" && message.data ? (
                        <AgentResponse data={message.data} />
                      ) : (
                        <div className="text-foreground">{message.content}</div>
                      )}
                    </div>

                    {message.role === "assistant" && (
                      <div className="flex justify-end space-x-2">
                        <Button
                          className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            // Regenerate logic would go here
                          }}
                          size="sm"
                          title="Regenerate"
                          variant="ghost"
                        >
                          <RefreshCw size={16} />
                        </Button>
                        <Button
                          className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            navigator.clipboard.writeText(message.content);
                          }}
                          size="sm"
                          title="Copy"
                          variant="ghost"
                        >
                          <Clipboard size={16} />
                        </Button>
                        <Button
                          className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            // Like logic would go here
                          }}
                          size="sm"
                          title="Like"
                          variant="ghost"
                        >
                          <ThumbsUp size={16} />
                        </Button>
                        <Button
                          className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            // Dislike logic would go here
                          }}
                          size="sm"
                          title="Dislike"
                          variant="ghost"
                        >
                          <ThumbsDown size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {isWaitingForResponse && (
                  <div className="mr-6 rounded-lg bg-background p-3">
                    <div className="mb-1 font-medium text-foreground">
                      Assistant
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[80%] bg-muted" />
                      <Skeleton className="h-4 w-[90%] bg-muted" />
                      <Skeleton className="h-4 w-[60%] bg-muted" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <CardFooter className="relative z-10 flex flex-col space-y-4">
          {/* Suggestions - show when no messages */}
          {messages.length === 0 && !isWaitingForResponse && (
            <div className="w-full">
              <p className="mb-3 text-center text-muted-foreground text-sm">
                Try these suggestions to get started:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {argoSuggestions.map((suggestion) => (
                  <Suggestion
                    className="w-full justify-start text-left"
                    key={suggestion}
                    onClick={handleSuggestionClick}
                    size="sm"
                    suggestion={suggestion}
                    variant="outline"
                  />
                ))}
              </div>
            </div>
          )}

          <form
            className="w-full"
            onSubmit={async (e) => {
              e.preventDefault();
              if (input.trim()) {
                await handleSendMessage(input);
                setInput("");
              }
            }}
          >
            <div className="flex items-center space-x-2">
              <div className="relative flex h-[50%] w-full flex-col justify-center rounded-sm border border-border bg-muted/60 px-2 py-2 text-foreground text-md">
                <textarea
                  className="h-full w-full resize-none bg-transparent placeholder-muted-foreground focus:outline-none focus:outline-0"
                  onChange={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim()) {
                        handleSendMessage(input).then(() => setInput(""));
                      }
                    }
                  }}
                  placeholder="Ask anything about Argo data..."
                  value={input}
                />
                <div className="flex w-full flex-row justify-between space-x-1">
                  <div className="flex items-center px-2">
                    <p className="text-muted-foreground text-sm">
                      FloatChat 1.7
                    </p>
                  </div>
                  <div>
                    <Button
                      className="h-10 w-10 rounded-full p-0 text-blue-500 hover:bg-muted hover:text-blue-400"
                      disabled={!input.trim()}
                      size="sm"
                      type="submit"
                      variant="ghost"
                    >
                      <ArrowUpRight size={26} />
                    </Button>
                    <Button
                      className="h-8 w-8 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Mic size={20} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
