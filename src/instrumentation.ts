// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Node's fetch tries each of a host's addresses for only 250 ms before giving up on it. From the
  // home network a connection to OpenDota (behind Cloudflare) takes about 270–290 ms, so every
  // attempt failed with ETIMEDOUT while curl got through; 2 s per address leaves room for that.
  const net = await import("node:net");
  net.setDefaultAutoSelectFamilyAttemptTimeout(2000);
}
