import { useEffect, useState } from "react";

import { api } from "@/src/auth";

export type DailyPrompt = { date: string; prompt: string };

export function useDailyPrompt(): DailyPrompt | null {
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  useEffect(() => {
    api<DailyPrompt>("/prompts/today")
      .then(setPrompt)
      .catch(() => setPrompt(null));
  }, []);
  return prompt;
}
