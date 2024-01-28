const { Server } = require("socket.io");

let io;
module.exports = {
  initIo: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        transports: ["websocket", "polling"],
        credentials: true,
      },
      allowEIO3: true,
    });
    return io;
  },
  getIo: () => {
    if (!io) {
      throw new Error("Connection to socket server faild!");
    }
    return io;
  },
};
