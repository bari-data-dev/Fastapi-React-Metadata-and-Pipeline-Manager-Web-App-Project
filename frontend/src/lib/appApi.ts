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
  label: string;
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

export type DistinctValue = {
  value: unknown;
  row_count: number;
};

export type OdistsBatchUpdateItem = {
  id: number;
  values: Record<string, unknown>;
};

export type OdistsBatchUpdateResult = {
  updated_count: number;
  updated_ids: number[];
};

export type ParsingMemberOption = {
  user_id: number | null;
  member_name: string;
  username: string;
};

export type ParsingMemberSummary = ParsingMemberOption & {
  active_parsing_rows: number;
  active_revision_rows: number;
  active_parsing_revision_rows: number;
  active_revised_fields: number;
  total_edit_activities: number;
  reverted_activities: number;
  partial_revert_activities: number;
};

export type ParsingReportTotals = {
  active_parsing_rows: number;
  active_revision_rows: number;
  active_parsing_revision_rows: number;
  active_revised_fields: number;
  total_edit_activities: number;
  reverted_activities: number;
  partial_revert_activities: number;
};

export type ParsingReportSummary = {
  members: ParsingMemberSummary[];
  member_options: ParsingMemberOption[];
  totals: ParsingReportTotals;
};

export type ParsingEffectiveItem = {
  odist_id: number;
  member_user_id: number | null;
  member_name: string;
  username: string;
  status: string;
  global_status: string;
  revert_state: string;
  original_ogal_id: unknown;
  current_ogal_id: unknown;
  active_revision_fields: string[];
  owned_revision_fields: string[];
  owned_fields: string[];
  cust_name?: unknown;
  address?: unknown;
  city?: unknown;
  province?: unknown;
  first_edited_at?: string | null;
  last_edited_at?: string | null;
  total_actions: number;
  baseline_source: string;
  is_untracked: boolean;
};

export type ParsingActivityItem = {
  audit_id: number;
  odist_id: number;
  user_id: number;
  member_name: string;
  username: string;
  change_type: string;
  revert_state: string;
  changed_fields: string[];
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  changed_at: string;
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

function getToken(): string | null {
  return localStorage.getItem("metadata_app_token");
}

export async function appFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> {
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

function appendOptional(
  query: URLSearchParams,
  key: string,
  value: string | number | null | undefined
) {
  if (value !== undefined && value !== null && String(value) !== "") {
    query.set(key, String(value));
  }
}

export const authApi = {
  login: (username: string, password: string) =>
    appFetch<{ access_token: string; token_type: string; user: AppUser }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }
    ),
  me: () => appFetch<AppUser>("/auth/me"),
  orchestratorAccess: (password: string) =>
    appFetch<{ url: string }>("/auth/orchestrator-access", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  users: () => appFetch<AppUser[]>("/auth/users"),
  createUser: (payload: {
    username: string;
    password: string;
    full_name: string;
    role: "ADMIN" | "PARSER";
    is_active: boolean;
  }) =>
    appFetch<AppUser>("/auth/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (userId: number, payload: Record<string, unknown>) =>
    appFetch<AppUser>(`/auth/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
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
  getDistinctValues: (
    field: string,
    search = "",
    limit = 100,
    filters: Record<string, string> = {}
  ) => {
    const query = new URLSearchParams({
      limit: String(limit),
      filters: JSON.stringify(filters),
    });
    if (search) query.set("search", search);
    return appFetch<DistinctValue[]>(
      `/odists-parsing/values/${encodeURIComponent(field)}?${query.toString()}`
    );
  },
  update: (id: number, values: Record<string, unknown>) =>
    appFetch<Record<string, unknown>>(`/odists-parsing/${id}`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),
  updateBatch: (items: OdistsBatchUpdateItem[]) =>
    appFetch<OdistsBatchUpdateResult>("/odists-parsing/batch", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),
};

export const parsingReportApi = {
  summary: (params: {
    dateFrom?: string;
    dateTo?: string;
    userId?: number | null;
  }) => {
    const query = new URLSearchParams();
    appendOptional(query, "date_from", params.dateFrom);
    appendOptional(query, "date_to", params.dateTo);
    appendOptional(query, "user_id", params.userId);
    return appFetch<ParsingReportSummary>(
      `/parsing-report/summary?${query.toString()}`
    );
  },
  effective: (params: {
    page: number;
    pageSize: number;
    odistId?: number | null;
    userId?: number | null;
    status?: string;
    revertState?: string;
    search?: string;
  }) => {
    const query = new URLSearchParams({
      page: String(params.page),
      page_size: String(params.pageSize),
    });
    appendOptional(query, "odist_id", params.odistId);
    appendOptional(query, "user_id", params.userId);
    appendOptional(query, "status", params.status);
    appendOptional(query, "revert_state", params.revertState);
    appendOptional(query, "search", params.search);
    return appFetch<PagedResult<ParsingEffectiveItem>>(
      `/parsing-report/effective?${query.toString()}`
    );
  },
  history: (params: {
    page: number;
    pageSize: number;
    dateFrom?: string;
    dateTo?: string;
    odistId?: number | null;
    userId?: number | null;
    changeType?: string;
    revertState?: string;
    search?: string;
  }) => {
    const query = new URLSearchParams({
      page: String(params.page),
      page_size: String(params.pageSize),
    });
    appendOptional(query, "date_from", params.dateFrom);
    appendOptional(query, "date_to", params.dateTo);
    appendOptional(query, "odist_id", params.odistId);
    appendOptional(query, "user_id", params.userId);
    appendOptional(query, "change_type", params.changeType);
    appendOptional(query, "revert_state", params.revertState);
    appendOptional(query, "search", params.search);
    return appFetch<PagedResult<ParsingActivityItem>>(
      `/parsing-report/history?${query.toString()}`
    );
  },
};
