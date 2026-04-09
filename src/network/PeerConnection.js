import Peer from "peerjs";

export default class PeerConnection {
  constructor(playerId) {
    this.peer = new Peer(playerId);
    this.connections = new Map();
    this.callbacks = {
      ready: [],
      connected: [],
      message: [],
      error: []
    };

    this.peer.on("open", () => this.callbacks.ready.forEach((cb) => cb(this.peer.id)));
    this.peer.on("error", (error) => this.callbacks.error.forEach((cb) => cb(error)));
    this.peer.on("connection", (connection) => this.attachConnection(connection));
    this.peer.on("disconnected", () => {
      if (this.peer.destroyed) return;
      this.callbacks.error.forEach((cb) =>
        cb(new Error("PeerJS disconnected from the server, attempting reconnect"))
      );
      this.peer.reconnect();
    });
    this.peer.on("close", () => {
      this.callbacks.error.forEach((cb) =>
        cb(new Error("PeerJS connection closed"))
      );
    });
  }

  attachConnection(connection) {
    if (!connection || this.connections.has(connection.peer)) return;
    this.connections.set(connection.peer, connection);

    connection.on("open", () => {
      this.callbacks.connected.forEach((cb) => cb(connection.peer));
    });

    connection.on("data", (message) => {
      this.callbacks.message.forEach((cb) => cb(message));
    });

    connection.on("close", () => {
      this.connections.delete(connection.peer);
    });

    connection.on("error", (error) => this.callbacks.error.forEach((cb) => cb(error)));
  }

  onReady(callback) {
    if (this.peer.open) {
      callback(this.peer.id);
    }
    this.callbacks.ready.push(callback);
    return () => {
      this.callbacks.ready = this.callbacks.ready.filter((cb) => cb !== callback);
    };
  }

  onConnected(callback) {
    this.callbacks.connected.push(callback);
    return () => {
      this.callbacks.connected = this.callbacks.connected.filter((cb) => cb !== callback);
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
    if (!peerId || peerId === this.peer.id) return null;
    if (this.connections.has(peerId)) {
      return this.connections.get(peerId);
    }

    if (this.peer.disconnected) {
      this.peer.reconnect();
    }

    try {
      const connection = this.peer.connect(peerId, { reliable: true });
      this.attachConnection(connection);
      return connection;
    } catch (error) {
      this.callbacks.error.forEach((cb) => cb(error));
      return null;
    }
  }

  sendMessage(message) {
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send(message);
      }
    }
  }

  disconnect() {
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }
    this.connections.clear();
  }
}
