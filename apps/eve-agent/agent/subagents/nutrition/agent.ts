import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Provide practical nutrition strategies that support training and recovery while respecting user preferences.",
  model: process.env.EVE_MODEL ?? "openai/gpt-5.6-luna",
  reasoning: "high",
});
