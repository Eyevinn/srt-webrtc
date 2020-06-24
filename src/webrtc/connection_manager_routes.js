const schemas = require('./schema_connection.js');

module.exports = (fastify, opts, next) => {
  const connectionManager = opts.connectionManager;

  fastify.post("/connections", schemas("POST", "/connections"), async (request, reply) => {
    try {
      const connection = await connectionManager.createConnection();
      reply.send(connection.asJson());
    } catch (exc) {
      reply.code(500).send({ message: exc.message });
    }
  });

  fastify.get("/connections", schemas("GET", "/connections"), async (request, reply) => {
    try {
      reply.send(connectionManager.getConnections());
    } catch (exc) {
      reply.code(500).send({ message: exc.message });
    }
  });

  fastify.delete("/connections/:id", schemas("DELETE", "/connections/:id"), async (request, reply) => {
    try {
      const { id } = request.params;
      const connection = connectionManager.getConnectionById(id);
      if (!connection) {
        reply.code(404).send();
      } else {
        connection.close();
        reply.send(connection.asJson());
      }
    } catch (exc) {
      reply.code(500).send({ message: exc.message });
    }
  });

  fastify.get("/connections/:id/remote-description", schemas("GET", "/connections/:id/remote-description"), async (request, reply) => {
    try {
      const { id } = request.params;
      const connection = connectionManager.getConnectionById(id);
      if (!connection) {
        reply.code(404).send();
      } else {
        reply.send(connection.asJson().remoteDescription);
      }
    } catch (exc) {
      reply.code(500).send({ message: exc.message });
    }
  });

  fastify.post("/connections/:id/remote-description", schemas("POST", "/connections/:id/remote-description"), async (request, reply) => {
    try {
      const { id } = request.params;
      const connection = connectionManager.getConnectionById(id);
      if (!connection) {
        reply.code(404).send();
      } else {
        await connection.applyAnswer(request.body);
        reply.send(connection.asJson().remoteDescription);
      }
    } catch (exc) {
      reply.code(500).send({ message: exc.message });
    }
  });

  fastify.get("/connections/:id/local-description", schemas("GET", "/connections/:id/local-description"), async (request, reply) => {
    try {
      const { id } = request.params;
      const connection = connectionManager.getConnectionById(id);
      if (!connection) {
        reply.code(404).send();
      } else {
        reply.send(connection.asJson().localDescription);
      }
    } catch (exc) {
      reply.code(500).send({ message: exc.message });
    }
  });

  next();
};