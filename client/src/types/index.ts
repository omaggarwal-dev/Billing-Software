export type UserRole =
  | "SUPER_ADMIN"
  | "FRANCHISE_MANAGER"
  | "CASHIER"
  | "HR"
  | "ACCOUNTANT"
  | "CHEF"
  | "WAITER";

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLING" | "OUT_OF_SERVICE";

export type OrderStatus = "OPEN" | "CONFIRMED" | "PREPARING" | "READY" | "SERVED" | "BILLED" | "CANCELLED";

export type KOTStatus = "CREATED" | "PRINTED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";

export type PaymentMethod = "CASH" | "UPI" | "CARD" | "OTHER";

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export type PayrollStatus = "DRAFT" | "FINALIZED" | "PAID";

export type PrinterType = "KOT" | "RECEIPT" | "BAR" | "KITCHEN" | "DESSERT" | "OTHER";

export interface Franchise {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users?: number;
    employees?: number;
    tables?: number;
    orders?: number;
    menuItems?: number;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  franchiseId: string | null;
  isActive: boolean;
  createdAt: string;
  franchise?: {
    id: string;
    name: string;
    code: string;
    isActive?: boolean;
  } | null;
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  basicSalary: number | string;
  allowances: number | string;
  overtimeRate: number | string;
}

export interface Employee {
  id: string;
  franchiseId: string;
  employeeCode: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  designation?: string | null;
  joiningDate: string;
  status: EmployeeStatus;
  createdAt: string;
  salaryStructure?: SalaryStructure | null;
  _count?: {
    attendance?: number;
    leaveRequests?: number;
  };
}

export interface Attendance {
  id: string;
  franchiseId: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName?: string | null;
    designation?: string | null;
  };
}

export interface LeaveRequest {
  id: string;
  franchiseId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: LeaveStatus;
  approvedBy?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName?: string | null;
    designation?: string | null;
  };
}

export interface PayrollItem {
  id: string;
  payrollId: string;
  employeeId: string;
  basicSalary: number | string;
  allowances: number | string;
  overtime: number | string;
  bonus: number | string;
  deductions: number | string;
  advance: number | string;
  netSalary: number | string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName?: string | null;
    designation?: string | null;
  };
}

export interface Payroll {
  id: string;
  franchiseId: string;
  month: number;
  year: number;
  status: PayrollStatus;
  totalGross: number | string;
  totalDeductions: number | string;
  totalNet: number | string;
  createdAt: string;
  items?: PayrollItem[];
  _count?: { items?: number };
}

export interface Category {
  id: string;
  franchiseId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  _count?: { menuItems?: number };
}

export interface PreparationStation {
  id: string;
  franchiseId: string;
  name: string;
  isActive: boolean;
  printers?: Printer[];
  _count?: { menuItems?: number; kots?: number };
}

export interface MenuItem {
  id: string;
  franchiseId: string;
  categoryId: string;
  stationId?: string | null;
  name: string;
  description?: string | null;
  price: number | string;
  isAvailable: boolean;
  category?: { id: string; name: string };
  station?: { id: string; name: string } | null;
}

export interface TableSession {
  id: string;
  tableId: string;
  startedAt: string;
  endedAt?: string | null;
  orders?: Order[];
}

export interface RestaurantTable {
  id: string;
  franchiseId: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  sessions?: TableSession[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  notes?: string | null;
  menuItem: MenuItem;
}

export interface Order {
  id: string;
  franchiseId: string;
  tableSessionId?: string | null;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  createdAt: string;
  items: OrderItem[];
  tableSession?: {
    id: string;
    table: RestaurantTable;
  } | null;
  kots?: KOT[];
  invoice?: Invoice | null;
}

export interface KOTItem {
  id: string;
  kotId: string;
  orderItemId: string;
  menuItemId: string;
  quantity: number;
  notes?: string | null;
  menuItem: MenuItem;
}

export interface KOT {
  id: string;
  franchiseId: string;
  orderId: string;
  stationId?: string | null;
  kotNumber: string;
  status: KOTStatus;
  createdAt: string;
  printedAt?: string | null;
  completedAt?: string | null;
  station?: PreparationStation | null;
  order: Order;
  items: KOTItem[];
}

export interface Payment {
  id: string;
  franchiseId: string;
  invoiceId: string;
  amount: number | string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  invoice?: Invoice;
}

export interface Invoice {
  id: string;
  franchiseId: string;
  orderId: string;
  invoiceNumber: string;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  createdAt: string;
  order: Order;
  payments: Payment[];
  totalPaid?: number;
  remainingBalance?: number;
  isFullyPaid?: boolean;
}

export interface Printer {
  id: string;
  franchiseId: string;
  stationId?: string | null;
  name: string;
  type: PrinterType;
  ipAddress?: string | null;
  port?: number | null;
  isActive: boolean;
  station?: PreparationStation | null;
}

export interface AuditLog {
  id: string;
  franchiseId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: any;
  newData?: any;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: UserRole } | null;
  franchise?: { id: string; name: string; code: string } | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  errors?: any;
}
