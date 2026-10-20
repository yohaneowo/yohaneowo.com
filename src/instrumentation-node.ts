import net from "node:net";

// Node's fetch tries each of a host's addresses for only 250 ms before giving up on it. From the
// home network a connection to OpenDota (behind Cloudflare) takes about 270–290 ms, so every
// attempt failed with ETIMEDOUT while curl got through; 2 s per address leaves room for that.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);
