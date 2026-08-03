export const API_BASE_URL = "http://192.100.38.67:8000/api";

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string | null;
};

export type AppUser = {
  user_id: number;
  username: string;
  full_name: string;
  role: "ADMIN" | "PARSER";
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OdistsColumn = {
  name: string;
  data_type: string;
  is_nullable: boolean;
  ordinal_position: number;
  editable: boolean;
};

export type OdistsPage = {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  columns: OdistsColumn[];
};

function getToken(): string | null {
  return localStorage.getItem("metadata_app_token");
}

export async function appFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail || body?.message || `HTTP ${response.status}`;
    if (response.status === 401) {
      localStorage.removeItem("metadata_app_token");
      localStorage.removeItem("metadata_app_user");
    }
    throw new Error(detail);
  }
  return body as ApiResponse<T>;
}

export const authApi = {
  login: (username: string, password: string) =>
    appFetch<{ access_token: string; token_type: string; user: AppUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => appFetch<AppUser>("/auth/me"),
  users: () => appFetch<AppUser[]>("/auth/users"),
  createUser: (payload: {
    username: string;
    password: string;
    full_name: string;
    role: "ADMIN" | "PARSER";
    is_active: boolean;
  }) => appFetch<AppUser>("/auth/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (userId: number, payload: Record<string, unknown>) =>
    appFetch<AppUser>(`/auth/users/${userId}`, { method: "PUT", body: JSON.stringify(payload) }),
};

export const odistsApi = {
  getPage: (params: {
    page: number;
    pageSize: number;
    columns: string[];
    filters: Record<string, string>;
    sortBy: string;
    sortDir: "asc" | "desc";
  }) => {
    const query = new URLSearchParams({
      page: String(params.page),
      page_size: String(params.pageSize),
      columns: params.columns.join(","),
      filters: JSON.stringify(params.filters),
      sort_by: params.sortBy,
      sort_dir: params.sortDir,
    });
    return appFetch<OdistsPage>(`/odists-parsing?${query.toString()}`);
  },
  update: (id: number, values: Record<string, unknown>) =>
    appFetch<Record<string, unknown>>(`/odists-parsing/${id}`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),
};
