import { defineApp } from "convex/server";
import eve from "convex-eve/convex.config.js";

const app = defineApp();
app.use(eve, { name: "eve" });

export default app;
