import serverless from "serverless-http";
import app from "./app";

const FUNCTION_PREFIX = "/.netlify/functions/api";

/**
 * Netlify Function entry point.
 *
 * netlify.toml rewrites /api/* here. Depending on whether a request arrives via
 * that rewrite or as a direct invoke, the path can appear either as `/api/...`
 * or as `/.netlify/functions/api/...`. Normalising to the former means the
 * Express router — mounted at /api — matches in both cases, instead of 404ing
 * on one of them.
 *
 * src/index.ts remains the long-running server used for local development and
 * by the Playwright suite; both share the same `app`.
 */
export const handler = serverless(app, {
  // Payloads the API accepts (script text, JSON bodies) are text, not binary.
  binary: false,
  request(req: { url?: string }) {
    if (req.url?.startsWith(FUNCTION_PREFIX)) {
      const rest = req.url.slice(FUNCTION_PREFIX.length);
      req.url = rest === "" || rest === "/" ? "/api" : `/api${rest}`;
    }
  },
});
