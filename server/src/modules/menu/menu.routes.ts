import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import {
  addCategory,
  addItem,
  addStation,
  editCategory,
  editItem,
  getCategories,
  getItem,
  getItems,
  getStations,
  removeCategory,
  toggleAvailability,
} from "./menu.controller.js";

const router = Router();

router.use(authenticate);

// Categories
router.get("/categories", getCategories);
router.post("/categories", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), addCategory);
router.put("/categories/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), editCategory);
router.delete("/categories/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), removeCategory);

// Stations
router.get("/stations", getStations);
router.post("/stations", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), addStation);

// Items
router.get("/items", getItems);
router.get("/items/:id", getItem);
router.post("/items", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), addItem);
router.put("/items/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), editItem);
router.patch("/items/:id/availability", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF"), toggleAvailability);

export default router;
