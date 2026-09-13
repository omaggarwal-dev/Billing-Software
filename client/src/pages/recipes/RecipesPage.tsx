import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  BookOpen,
  CheckCircle2,
  Scale,
} from "lucide-react";
import { api } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { MenuItem, Recipe, InventoryItem } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const RecipesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId, user } = useAuthStore();
  const canEdit = ["SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF"].includes(user?.role || "");

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    prepInstructions: "",
    servingSize: "1 Portion",
    wastageAllowance: 5,
    items: [{ inventoryItemId: "", quantity: 100, unit: "g", wastageAllowance: 0 }],
  });

  // Queries
  const { data: menuData } = useQuery<{ success: boolean; data: MenuItem[] }>({
    queryKey: ["menu-items-for-recipes", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/menu/items");
      return res.data;
    },
    enabled: !!selectedFranchiseId,
  });

  const { data: recipesData, isLoading } = useQuery<{ success: boolean; data: Recipe[] }>({
    queryKey: ["recipes", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/recipes");
      return res.data;
    },
    enabled: !!selectedFranchiseId,
  });

  const { data: invData } = useQuery<{ success: boolean; data: InventoryItem[] }>({
    queryKey: ["inventory-items-for-recipes", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/inventory");
      return res.data;
    },
    enabled: !!selectedFranchiseId,
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMenuItem) return;
      await api.post(`/recipes/menu-item/${selectedMenuItem.id}`, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setIsModalOpen(false);
      setSelectedMenuItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (menuItemId: string) => {
      await api.delete(`/recipes/menu-item/${menuItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const menuItems = menuData?.data || [];
  const recipes = recipesData?.data || [];
  const rawMaterials = invData?.data || [];

  const filteredMenu = menuItems.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenBuilder = (item: MenuItem, existingRecipe?: Recipe | null) => {
    setSelectedMenuItem(item);
    if (existingRecipe) {
      setForm({
        name: existingRecipe.name,
        prepInstructions: existingRecipe.prepInstructions || "",
        servingSize: existingRecipe.servingSize || "1 Portion",
        wastageAllowance: Number(existingRecipe.wastageAllowance || 0),
        items: existingRecipe.items.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantity: Number(i.quantity),
          unit: i.unit,
          wastageAllowance: Number(i.wastageAllowance || 0),
        })),
      });
    } else {
      setForm({
        name: `${item.name} Standard Recipe`,
        prepInstructions: "",
        servingSize: "1 Portion",
        wastageAllowance: 5,
        items: [{ inventoryItemId: rawMaterials[0]?.id || "", quantity: 100, unit: "g", wastageAllowance: 0 }],
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dish SOP & Recipe Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Standard operating procedures (SOP), ingredient ratios, and automatic inventory consumption formulas.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search dish or recipe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading recipes and menu items..." />
      ) : filteredMenu.length === 0 ? (
        <EmptyState
          title="No menu items found"
          description="Create menu items first in Menu Management to configure dish SOPs."
          icon={<BookOpen className="w-10 h-10 text-gray-400" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMenu.map((item) => {
            const recipe = recipes.find((r) => r.menuItemId === item.id);

            return (
              <Card key={item.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
                      <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                        {item.category?.name || "Uncategorized"} • ₹{Number(item.price).toFixed(2)}
                      </p>
                    </div>

                    {recipe ? (
                      <Badge variant="success">SOP CONFIGURED</Badge>
                    ) : (
                      <Badge variant="gray">NO SOP</Badge>
                    )}
                  </div>

                  {recipe ? (
                    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Serving: {recipe.servingSize}</span>
                        <span>Wastage: {Number(recipe.wastageAllowance)}%</span>
                      </div>

                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1.5">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          Raw Ingredients ({recipe.items.length})
                        </p>
                        <div className="space-y-1 text-xs">
                          {recipe.items.map((it) => (
                            <div key={it.id} className="flex justify-between text-gray-700">
                              <span>• {it.inventoryItem?.name || "Item"}</span>
                              <span className="font-mono font-semibold">
                                {Number(it.quantity)} {it.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {recipe.prepInstructions && (
                        <p className="text-xs text-gray-500 line-clamp-2 italic">
                          "{recipe.prepInstructions}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50/70 border border-amber-100 text-xs text-amber-800 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Configure an SOP so raw materials deduct automatically when this dish is sold.</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  {canEdit && (
                    <>
                      {recipe && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={recipe ? "outline" : "primary"}
                        onClick={() => handleOpenBuilder(item, recipe)}
                        icon={recipe ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      >
                        {recipe ? "Edit SOP" : "Create Recipe SOP"}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: SOP Recipe Builder */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Recipe SOP: ${selectedMenuItem?.name || ""}`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <Input
            label="Recipe Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Serving Size"
              placeholder="e.g. 1 Plate / 2 Portions"
              value={form.servingSize}
              onChange={(e) => setForm({ ...form, servingSize: e.target.value })}
            />
            <Input
              label="Wastage Allowance (%)"
              type="number"
              value={form.wastageAllowance}
              onChange={(e) => setForm({ ...form, wastageAllowance: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Ingredient Composition
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setForm({
                    ...form,
                    items: [
                      ...form.items,
                      { inventoryItemId: rawMaterials[0]?.id || "", quantity: 50, unit: "g", wastageAllowance: 0 },
                    ],
                  })
                }
              >
                + Add Ingredient
              </Button>
            </div>

            {form.items.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <Select
                    options={rawMaterials.map((r) => ({ value: r.id, label: `${r.name} (${r.unit})` }))}
                    value={row.inventoryItemId}
                    onChange={(e) => {
                      const updated = [...form.items];
                      updated[idx].inventoryItemId = e.target.value;
                      const matched = rawMaterials.find((x) => x.id === e.target.value);
                      if (matched) updated[idx].unit = matched.unit;
                      setForm({ ...form, items: updated });
                    }}
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    step="1"
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => {
                      const updated = [...form.items];
                      updated[idx].quantity = Number(e.target.value);
                      setForm({ ...form, items: updated });
                    }}
                  />
                </div>
                <div className="w-20">
                  <Input
                    placeholder="Unit"
                    value={row.unit}
                    onChange={(e) => {
                      const updated = [...form.items];
                      updated[idx].unit = e.target.value;
                      setForm({ ...form, items: updated });
                    }}
                  />
                </div>
                {form.items.length > 1 && (
                  <button
                    onClick={() => {
                      const updated = form.items.filter((_, i) => i !== idx);
                      setForm({ ...form, items: updated });
                    }}
                    className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Preparation Instructions
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Sauté onion with butter on medium flame for 5 minutes..."
              value={form.prepInstructions}
              onChange={(e) => setForm({ ...form, prepInstructions: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => upsertMutation.mutate()}
              isLoading={upsertMutation.isPending}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Save Recipe SOP
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};