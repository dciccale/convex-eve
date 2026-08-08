import {
  type AuthFn,
  extractBearerToken,
  localDev,
  withAuthChallenges,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

const convexBridge: AuthFn<Request> = withAuthChallenges(
  (request) => {
    const expected = process.env.EVE_AGENT_TOKEN;
    const supplied = extractBearerToken(request.headers.get("authorization"));
    if (!expected || supplied !== expected) return null;
    return {
      attributes: {},
      authenticator: "convex-eve-example",
      issuer: "convex-eve",
      principalId: "convex-bridge",
      principalType: "service",
      subject: "performance-coach",
    };
  },
  [{ scheme: "Bearer" }],
);

export default eveChannel({ auth: [convexBridge, localDev()] });
