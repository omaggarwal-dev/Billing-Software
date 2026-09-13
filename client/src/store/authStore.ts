import { create } from "zustand";
import type { User } from "../types/index.js";
import { joinFranchiseRoom } from "../services/socket.js";

interface AuthState {
  user: User | null;
  token: string | null;
  selectedFranchiseId: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setSelectedFranchise: (franchiseId: string | null) => void;
  setUser: (user: User) => void;
}

const savedUser = localStorage.getItem("rms_user");
const savedToken = localStorage.getItem("rms_token");
const savedFranchise = localStorage.getItem("rms_selected_franchise");

let initialUser: User | null = null;
try {
  if (savedUser) initialUser = JSON.parse(savedUser);
} catch {
  initialUser = null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: savedToken,
  selectedFranchiseId: savedFranchise || (initialUser?.franchiseId ?? null),
  isAuthenticated: !!savedToken && !!initialUser,

  login: (user, token) => {
    localStorage.setItem("rms_user", JSON.stringify(user));
    localStorage.setItem("rms_token", token);
    const franchiseId = user.franchiseId || null;
    if (franchiseId) {
      localStorage.setItem("rms_selected_franchise", franchiseId);
      joinFranchiseRoom(franchiseId);
    }
    set({
      user,
      token,
      selectedFranchiseId: franchiseId,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem("rms_user");
    localStorage.removeItem("rms_token");
    localStorage.removeItem("rms_selected_franchise");
    set({
      user: null,
      token: null,
      selectedFranchiseId: null,
      isAuthenticated: false,
    });
  },

  setSelectedFranchise: (franchiseId) => {
    if (franchiseId) {
      localStorage.setItem("rms_selected_franchise", franchiseId);
      joinFranchiseRoom(franchiseId);
    } else {
      localStorage.removeItem("rms_selected_franchise");
    }
    set({ selectedFranchiseId: franchiseId });
  },

  setUser: (user) => {
    localStorage.setItem("rms_user", JSON.stringify(user));
    set({ user });
  },
}));
