const Fastify = require('fastify')({ ignoreTrailingSlash: true });
const { v4: uuidv4 } = require('uuid');
const debug = require('debug')('connection-manager');
const EventEmitter = require('events');

const Connection = require('./connection.js');
const { addHook } = require('./hooks.js');

class WebRTCConnectionManager extends EventEmitter {
  constructor(opts) {
    super();
    this.port = opts.port;

    if (!this.port) {
      throw new Error("opts.port must be provided");
    }

    Fastify.register(require('fastify-swagger'), {
      routePrefix: "/api/docs",
      swagger: {
        info: {
          title: "WebRTC Peer Connection Manager",
          description: "Connection negotiation API to establish a WebRTC peer between client and server",
          version: "0.1.0"
        },
      },
      exposeRoute: true
    });
    Fastify.register(require('fastify-cors'), {});
    Fastify.register(require('./connection_manager_routes.js'), {
      prefix: opts.apiPrefix || "/api/v1",
      connectionManager: this
    });

    Fastify.ready(err => {
      if (err) throw err;
      Fastify.swagger();
    });

    this.connections = {};
    this.closedListeners = {};
  }

  register(hook, fn) {
    addHook(hook, fn);
  }

  async createConnection() {
    const connectionId = uuidv4();
    const connection = new Connection({
      connectionId: connectionId,
    });

    this.connections[connectionId] = connection;

    debug("Created new connection");
    debug(connection);

    const closedListener = () => { this.deleteConnection(connectionId); this.emit('close'); }
    this.closedListeners[connectionId] = closedListener;
    connection.once('closed', closedListener);

    await connection.doOffer();

    this.emit('connect', connection);
    return this.connections[connectionId];
  }

  deleteConnection(connectionId) {
    debug(`Delete connection ${connectionId}`);

    const closedListener = this.closedListeners[connectionId];
    delete this.closedListeners[connectionId];
    this.connections[connectionId].removeListener(closedListener);

    delete this.connections[connectionId];
  }

  getConnections() {
    return Object.keys(this.connections).map(id => this.connections[id].asJson());
  }

  getConnectionById(connectionId) {
    return this.connections[connectionId];
  }

  async listen() {
    const address = await Fastify.listen(this.port, '0.0.0.0');
    console.log(`Connection Manager listening on ${address}`);
  }
}

module.exports = WebRTCConnectionManager;