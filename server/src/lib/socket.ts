import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("join-franchise", (franchiseId: string) => {
      if (franchiseId) {
        socket.join(`franchise:${franchiseId}`);
      }
    });

    socket.on("join-station", ({ franchiseId, stationId }: { franchiseId: string; stationId: string }) => {
      if (franchiseId && stationId) {
        socket.join(`station:${franchiseId}:${stationId}`);
      }
    });

    socket.on("leave-franchise", (franchiseId: string) => {
      if (franchiseId) {
        socket.leave(`franchise:${franchiseId}`);
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export const getSocket = getIO;

export function emitToFranchise(franchiseId: string, event: string, data: unknown) {
  if (io && franchiseId) {
    io.to(`franchise:${franchiseId}`).emit(event, data);
  }
}

export function emitToStation(franchiseId: string, stationId: string, event: string, data: unknown) {
  if (io && franchiseId && stationId) {
    io.to(`station:${franchiseId}:${stationId}`).emit(event, data);
  }
}