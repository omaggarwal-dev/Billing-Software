import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const SOCKET_BASE_URL = 
  import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, "") : "http://localhost:5000");

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_BASE_URL, {
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
