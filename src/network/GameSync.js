import { SYNC_INTERVAL_MS } from "../utils/constants";

export default class GameSync {
  constructor(peerConnection) {
    this.peerConnection = peerConnection;
    this.interval = null;
    this.remoteListeners = new Set();
    this.messageCleanup = this.peerConnection.onMessage((payload) => this.handleIncoming(payload));
  }

  handleIncoming(payload) {
    if (!payload || payload.type !== "state") return;
    this.remoteListeners.forEach((callback) => callback(payload));
  }

  onRemoteState(callback) {
    this.remoteListeners.add(callback);
    return () => {
      this.remoteListeners.delete(callback);
    };
  }

  start(stateProvider) {
    if (this.interval) return;
    this.interval = setInterval(() => {
      const payload = {
        type: "state",
        timestamp: Date.now(),
        ...stateProvider()
      };
      this.peerConnection.sendMessage(payload);
    }, SYNC_INTERVAL_MS);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  dispose() {
    this.stop();
    if (this.messageCleanup) {
      this.messageCleanup();
      this.messageCleanup = null;
    }
  }
}
