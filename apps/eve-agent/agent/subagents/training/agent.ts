import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Design progressive training sessions and weekly plans around goals, schedule, workload, and recovery constraints.",
  model: process.env.EVE_MODEL ?? "openai/gpt-5.6-luna",
  reasoning: "high",
});
