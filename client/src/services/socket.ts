import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io("http://localhost:5000", {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function joinFranchiseRoom(franchiseId: string) {
  const s = getSocket();
  s.emit("join-franchise", franchiseId);
}

export function joinStationRoom(franchiseId: string, stationId: string) {
  const s = getSocket();
  s.emit("join-station", { franchiseId, stationId });
}
