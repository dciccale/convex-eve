import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Analyze fatigue, soreness, sleep, recent training load, and recovery constraints conservatively.",
  model: process.env.EVE_MODEL ?? "openai/gpt-5.6-luna",
  reasoning: "high",
});
