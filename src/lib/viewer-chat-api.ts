import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { StreamContext } from "@/lib/sidekick/insights";

export interface CopilotToolCall {
  tool: string;
  request: string;
  summary: string;
}

export interface CopilotAnswer {
  intent: string;
  answer: string;
  tool_calls: CopilotToolCall[];
}

export const streamContextQueryOptions = queryOptions({
  queryKey: ["insights", "context"],
  queryFn: async () => {
    const response = await apiClient.get<StreamContext>("/insights/context");
    return response.data;
  },
});

export async function askCopilot(question: string): Promise<CopilotAnswer> {
  const response = await apiClient.post<CopilotAnswer>("/copilot/ask", { question });
  return response.data;
}
