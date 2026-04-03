import { SYNC_INTERVAL_MS } from "../utils/constants";

export default class GameSync {
  constructor(peerConnection) {
    this.peerConnection = peerConnection;
    this.interval = null;
    this.state = {
      status: "waiting"
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
  }
}
