import { defineTool } from "eve/tools";
import { z } from "zod";
import { demoWorkouts } from "../lib/demo_data";

export default defineTool({
  description: "Read the current user's recent workout history.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(20).default(10),
  }),
  async execute({ limit }) {
    return { workouts: demoWorkouts.slice(0, limit) };
  },
});
