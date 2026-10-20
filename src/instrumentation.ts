// Runs once when the server starts. The Node-only setup lives in its own file so the Edge build
// never sees node: imports.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
