# Multi-Franchise Restaurant Management, POS & Billing Platform

A modern, production-ready, full-stack Multi-Franchise Restaurant Management, Point of Sale (POS), Kitchen Display (KOT), Table Ordering, Inventory/Menu, HR Attendance, Payroll, and Financial Analytics Platform.

---

## Architecture Overview

- **Backend**: Node.js, Express, TypeScript, Prisma ORM (`6.19.3`), PostgreSQL (Supabase), Socket.IO for real-time bi-directional events (POS, Kitchen, Table sessions).
- **Frontend**: React 19, TypeScript, Tailwind CSS, TanStack React Query, Zustand, Lucide Icons, Vite.
- **Tenant Isolation**: Multi-tenant isolation enforced at the Prisma repository layer and middleware layer (`x-franchise-id` header & JWT claims).
- **RBAC**: 7 hierarchical roles (`SUPER_ADMIN`, `FRANCHISE_MANAGER`, `CASHIER`, `HR`, `ACCOUNTANT`, `CHEF`, `WAITER`).
- **Hardware Abstraction**: ESC/POS thermal receipt and kitchen order ticket (KOT) printer spooler and formatting engine (58mm & 80mm).

---

## Default Super Admin Login Credentials

- **Email**: `admin@restaurant.local`
- **Password**: `Admin@12345`

---

## Core Features & Modules

1. **Multi-Franchise Tenancy**: Create, update, view franchises with isolated users, menus, tables, orders, payroll, and printers. Super Admin global dashboard aggregates all franchises.
2. **Role-Based Access Control (RBAC)**: User management with role assignments and password reset.
3. **Staff Management & HR**: Employee directory, designations, base salaries, contact info.
4. **Attendance & Leave Management**:
   - Check-in / Check-out with overtime hours calculation.
   - Leave request submission and approval workflows (`PENDING`, `APPROVED`, `REJECTED`).
5. **Automated Payroll Engine**:
   - Monthly payroll generation per employee calculating basic salary, allowances, overtime, deductions, bonus, and advances.
   - Payroll status lifecycle (`DRAFT` -> `FINALIZED` -> `PAID`).
6. **Menu & Station Management**:
   - Categories and menu items with dietary flags (Veg, Non-Veg, Spicy, Chef Special).
   - Kitchen preparation station routing (`Tandoor`, `Main Kitchen`, `Bar`, `Dessert`).
7. **Table & Floor Management**: Real-time visual floor plan, table capacity, active session billing, auto-releasing on invoice settlement.
8. **Point of Sale (POS)**: Fast touchscreen order terminal, custom item notes, tax calculation, discount management, split/direct checkout.
9. **Kitchen Order Tickets (KOT) & Kitchen Display System (KDS)**:
   - Station-based KOT splitting and routing.
   - Real-time Socket.IO live notifications with audio chime.
   - State progression (`CREATED` -> `PREPARING` -> `READY` -> `SERVED`).
10. **Billing & Split Payments**:
    - Itemized tax, discount, service charge calculations.
    - Multi-mode split payments (`CASH`, `CARD`, `UPI`, `WALLET`).
    - Invoice tracking (`isFullyPaid`, `remainingBalance`).
11. **Thermal Printer Spooler**: ESC/POS formatting for 58mm/80mm thermal receipt printers with cut commands and physical print preview.
12. **Financial Reports & Analytics**:
    - Daily/Weekly/Monthly revenue, sales by category, top-selling items, payment mode breakdown.
    - Super Admin Global Owner overview across all franchises.
13. **Audit Logging**: Immutable tracking of sensitive actions (role edits, table closures, invoice payments, salary payouts).

---

## Local Development & Setup

### Prerequisites
- Node.js >= 18.x
- PostgreSQL database connected via `DATABASE_URL` in `server/.env`

### Run Both Server and Client
1. **Start Backend Server** (Port 5000):
   ```bash
   cd server
   npm run dev
   ```

2. **Start Frontend Client** (Port 5173):
   ```bash
   cd client
   npm run dev
   ```

3. **Run E2E Test Suite**:
   ```bash
   npm --prefix server exec tsx src/test-e2e.ts
   ```

4. **Production Build**:
   ```bash
   npm run build
   ```
