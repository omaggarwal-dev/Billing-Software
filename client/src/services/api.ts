import axios, { AxiosError } from "axios";

const API_BASE_URL = "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach token & active franchise header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rms_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const selectedFranchiseId = localStorage.getItem("rms_selected_franchise");
  if (selectedFranchiseId) {
    config.headers["x-franchise-id"] = selectedFranchiseId;
  }

  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("rms_token");
      localStorage.removeItem("rms_user");
      // Don't loop redirect if already on login
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> };
    if (data?.message) {
      if (data.errors) {
        const detail = Object.entries(data.errors)
          .map(([k, v]) => `${k}: ${v.join(", ")}`)
          .join(" | ");
        return `${data.message} (${detail})`;
      }
      return data.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
}
