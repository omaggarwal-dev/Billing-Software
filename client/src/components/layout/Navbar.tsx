import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Building, Globe, Wifi } from "lucide-react";
import { useAuthStore } from "../../store/authStore.js";
import { api } from "../../services/api.js";
import type { Franchise } from "../../types/index.js";
import { Badge } from "../common/Badge.js";

export const Navbar: React.FC = () => {
  const { user, selectedFranchiseId, setSelectedFranchise } = useAuthStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Fetch franchises list for Super Admin dropdown
  const { data: franchises } = useQuery<Franchise[]>({
    queryKey: ["navbar-franchises"],
    queryFn: async () => {
      const res = await api.get("/franchises");
      return res.data.data;
    },
    enabled: isSuperAdmin,
  });

  const activeFranchiseName = isSuperAdmin
    ? franchises?.find((f) => f.id === selectedFranchiseId)?.name || "All Franchises (Global)"
    : user?.franchise?.name || "My Franchise";

  return (
    <header className="h-16 bg-white border-b border-gray-200/80 px-6 flex items-center justify-between shrink-0 z-10 shadow-xs">
      {/* Left: Franchise context */}
      <div className="flex items-center gap-3">
        {isSuperAdmin ? (
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Tenant Scope:
            </span>
            <select
              value={selectedFranchiseId || ""}
              onChange={(e) => setSelectedFranchise(e.target.value || null)}
              className="text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">🌐 All Franchises (Global View)</option>
              {franchises?.map((f) => (
                <option key={f.id} value={f.id}>
                  🏬 {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-900">
              {activeFranchiseName}
            </span>
            {user?.franchise?.code && (
              <Badge variant="gray" size="sm">
                {user.franchise.code}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Right: Status, Role & Profile */}
      <div className="flex items-center gap-4">
        {/* Real-time sync badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-200 text-[11px] font-semibold text-emerald-700">
          <Wifi className="w-3.5 h-3.5" />
          <span>Real-time Live</span>
        </div>

        {/* User Role Badge */}
        <Badge variant="primary" size="md">
          {user?.role.replace("_", " ")}
        </Badge>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline">
            {user?.name}
          </span>
        </div>
      </div>
    </header>
  );
};
