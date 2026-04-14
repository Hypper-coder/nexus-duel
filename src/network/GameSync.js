import { SYNC_INTERVAL_MS } from "../utils/constants";

export default class GameSync {
  constructor(wsSend) {
    this.wsSend = wsSend;
    this.interval = null;
    this.stateProvider = null;
    this.remoteListeners = new Set();
    this.generalListeners = new Set();
  }

  // Called by App.jsx whenever a WS message arrives
  onIncoming(payload) {
    if (!payload) return;
    if (payload.type === "state") {
      this.remoteListeners.forEach((cb) => cb(payload));
    }
    this.generalListeners.forEach((cb) => cb(payload));
  }

  onRemoteState(callback) {
    this.remoteListeners.add(callback);
    return () => this.remoteListeners.delete(callback);
  }

  onMessage(callback) {
    this.generalListeners.add(callback);
    return () => this.generalListeners.delete(callback);
  }

  send(payload) {
    this.wsSend(payload);
  }

  start(stateProvider) {
    if (this.interval) return;
    this.stateProvider = stateProvider;
    this.interval = setInterval(() => {
      if (!this.stateProvider) return;
      const payload = {
        type: "state",
        timestamp: Date.now(),
        ...this.stateProvider()
      };
      this.wsSend(payload);
    }, SYNC_INTERVAL_MS);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.stateProvider = null;
  }

  dispose() {
    this.stop();
    this.remoteListeners.clear();
    this.generalListeners.clear();
  }
}
