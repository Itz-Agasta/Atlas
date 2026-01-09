"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { toast } from "sonner";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error) => {
        toast.error(error.message, {
          action: {
            label: "retry",
            onClick: () => {
              queryClient.invalidateQueries();
            },
          },
        });
      },
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools />
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
