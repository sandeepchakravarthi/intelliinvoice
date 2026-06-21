import apiClient from "./apiClient";
import type {
  AnalyticsData,
  AuthResponse,
  BulkUploadResult,
  DashboardStats,
  Invoice,
  InvoiceListResponse,
  InvoiceUpdatePayload,
} from "../types";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    return res.data;
  },

  register: async (
    name: string,
    email: string,
    password: string,
    role: string
  ): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>("/auth/register", {
      name,
      email,
      password,
      role,
    });
    return res.data;
  },

  me: async (): Promise<AuthResponse["user"]> => {
    const res = await apiClient.get<AuthResponse["user"]>("/auth/me");
    return res.data;
  },
};

// ─── Invoice ─────────────────────────────────────────────────────────────────

export const invoiceApi = {
  upload: async (file: File): Promise<Invoice> => {
    const form = new FormData();
    form.append("file", file);
    const res = await apiClient.post<Invoice>("/invoice/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  uploadBulk: async (files: File[]): Promise<BulkUploadResult[]> => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const res = await apiClient.post<BulkUploadResult[]>(
      "/invoice/upload/bulk",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },

  list: async (params: {
    page?: number;
    page_size?: number;
    status?: string;
    vendor?: string;
  }): Promise<InvoiceListResponse> => {
    const res = await apiClient.get<InvoiceListResponse>("/invoice/list", {
      params,
    });
    return res.data;
  },

  getById: async (id: string): Promise<Invoice> => {
    const res = await apiClient.get<Invoice>(`/invoice/${id}`);
    return res.data;
  },

  getDownloadUrl: async (id: string): Promise<string> => {
    const res = await apiClient.get<{ download_url: string; expires_in_seconds: number }>(
      `/invoice/${id}/download-url`
    );
    return res.data.download_url;
  },

  update: async (id: string, payload: InvoiceUpdatePayload): Promise<Invoice> => {
    const res = await apiClient.put<Invoice>(`/invoice/${id}`, payload);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/invoice/${id}`);
  },
};

// ─── Approval ────────────────────────────────────────────────────────────────

export const approvalApi = {
  approve: async (id: string, comments?: string): Promise<Invoice> => {
    const res = await apiClient.post<Invoice>(`/approval/approve/${id}`, {
      comments: comments ?? "",
    });
    return res.data;
  },

  reject: async (id: string, reason: string): Promise<Invoice> => {
    const res = await apiClient.post<Invoice>(`/approval/reject/${id}`, {
      reason,
    });
    return res.data;
  },

  pending: async (): Promise<Invoice[]> => {
    const res = await apiClient.get<Invoice[]>("/approval/pending");
    return res.data;
  },
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const dashboardApi = {
  stats: async (): Promise<DashboardStats> => {
    const res = await apiClient.get<DashboardStats>("/dashboard/stats");
    return res.data;
  },

  analytics: async (months = 6): Promise<AnalyticsData> => {
    const res = await apiClient.get<AnalyticsData>("/dashboard/analytics", {
      params: { months },
    });
    return res.data;
  },
};
