// One shared WebSocket per Binance market. Charts, the watchlist and alerts subscribe to streams
// ("btcusdt@kline_1m", "ethusdt@miniTicker") and the hub multiplexes them over a combined stream,
// reconnecting with backoff and falling back to the next URL when one is blocked.
//
// Some networks let the socket open but never deliver a message (Binance's USDⓈ-M futures stream
// from restricted regions). A hub can be given a REST poller for that case: when a connection has
// listeners but no data arrives within the probe window, the poller feeds the same listeners.

type Listener = (data: unknown) => void;
export type Emit = (stream: string, data: unknown) => void;
export type Poller = (streams: string[], emit: Emit) => () => void;

const PROBE_MS = 8_000;

class StreamHub {
  private socket: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private urlIndex = 0;
  private retry = 0;
  private nextId = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private everOpened = false;
  private reconnectListeners = new Set<() => void>();
  private poller: Poller | null = null;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private stopPolling: (() => void) | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly urls: string[]) {}

  // REST fallback used when the socket stays silent (see the note above).
  setPoller(poller: Poller) {
    this.poller = poller;
  }

  get polling() {
    return this.stopPolling !== null;
  }

  // Fires after the socket comes back from a drop (not on the first connection), once the
  // subscriptions have been re-sent; bar subscribers use it to backfill what they missed.
  onReconnect(listener: () => void) {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  subscribe(stream: string, listener: Listener) {
    let set = this.listeners.get(stream);
    if (!set) {
      set = new Set();
      this.listeners.set(stream, set);
      this.queue(stream);
      this.schedulePollRestart();
    }
    set.add(listener);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.connect();
    return () => {
      const current = this.listeners.get(stream);
      if (!current) return;
      current.delete(listener);
      if (current.size > 0) return;
      this.listeners.delete(stream);
      this.send("UNSUBSCRIBE", [stream]);
      this.schedulePollRestart();
      if (this.listeners.size === 0) {
        // Keep the socket briefly: switching symbols unsubscribes then subscribes right away.
        this.idleTimer = setTimeout(() => this.close(), 15_000);
      }
    };
  }

  private queue(stream: string) {
    this.pending.add(stream);
    if (this.flushTimer) return;
    // Batch subscriptions made in the same tick (a watchlist subscribes to many at once).
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const streams = [...this.pending].filter((s) => this.listeners.has(s));
      this.pending.clear();
      if (streams.length) this.send("SUBSCRIBE", streams);
    }, 0);
  }

  private send(method: "SUBSCRIBE" | "UNSUBSCRIBE", params: string[]) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    // Binance caps a message's params; 200 is well under it.
    for (let i = 0; i < params.length; i += 200) {
      this.socket.send(JSON.stringify({ method, params: params.slice(i, i + 200), id: this.nextId++ }));
    }
  }

  private dispatch(stream: string, data: unknown) {
    this.listeners.get(stream)?.forEach((listener) => listener(data));
  }

  private connect() {
    if (this.socket || this.reconnectTimer || typeof WebSocket === "undefined") return;
    const socket = new WebSocket(this.urls[this.urlIndex % this.urls.length]);
    this.socket = socket;
    let opened = false;
    let received = false;
    socket.onopen = () => {
      opened = true;
      this.retry = 0;
      this.send("SUBSCRIBE", [...this.listeners.keys()]);
      if (this.everOpened) this.reconnectListeners.forEach((l) => l());
      this.everOpened = true;
      this.armProbe(() => !received);
    };
    socket.onmessage = (event) => {
      let message: { stream?: string; data?: unknown };
      try {
        message = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (!message.stream) return;
      if (!received) {
        received = true;
        this.clearProbe();
        this.endPolling();
      }
      this.dispatch(message.stream, message.data);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.clearProbe();
      if (!opened) this.urlIndex++;
      if (this.listeners.size === 0) return;
      const delay = Math.min(30_000, 500 * 2 ** this.retry++);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    };
    socket.onerror = () => socket.close();
  }

  private close() {
    const socket = this.socket;
    this.socket = null;
    this.clearProbe();
    this.endPolling();
    socket?.close();
  }

  // ---------------------------------------------------------------------------------------------
  // Silent-socket fallback

  private armProbe(silent: () => boolean) {
    this.clearProbe();
    if (!this.poller) return;
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null;
      if (silent() && this.listeners.size > 0) this.startPolling();
    }, PROBE_MS);
  }

  private clearProbe() {
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = null;
  }

  private startPolling() {
    if (!this.poller) return;
    this.stopPolling?.();
    this.stopPolling = this.poller([...this.listeners.keys()], (stream, data) => this.dispatch(stream, data));
  }

  private endPolling() {
    this.stopPolling?.();
    this.stopPolling = null;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  // The set of streams changed while polling: restart the poller with the new list (debounced,
  // a watchlist change touches many streams at once).
  private schedulePollRestart() {
    if (!this.stopPolling || this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.listeners.size === 0) this.endPolling();
      else if (this.stopPolling) this.startPolling();
    }, 50);
  }
}

export const spotStream = new StreamHub([
  "wss://stream.binance.com:9443/stream",
  "wss://data-stream.binance.vision/stream",
]);

export const futuresStream = new StreamHub(["wss://fstream.binance.com/stream"]);
