import Peer from "peerjs";

export default class PeerConnection {
  constructor(playerId) {
    this.peer = new Peer(playerId, {
      host: "peerjs-server.herokuapp.com",
      secure: true,
      port: 443
    });
    this.connections = new Map();
    this.callbacks = {
      ready: [],
      message: [],
      error: []
    };

    this.peer.on("open", () => this.callbacks.ready.forEach((cb) => cb()));
    this.peer.on("error", (error) => this.callbacks.error.forEach((cb) => cb(error)));
    this.peer.on("connection", (connection) => this.handleConnection(connection));
  }

  handleConnection(connection) {
    this.connections.set(connection.peer, connection);
    connection.on("data", (message) => this.callbacks.message.forEach((cb) => cb(message)));
    connection.on("close", () => this.connections.delete(connection.peer));
  }

  onReady(callback) {
    this.callbacks.ready.push(callback);
    return () => {
      this.callbacks.ready = this.callbacks.ready.filter((cb) => cb !== callback);
    };
  }

  onError(callback) {
    this.callbacks.error.push(callback);
    return () => {
      this.callbacks.error = this.callbacks.error.filter((cb) => cb !== callback);
    };
  }

  onMessage(callback) {
    this.callbacks.message.push(callback);
    return () => {
      this.callbacks.message = this.callbacks.message.filter((cb) => cb !== callback);
    };
  }

  connectTo(peerId) {
    if (!peerId) return null;
    const connection = this.peer.connect(peerId);
    connection.on("open", () => this.handleConnection(connection));
    return connection;
  }

  sendMessage(message) {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
    this.callbacks.message.forEach((cb) => cb(message));
  }

  disconnect() {
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }
    this.connections.clear();
  }
}
