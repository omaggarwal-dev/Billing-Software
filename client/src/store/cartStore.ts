import { create } from "zustand";
import type { MenuItem, RestaurantTable } from "../types/index.js";

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

interface CartState {
  items: CartItem[];
  selectedTable: RestaurantTable | null;
  discount: number;
  taxRate: number;
  notes: string;
  addItem: (item: MenuItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateItemNotes: (menuItemId: string, notes: string) => void;
  setSelectedTable: (table: RestaurantTable | null) => void;
  setDiscount: (discount: number) => void;
  setTaxRate: (rate: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  selectedTable: null,
  discount: 0,
  taxRate: 5, // 5% default
  notes: "",

  addItem: (menuItem) => {
    set((state) => {
      const existing = state.items.find((i) => i.menuItem.id === menuItem.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.menuItem.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        items: [...state.items, { menuItem, quantity: 1, notes: "" }],
      };
    });
  },

  removeItem: (menuItemId) => {
    set((state) => ({
      items: state.items.filter((i) => i.menuItem.id !== menuItemId),
    }));
  },

  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItem.id === menuItemId ? { ...i, quantity } : i
      ),
    }));
  },

  updateItemNotes: (menuItemId, notes) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItem.id === menuItemId ? { ...i, notes } : i
      ),
    }));
  },

  setSelectedTable: (table) => set({ selectedTable: table }),
  setDiscount: (discount) => set({ discount: Math.max(0, discount) }),
  setTaxRate: (taxRate) => set({ taxRate: Math.max(0, taxRate) }),

  clearCart: () =>
    set({
      items: [],
      selectedTable: null,
      discount: 0,
      notes: "",
    }),

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + Number(item.menuItem.price) * item.quantity, 0);
  },

  getTax: () => {
    const subtotal = get().getSubtotal();
    const discount = get().discount;
    const taxable = Math.max(0, subtotal - discount);
    return (taxable * get().taxRate) / 100;
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().discount;
    const tax = get().getTax();
    return Math.max(0, subtotal - discount + tax);
  },
}));
