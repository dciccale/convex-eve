import { defineTool } from "eve/tools";
import { z } from "zod";
import { demoRecoveryCheckins } from "../lib/demo_data";

export default defineTool({
  description: "Read recent sleep, soreness, and recovery check-ins.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(14).default(7),
  }),
  async execute({ limit }) {
    return { checkins: demoRecoveryCheckins.slice(0, limit) };
  },
});
