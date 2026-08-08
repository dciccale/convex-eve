import { defineTool } from "eve/tools";
import { z } from "zod";
import { demoProfile } from "../lib/demo_data";

export default defineTool({
  description: "Read the current user's goals and coaching preferences.",
  inputSchema: z.object({}),
  async execute() {
    return demoProfile;
  },
});
