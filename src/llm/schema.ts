import { z } from 'zod';

export const ClaudeResponseSchema = z.object({
  exchange: z.enum(['UPBIT', 'BITHUMB']),
  ticker: z.string().min(1).max(20),
  title: z.string().min(1),
  article_message: z.string().min(100),
  // Allow shorter press_release_message so local fallback can be applied when Claude
  // doesn't return a sufficiently long press release text.
  press_release_message: z.string().min(1),
});

export type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;
