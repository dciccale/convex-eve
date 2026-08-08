import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

const sessionSchema = z.object({
  day: z.string(),
  activity: z.string(),
  durationMinutes: z.number().int().positive(),
  intensity: z.enum(["easy", "moderate", "hard"]),
});

export default defineTool({
  description:
    "Replace the current user's active training plan after they review the proposal.",
  inputSchema: z.object({
    summary: z.string().min(1),
    sessions: z.array(sessionSchema).min(1).max(14),
  }),
  approval: always(),
  async execute(plan) {
    return {
      updated: true,
      summary: plan.summary,
      sessionCount: plan.sessions.length,
    };
  },
});
