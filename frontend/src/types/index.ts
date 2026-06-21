// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole =
  | "admin"
  | "finance_user"
  | "manager"
  | "finance_head"
  | "auditor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthResponse {
  user: User;
  tokens: TokenResponse;
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | "uploaded"
  | "processing"
  | "extracted"
  | "validation_failed"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "fraud_detected";

export type FraudStatus = "clear" | "suspected" | "confirmed";

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string | null;
  vendor_name: string | null;
  vendor_gstin: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  subtotal_amount: number | null;
  currency: string;
  description: string | null;
  line_items: LineItem[] | null;
  status: InvoiceStatus;
  fraud_status: FraudStatus;
  file_name: string;
  file_path: string;
  raw_ocr_text: string | null;
  extracted_data: Record<string, unknown> | null;
  validation_errors: string[] | null;
  validation_warnings: string[] | null;
  fraud_flags: string[] | null;
  confidence_score: number | null;
  current_approver_role: string | null;
  rejection_reason: string | null;
  uploaded_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface InvoiceUpdatePayload {
  vendor_name?: string;
  vendor_gstin?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  tax_amount?: number;
  subtotal_amount?: number;
  description?: string;
}

// ─── Dashboard & Analytics ────────────────────────────────────────────────────

export interface DashboardStats {
  total_invoices: number;
  pending_approvals: number;
  approved_today: number;
  rejected_today: number;
  fraud_alerts: number;
  total_amount_processed: number;
  average_processing_time_hours: number;
  invoices_by_status: Record<string, number>;
  monthly_trend: { date: string; count: number; amount: number }[];
  top_vendors: { vendor: string; invoice_count: number; total_amount: number }[];
}

export interface AnalyticsData {
  monthly_trends: { month: string; count: number; amount: number }[];
  vendor_breakdown: { vendor: string; count: number; total_amount: number }[];
  status_distribution: Record<string, number>;
  period_months: number;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string;
  status?: number;
}

export interface BulkUploadResult {
  filename: string;
  invoice_id?: string;
  status: "queued" | "rejected";
  reason?: string;
}
