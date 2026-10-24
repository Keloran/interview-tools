import {error, loadConfigFromEnv, setDefaultConfig} from "bugfixes";

// Next bundles instrumentation and each route separately, each with its own copy of the SDK's config,
// so configure on import here and have everything report through this module.
// Sends to bugfixes when BUGFIXES_AGENT_KEY/SECRET are set; otherwise just logs locally.
const config = loadConfigFromEnv();
setDefaultConfig({
  ...config,
  // the SDK only reads BUGFIXES_*; fall back to what Railway provides
  service: config.service || "interview-tools",
  environment: config.environment || process.env.RAILWAY_ENVIRONMENT_NAME || "",
  commitSha: config.commitSha || process.env.RAILWAY_GIT_COMMIT_SHA || "",
});

export const reportError = error;
