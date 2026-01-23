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
import type { AgentQueryInput } from "@atlas/schema/api/agent";

interface AgentResponseProps {
  data: Awaited<ReturnType<typeof queryAgent>>;
}

function AgentResponse({ data }: AgentResponseProps) {
  if (!data.success) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded" role="alert">
        <h2 className="text-lg font-semibold text-red-800">Error</h2>
        <p className="text-red-700">{data.error}</p>
      </div>
    );
  }

  return (
    <article className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Main Response */}
      <section>
        <p className="text-gray-800 leading-relaxed">{data.response}</p>
      </section>

      {/* Citations */}
      {data.citations && data.citations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Sources</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            {data.citations.map((citation: any, index: number) => (
              <li key={index}>{citation}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Optional: Brief Metrics (subtle, like Perplexity's footer) */}
      <footer className="text-xs text-gray-500 border-t pt-2">
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
  role: 'user' | 'assistant';
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
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsWaitingForResponse(true);
    try {
      const response = await queryAgent({ query: text });
      const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: response.response, data: response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, data: undefined };
      setMessages(prev => [...prev, errorMessage]);
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
        Math.min(800, window.innerWidth - e.clientX),
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
    <div className="fixed z-50 top-20 right-4 flex items-start">
      {/* Resize handle */}
      <div
        className={`w-1 h-[calc(100vh-6rem)] bg-transparent hover:bg-green-500 cursor-col-resize transition-colors ${isResizing ? "bg-green-500" : ""}`}
        onMouseDown={handleMouseDown}
        style={{ cursor: "col-resize" }}
        title="Drag to resize chat window"
      ></div>
      <Card
        ref={chatCardRef}
        className="h-[calc(100vh-6rem)] bg-background text-foreground border-border shadow-xl"
        style={{ width: `${width}px` }}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground bold">FloatChat</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={onClose}
          >
            <X size={18} />
            <span className="sr-only">Close</span>
          </Button>
        </CardHeader>

        <CardContent
          className="p-0 flex-1 overflow-hidden"
          style={{ height: "calc(100vh - 6rem - 145px)" }}
        >
          <ScrollArea className="h-full p-4">
            {messages.length === 0 && !isWaitingForResponse ? (
              <div className="h-full flex flex-col justify-center items-center text-center space-y-6 py-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900">
                    <BotMessageSquare
                      size={48}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-semibold text-foreground">
                      Argo Data Assistant
                    </h3>
                    <p className="text-muted-foreground max-w-md">
                      Ask me anything about oceanographic data, Argo floats, or
                      marine research insights.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 w-full">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-2 w-full">
                    <div
                      className={`whitespace-pre-wrap p-3 rounded-lg ${
                        message.role === "user"
                          ? "bg-muted ml-6"
                          : "bg-background w-full"
                      }`}
                    >
                      <div className="font-medium mb-1 text-foreground">
                        {message.role === "user" ? "You" : "Assistant"}
                      </div>
                      {message.role === "assistant" && message.data ? (
                        <AgentResponse data={message.data} />
                      ) : (
                        <div className="text-foreground">
                          {message.content}
                        </div>
                      )}
                    </div>

                    {message.role === "assistant" && (
                      <div className="flex space-x-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => {
                            // Regenerate logic would go here
                          }}
                          title="Regenerate"
                        >
                          <RefreshCw size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => {
                            navigator.clipboard.writeText(message.content);
                          }}
                          title="Copy"
                        >
                          <Clipboard size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => {
                            // Like logic would go here
                          }}
                          title="Like"
                        >
                          <ThumbsUp size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => {
                            // Dislike logic would go here
                          }}
                          title="Dislike"
                        >
                          <ThumbsDown size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {isWaitingForResponse && (
                  <div className="bg-background mr-6 p-3 rounded-lg">
                    <div className="font-medium mb-1 text-foreground">
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
              <p className="text-sm text-muted-foreground mb-3 text-center">
                Try these suggestions to get started:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {argoSuggestions.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={handleSuggestionClick}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                  />
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (input.trim()) {
                await handleSendMessage(input);
                setInput("");
              }
            }}
            className="w-full"
          >
            <div className="flex items-center space-x-2">
              <div className="relative h-[50%] w-full bg-muted/60 border-border text-md text-foreground px-2 py-2 border rounded-sm flex flex-col justify-center">
                <textarea
                  className="h-full w-full  resize-none focus:outline-none focus:outline-0 placeholder-muted-foreground bg-transparent"
                  value={input}
                  placeholder="Ask anything about Argo data..."
                  onChange={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim()) {
                        handleSendMessage(input).then(() => setInput(""));
                      }
                    }
                  }}
                />
                <div className="w-full flex flex-row justify-between space-x-1">
                  <div className="px-2 flex items-center">
                    <p className="text-sm text-muted-foreground">
                      FloatChat 1.7
                    </p>
                  </div>
                  <div>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 text-blue-500 hover:text-blue-400 hover:bg-muted rounded-full"
                      disabled={!input.trim()}
                    >
                      <ArrowUpRight size={26} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
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
