import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, Tag, ChefHat } from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { Category, MenuItem, PreparationStation } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const MenuPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId, user } = useAuthStore();
  const canEdit = ["SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF"].includes(user?.role || "");

  const [activeTab, setActiveTab] = useState<"items" | "categories">("items");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemFormData, setItemFormData] = useState({
    categoryId: "",
    stationId: "",
    name: "",
    description: "",
    price: 150,
    isAvailable: true,
  });

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
    isActive: true,
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/menu/categories");
      return res.data.data;
    },
  });

  // Fetch Preparation Stations
  const { data: stations = [] } = useQuery<PreparationStation[]>({
    queryKey: ["stations", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/menu/stations");
      return res.data.data;
    },
  });

  // Fetch Menu Items
  const { data: menuItems = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu-items", selectedFranchiseId, selectedCategoryFilter],
    queryFn: async () => {
      const url = selectedCategoryFilter
        ? `/menu/items?categoryId=${selectedCategoryFilter}`
        : "/menu/items";
      const res = await api.get(url);
      return res.data.data;
    },
  });

  // Item Mutation
  const saveItemMutation = useMutation({
    mutationFn: async (data: typeof itemFormData) => {
      const payload = {
        categoryId: data.categoryId,
        stationId: data.stationId || null,
        name: data.name,
        description: data.description || null,
        price: Number(data.price),
        isAvailable: data.isAvailable,
      };
      if (editingItem) {
        return api.put(`/menu/items/${editingItem.id}`, payload);
      }
      return api.post("/menu/items", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      setIsItemModalOpen(false);
    },
    onError: (err) => setFormError(extractErrorMessage(err)),
  });

  // Toggle Availability Mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      return api.patch(`/menu/items/${id}/availability`, { isAvailable });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    },
  });

  // Category Mutation
  const saveCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryFormData) => {
      if (editingCategory) {
        return api.put(`/menu/categories/${editingCategory.id}`, data);
      }
      return api.post("/menu/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsCategoryModalOpen(false);
    },
    onError: (err) => setFormError(extractErrorMessage(err)),
  });

  // Delete Category Mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/menu/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => alert(extractErrorMessage(err)),
  });

  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setItemFormData({
      categoryId: categories[0]?.id || "",
      stationId: stations[0]?.id || "",
      name: "",
      description: "",
      price: 200,
      isAvailable: true,
    });
    setFormError(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemFormData({
      categoryId: item.categoryId,
      stationId: item.stationId || "",
      name: item.name,
      description: item.description || "",
      price: Number(item.price),
      isAvailable: item.isAvailable,
    });
    setFormError(null);
    setIsItemModalOpen(true);
  };

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: "", description: "", isActive: true });
    setFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryFormData({
      name: cat.name,
      description: cat.description || "",
      isActive: cat.isActive,
    });
    setFormError(null);
    setIsCategoryModalOpen(true);
  };

  const filteredItems = menuItems.filter(
    (i) =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.category?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Menu Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure dishes, categories, pricing, kitchen station routing, and live availability
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleOpenCreateCategory}
              icon={<Tag className="w-4 h-4" />}
            >
              Add Category
            </Button>
            <Button
              variant="primary"
              onClick={handleOpenCreateItem}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Menu Item
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("items")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors cursor-pointer ${
            activeTab === "items"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Dishes & Items ({menuItems.length})
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors cursor-pointer ${
            activeTab === "categories"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {/* ================= ITEMS TAB ================= */}
      {activeTab === "items" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <Input
              placeholder="Search dish by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
              className="w-full sm:max-w-md"
            />
            <Select
              options={[
                { value: "", label: "All Categories" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full sm:w-56"
            />
          </div>

          {isLoading ? (
            <LoadingState message="Loading menu catalog..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No Dishes Found"
              description="Create menu items and assign them to categories and kitchen stations."
              actionLabel="Add Dish"
              onAction={handleOpenCreateItem}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="hover:shadow-md transition-shadow"
                  title={<span className="font-bold text-gray-900">{item.name}</span>}
                  action={
                    <span className="font-bold text-emerald-600 text-base">
                      ₹{Number(item.price).toFixed(2)}
                    </span>
                  }
                >
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 min-h-[32px] line-clamp-2">
                      {item.description || "No description provided."}
                    </p>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
                      <Badge variant="primary">{item.category?.name || "Uncategorized"}</Badge>
                      {item.station && (
                        <div className="flex items-center gap-1 text-gray-500 text-[11px] font-medium">
                          <ChefHat className="w-3.5 h-3.5 text-amber-500" />
                          <span>{item.station.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        onClick={() =>
                          toggleAvailabilityMutation.mutate({
                            id: item.id,
                            isAvailable: !item.isAvailable,
                          })
                        }
                        className={`text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                          item.isAvailable ? "text-emerald-600 hover:text-emerald-700" : "text-rose-600 hover:text-rose-700"
                        }`}
                      >
                        {item.isAvailable ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Available (In Stock)
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" /> Out of Stock
                          </>
                        )}
                      </button>

                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditItem(item)}
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= CATEGORIES TAB ================= */}
      {activeTab === "categories" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              title={<span className="font-bold text-gray-900">{cat.name}</span>}
              action={
                <Badge variant={cat.isActive ? "success" : "danger"} dot>
                  {cat.isActive ? "Active" : "Disabled"}
                </Badge>
              }
            >
              <div className="space-y-3">
                <p className="text-xs text-gray-500 min-h-[32px]">
                  {cat.description || "No category description."}
                </p>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100 font-medium text-gray-600">
                  <span>{cat._count?.menuItems || 0} Menu Items</span>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditCategory(cat)}
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit
                      </Button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete category "${cat.name}"?`)) {
                            deleteCategoryMutation.mutate(cat.id);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-700 p-1.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? "Edit Dish" : "Add New Dish"}
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            saveItemMutation.mutate(itemFormData);
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Dish Name *"
            required
            placeholder="e.g. Paneer Butter Masala"
            value={itemFormData.name}
            onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category *"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={itemFormData.categoryId}
              onChange={(e) => setItemFormData({ ...itemFormData, categoryId: e.target.value })}
            />

            <Select
              label="Kitchen Prep Station"
              options={[
                { value: "", label: "Standard / Any Station" },
                ...stations.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={itemFormData.stationId}
              onChange={(e) => setItemFormData({ ...itemFormData, stationId: e.target.value })}
            />
          </div>

          <Input
            label="Price (₹) *"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="250.00"
            value={itemFormData.price}
            onChange={(e) => setItemFormData({ ...itemFormData, price: Number(e.target.value) })}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Description / Ingredients
            </label>
            <textarea
              rows={2}
              placeholder="Fresh cottage cheese cooked in aromatic tomato gravy..."
              className="block w-full rounded-lg border border-gray-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={itemFormData.description}
              onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={() => setIsItemModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saveItemMutation.isPending}>
              {editingItem ? "Save Dish" : "Create Dish"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? "Edit Category" : "Add Menu Category"}
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            saveCategoryMutation.mutate(categoryFormData);
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Category Name *"
            required
            placeholder="e.g. Starters, Desserts, Beverages"
            value={categoryFormData.name}
            onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
          />

          <Input
            label="Description"
            placeholder="Appetizers and snacks"
            value={categoryFormData.description}
            onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={() => setIsCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saveCategoryMutation.isPending}>
              Save Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
