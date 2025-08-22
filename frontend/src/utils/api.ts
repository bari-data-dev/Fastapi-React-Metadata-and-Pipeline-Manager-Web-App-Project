// Mock API functions
// frontend/src/utils/api.ts
import type {
  ClientReference,
  ClientConfig,
  ColumnMapping,
  RequiredColumn,
  TransformationConfig,
  IntegrationConfig,
  MvRefreshConfig,
  IntegrationDependency,
  FileAuditLog,
  MappingValidationLog,
  RowValidationLog,
  LoadErrorLog,
  TransformationLog,
  IntegrationLog,
  MvRefreshLog,
  JobExecutionLog,
  ApiResponse,
} from "@/types";

// Simulate API delay (untuk mock lain)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// === CLIENT REFERENCE: Pindah dari mock ke backend ===
// Langsung hardcode BASE URL sesuai permintaan (tidak memakai file env)
const API_BASE_URL = "http://localhost:8000/api";

async function httpFetch<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const text = await res.text();
  // coba parse JSON bila ada
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    // jika server mengembalikan ApiResponse dengan message, ambil itu
    if (body && typeof body === "object" && "message" in (body as any)) {
      throw new Error((body as any).message || `HTTP ${res.status}`);
    }
    // fallback: lempar teks
    throw new Error(typeof body === "string" ? body : `HTTP ${res.status}`);
  }

  return body as T;
}

export const clientReferenceApi = {
  getAll: async (
    clientId?: number
  ): Promise<ApiResponse<ClientReference[]>> => {
    const url = clientId
      ? `${API_BASE_URL}/clients?client_id=${clientId}`
      : `${API_BASE_URL}/clients`;
    return httpFetch<ApiResponse<ClientReference[]>>(url, { method: "GET" });
  },

  getById: async (id: number): Promise<ApiResponse<ClientReference>> => {
    return httpFetch<ApiResponse<ClientReference>>(
      `${API_BASE_URL}/clients/${id}`,
      { method: "GET" }
    );
  },

  create: async (
    client: Omit<ClientReference, "client_id">
  ): Promise<ApiResponse<ClientReference>> => {
    // frontend minimal validation
    if (!client.client_schema || !client.client_name) {
      throw new Error("client_schema and client_name are required");
    }
    return httpFetch<ApiResponse<ClientReference>>(`${API_BASE_URL}/clients`, {
      method: "POST",
      body: JSON.stringify(client),
    });
  },

  update: async (
    id: number,
    client: Partial<ClientReference>
  ): Promise<ApiResponse<ClientReference>> => {
    return httpFetch<ApiResponse<ClientReference>>(
      `${API_BASE_URL}/clients/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(client),
      }
    );
  },

  delete: async (id: number): Promise<ApiResponse<null>> => {
    return httpFetch<ApiResponse<null>>(`${API_BASE_URL}/clients/${id}`, {
      method: "DELETE",
    });
  },

  // New: batch add clients
  batchAdd: async (
    clients: Array<Omit<ClientReference, "client_id">>
  ): Promise<ApiResponse<ClientReference[]>> => {
    if (!Array.isArray(clients) || clients.length === 0) {
      throw new Error("clients array is required");
    }

    // basic frontend validation: all items must have client_schema and client_name
    const missing = clients.some((c) => !c.client_schema || !c.client_name);
    if (missing) {
      throw new Error("Each client must include client_schema and client_name");
    }

    return httpFetch<ApiResponse<ClientReference[]>>(
      `${API_BASE_URL}/clients/batch-add`,
      {
        method: "POST",
        body: JSON.stringify(clients),
      }
    );
  },
};

// Client Config API (panggil backend)
export const clientConfigApi = {
  getAll: async (clientId?: number): Promise<ApiResponse<ClientConfig[]>> => {
    const url = clientId
      ? `${API_BASE_URL}/configs?client_id=${clientId}`
      : `${API_BASE_URL}/configs`;
    return httpFetch<ApiResponse<ClientConfig[]>>(url, { method: "GET" });
  },

  batchSave: async (
    configs: Array<Omit<ClientConfig, "config_id">>
  ): Promise<ApiResponse<ClientConfig[]>> => {
    if (!Array.isArray(configs) || configs.length === 0) {
      throw new Error("configs array is required");
    }

    // Basic frontend validation per-item
    const invalid = configs.some((c) => {
      return (
        c.client_id === undefined ||
        c.client_id === null ||
        !c.source_type ||
        !c.target_schema ||
        !c.target_table
      );
    });

    if (invalid) {
      throw new Error(
        "Each config must include client_id, source_type, target_schema and target_table"
      );
    }

    return httpFetch<ApiResponse<ClientConfig[]>>(
      `${API_BASE_URL}/configs/batch-save`,
      {
        method: "POST",
        body: JSON.stringify({ client_configs: configs }), // backend expects { client_configs: [...] }
      }
    );
  },

  // new: update single config (partial)
  update: async (
    configId: number,
    payload: Partial<Omit<ClientConfig, "config_id">>
  ): Promise<ApiResponse<ClientConfig>> => {
    if (!configId) throw new Error("configId is required");
    // basic validation: cannot set empty strings for mandatory fields if provided
    if (
      "client_id" in payload &&
      (payload.client_id === null || payload.client_id === undefined)
    ) {
      throw new Error("client_id cannot be empty");
    }
    if ("source_type" in payload && !payload.source_type) {
      throw new Error("source_type cannot be empty");
    }
    if ("target_schema" in payload && !payload.target_schema) {
      throw new Error("target_schema cannot be empty");
    }
    if ("target_table" in payload && !payload.target_table) {
      throw new Error("target_table cannot be empty");
    }

    return httpFetch<ApiResponse<ClientConfig>>(
      `${API_BASE_URL}/configs/${configId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },

  // new: delete single config
  delete: async (configId: number): Promise<ApiResponse<null>> => {
    if (!configId) throw new Error("configId is required");
    return httpFetch<ApiResponse<null>>(`${API_BASE_URL}/configs/${configId}`, {
      method: "DELETE",
    });
  },
};

// Column Mapping API (panggil backend)
export const columnMappingApi = {
  getAll: async (clientId?: number): Promise<ApiResponse<ColumnMapping[]>> => {
    const url = clientId
      ? `${API_BASE_URL}/mappings?client_id=${clientId}`
      : `${API_BASE_URL}/mappings`;
    return httpFetch<ApiResponse<ColumnMapping[]>>(url, { method: "GET" });
  },

  /**
   * batchSave
   * - expects an array of mapping objects: Array<Omit<ColumnMapping, 'mapping_id'>>
   * - backend endpoint: POST /mappings/batch-save
   * - Note: backend expects raw array in body (not wrapped). If your backend expects a wrapper
   *   object change `body` to JSON.stringify({ mappings: configs }) accordingly.
   */
  batchSave: async (
    mappings: Array<Omit<ColumnMapping, "mapping_id">>
  ): Promise<ApiResponse<ColumnMapping[]>> => {
    if (!Array.isArray(mappings) || mappings.length === 0) {
      throw new Error("mappings array is required");
    }

    // Basic frontend validation per-item
    const invalid = mappings.some((m) => {
      return (
        m.client_id === undefined ||
        m.client_id === null ||
        !m.source_column ||
        !m.target_column
      );
    });

    if (invalid) {
      throw new Error(
        "Each mapping must include client_id, source_column and target_column"
      );
    }

    return httpFetch<ApiResponse<ColumnMapping[]>>(
      `${API_BASE_URL}/mappings/batch-save`,
      {
        method: "POST",
        body: JSON.stringify(mappings), // note: backend expects an array
      }
    );
  },

  // update single mapping (partial update allowed)
  update: async (
    mappingId: number,
    payload: Partial<Omit<ColumnMapping, "mapping_id">>
  ): Promise<ApiResponse<ColumnMapping>> => {
    if (!mappingId) throw new Error("mappingId is required");

    // basic validation if provided in payload
    if (
      "client_id" in payload &&
      (payload.client_id === null || payload.client_id === undefined)
    ) {
      throw new Error("client_id cannot be empty");
    }
    if ("source_column" in payload && !payload.source_column) {
      throw new Error("source_column cannot be empty");
    }
    if ("target_column" in payload && !payload.target_column) {
      throw new Error("target_column cannot be empty");
    }

    return httpFetch<ApiResponse<ColumnMapping>>(
      `${API_BASE_URL}/mappings/${mappingId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },

  // delete single mapping
  delete: async (mappingId: number): Promise<ApiResponse<null>> => {
    if (!mappingId) throw new Error("mappingId is required");
    return httpFetch<ApiResponse<null>>(
      `${API_BASE_URL}/mappings/${mappingId}`,
      {
        method: "DELETE",
      }
    );
  },
};

// Required Column API (panggil backend)
export const requiredColumnApi = {
  getAll: async (clientId?: number): Promise<ApiResponse<RequiredColumn[]>> => {
    const url = clientId
      ? `${API_BASE_URL}/required-columns?client_id=${clientId}`
      : `${API_BASE_URL}/required-columns`;
    return httpFetch<ApiResponse<RequiredColumn[]>>(url, { method: "GET" });
  },

  // create single required column
  create: async (
    payload: Omit<RequiredColumn, "required_id">
  ): Promise<ApiResponse<RequiredColumn>> => {
    if (!payload) throw new Error("payload is required");
    if (payload.client_id === undefined || payload.client_id === null) {
      throw new Error("client_id is required");
    }
    if (!payload.column_name) {
      throw new Error("column_name is required");
    }

    return httpFetch<ApiResponse<RequiredColumn>>(
      `${API_BASE_URL}/required-columns`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * batchSave
   * - expects an array of required column objects: Array<Omit<RequiredColumn, 'required_id'>>
   * - backend endpoint: POST /required-columns/batch-add
   * - backend expects raw array in body (per router we made)
   */
  batchSave: async (
    columns: Array<Omit<RequiredColumn, "required_id">>
  ): Promise<ApiResponse<RequiredColumn[]>> => {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error("columns array is required");
    }

    // Basic frontend validation per-item
    const invalid = columns.some((c) => {
      return (
        c.client_id === undefined || c.client_id === null || !c.column_name
      );
    });

    if (invalid) {
      throw new Error(
        "Each required column must include client_id and column_name"
      );
    }

    return httpFetch<ApiResponse<RequiredColumn[]>>(
      `${API_BASE_URL}/required-columns/batch-add`,
      {
        method: "POST",
        body: JSON.stringify(columns), // backend expects array
      }
    );
  },

  // update single required column (partial)
  update: async (
    requiredId: number,
    payload: Partial<Omit<RequiredColumn, "required_id">>
  ): Promise<ApiResponse<RequiredColumn>> => {
    if (!requiredId) throw new Error("requiredId is required");

    // basic validation if provided in payload
    if (
      "client_id" in payload &&
      (payload.client_id === null || payload.client_id === undefined)
    ) {
      throw new Error("client_id cannot be empty");
    }
    if ("column_name" in payload && !payload.column_name) {
      throw new Error("column_name cannot be empty");
    }

    return httpFetch<ApiResponse<RequiredColumn>>(
      `${API_BASE_URL}/required-columns/${requiredId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },

  // delete single required column
  delete: async (requiredId: number): Promise<ApiResponse<null>> => {
    if (!requiredId) throw new Error("requiredId is required");
    return httpFetch<ApiResponse<null>>(
      `${API_BASE_URL}/required-columns/${requiredId}`,
      {
        method: "DELETE",
      }
    );
  },
};

/**
 * Transformation Config API
 */
export const transformationConfigApi = {
  getAll: async (
    clientId?: number
  ): Promise<ApiResponse<TransformationConfig[]>> => {
    const url = clientId
      ? `${API_BASE_URL}/transformation-configs?client_id=${clientId}`
      : `${API_BASE_URL}/transformation-configs`;
    return httpFetch<ApiResponse<TransformationConfig[]>>(url, {
      method: "GET",
    });
  },

  /**
   * create single transformation config
   */
  create: async (
    payload: Omit<
      TransformationConfig,
      "transform_id" | "created_at" | "created_by"
    >
  ): Promise<ApiResponse<TransformationConfig>> => {
    if (!payload) throw new Error("payload is required");
    if (payload.client_id === undefined || payload.client_id === null) {
      throw new Error("client_id is required");
    }
    if (!payload.proc_name) {
      throw new Error("proc_name is required");
    }

    return httpFetch<ApiResponse<TransformationConfig>>(
      `${API_BASE_URL}/transformation-configs`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * batchSave
   * - expects an array of transformation config objects: Array<Omit<TransformationConfig, 'transform_id'|'created_at'|'created_by'>>
   * - backend endpoint: POST /transformation-configs/batch-add
   * - backend expected body: raw array (not wrapped). Change if your backend expects wrapper.
   */
  batchSave: async (
    configs: Array<
      Omit<TransformationConfig, "transform_id" | "created_at" | "created_by">
    >
  ): Promise<ApiResponse<TransformationConfig[]>> => {
    if (!Array.isArray(configs) || configs.length === 0) {
      throw new Error("configs array is required");
    }

    // Basic frontend validation per-item
    const invalid = configs.some((c) => {
      return c.client_id === undefined || c.client_id === null || !c.proc_name;
    });

    if (invalid) {
      throw new Error(
        "Each transformation config must include client_id and proc_name"
      );
    }

    return httpFetch<ApiResponse<TransformationConfig[]>>(
      `${API_BASE_URL}/transformation-configs/batch-add`,
      {
        method: "POST",
        body: JSON.stringify(configs), // backend expects array
      }
    );
  },

  // update single config (partial)
  update: async (
    transformId: number,
    payload: Partial<
      Omit<TransformationConfig, "transform_id" | "created_at" | "created_by">
    >
  ): Promise<ApiResponse<TransformationConfig>> => {
    if (!transformId) throw new Error("transformId is required");

    // basic validation if provided in payload
    if (
      "client_id" in payload &&
      (payload.client_id === null || payload.client_id === undefined)
    ) {
      throw new Error("client_id cannot be empty");
    }
    if ("proc_name" in payload && !payload.proc_name) {
      throw new Error("proc_name cannot be empty");
    }

    return httpFetch<ApiResponse<TransformationConfig>>(
      `${API_BASE_URL}/transformation-configs/${transformId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },

  // delete single config
  delete: async (transformId: number): Promise<ApiResponse<null>> => {
    if (!transformId) throw new Error("transformId is required");
    return httpFetch<ApiResponse<null>>(
      `${API_BASE_URL}/transformation-configs/${transformId}`,
      { method: "DELETE" }
    );
  },
};

// Integration Config API
export const integrationConfigApi = {
  getAll: async (
    clientId?: number
  ): Promise<ApiResponse<IntegrationConfig[]>> => {
    const url = clientId
      ? `${API_BASE_URL}/integrations?client_id=${clientId}`
      : `${API_BASE_URL}/integrations`;
    return httpFetch<ApiResponse<IntegrationConfig[]>>(url, { method: "GET" });
  },

  /**
   * create single integration config
   */
  create: async (
    payload: Omit<
      IntegrationConfig,
      "integration_id" | "created_at" | "created_by"
    >
  ): Promise<ApiResponse<IntegrationConfig>> => {
    if (!payload) throw new Error("payload is required");
    if (payload.client_id === undefined || payload.client_id === null) {
      throw new Error("client_id is required");
    }
    if (!payload.proc_name) {
      throw new Error("proc_name is required");
    }

    return httpFetch<ApiResponse<IntegrationConfig>>(
      `${API_BASE_URL}/integrations`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * batchSave
   * - expects an array of integration config objects: Array<Omit<IntegrationConfig, 'integration_id'|'created_at'|'created_by'>>
   * - backend endpoint: POST /integrations/batch-add
   * - backend expected body: raw array (not wrapped). Change if your backend expects wrapper.
   */
  batchSave: async (
    configs: Array<
      Omit<IntegrationConfig, "integration_id" | "created_at" | "created_by">
    >
  ): Promise<ApiResponse<IntegrationConfig[]>> => {
    if (!Array.isArray(configs) || configs.length === 0) {
      throw new Error("configs array is required");
    }

    // Basic frontend validation per-item
    const invalid = configs.some((c) => {
      return c.client_id === undefined || c.client_id === null || !c.proc_name;
    });

    if (invalid) {
      throw new Error(
        "Each integration config must include client_id and proc_name"
      );
    }

    return httpFetch<ApiResponse<IntegrationConfig[]>>(
      `${API_BASE_URL}/integrations/batch-add`,
      {
        method: "POST",
        body: JSON.stringify(configs), // backend expects array
      }
    );
  },

  // update single config (partial)
  update: async (
    integrationId: number,
    payload: Partial<
      Omit<IntegrationConfig, "integration_id" | "created_at" | "created_by">
    >
  ): Promise<ApiResponse<IntegrationConfig>> => {
    if (!integrationId) throw new Error("integrationId is required");

    // basic validation if provided in payload
    if (
      "client_id" in payload &&
      (payload.client_id === null || payload.client_id === undefined)
    ) {
      throw new Error("client_id cannot be empty");
    }
    if ("proc_name" in payload && !payload.proc_name) {
      throw new Error("proc_name cannot be empty");
    }

    return httpFetch<ApiResponse<IntegrationConfig>>(
      `${API_BASE_URL}/integrations/${integrationId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },

  // delete single config
  delete: async (integrationId: number): Promise<ApiResponse<null>> => {
    if (!integrationId) throw new Error("integrationId is required");
    return httpFetch<ApiResponse<null>>(
      `${API_BASE_URL}/integrations/${integrationId}`,
      {
        method: "DELETE",
      }
    );
  },
};

// Integration Dependencies API

export const integrationDependenciesApi = {
  getAll: async (
    clientId?: number
  ): Promise<ApiResponse<IntegrationDependency[]>> => {
    const url = clientId
      ? `${API_BASE_URL}/integration-dependencies?client_id=${clientId}`
      : `${API_BASE_URL}/integration-dependencies`;
    return httpFetch<ApiResponse<IntegrationDependency[]>>(url, {
      method: "GET",
    });
  },

  /**
   * create single integration dependency
   */
  create: async (
    payload: Omit<IntegrationDependency, "dependency_id">
  ): Promise<ApiResponse<IntegrationDependency>> => {
    if (!payload) throw new Error("payload is required");
    if (payload.client_id === undefined || payload.client_id === null) {
      throw new Error("client_id is required");
    }
    if (!payload.fact_proc_name) {
      throw new Error("fact_proc_name is required");
    }
    if (!payload.dim_proc_name) {
      throw new Error("dim_proc_name is required");
    }

    return httpFetch<ApiResponse<IntegrationDependency>>(
      `${API_BASE_URL}/integration-dependencies`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * batchSave
   * - expects an array of integration dependency objects: Array<Omit<IntegrationDependency, 'dependency_id'>>
   * - backend endpoint: POST /integration-dependencies/batch-add
   * - backend expected body: raw array (not wrapped). Change if your backend expects wrapper.
   */
  batchSave: async (
    rows: Array<Omit<IntegrationDependency, "dependency_id">>
  ): Promise<ApiResponse<IntegrationDependency[]>> => {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("rows array is required");
    }

    // Basic frontend validation per-item
    const invalid = rows.some((r) => {
      return (
        r.client_id === undefined ||
        r.client_id === null ||
        !r.fact_proc_name ||
        !r.dim_proc_name
      );
    });

    if (invalid) {
      throw new Error(
        "Each integration dependency must include client_id, fact_proc_name and dim_proc_name"
      );
    }

    return httpFetch<ApiResponse<IntegrationDependency[]>>(
      `${API_BASE_URL}/integration-dependencies/batch-add`,
      {
        method: "POST",
        body: JSON.stringify(rows), // backend expects array
      }
    );
  },

  // update single dependency (partial)
  update: async (
    dependencyId: number,
    payload: Partial<Omit<IntegrationDependency, "dependency_id">>
  ): Promise<ApiResponse<IntegrationDependency>> => {
    if (!dependencyId) throw new Error("dependencyId is required");

    // basic validation if provided in payload
    if (
      "client_id" in payload &&
      (payload.client_id === null || payload.client_id === undefined)
    ) {
      throw new Error("client_id cannot be empty");
    }
    if (
      "fact_proc_name" in payload &&
      payload.fact_proc_name !== undefined &&
      !payload.fact_proc_name
    ) {
      throw new Error("fact_proc_name cannot be empty");
    }
    if (
      "dim_proc_name" in payload &&
      payload.dim_proc_name !== undefined &&
      !payload.dim_proc_name
    ) {
      throw new Error("dim_proc_name cannot be empty");
    }

    return httpFetch<ApiResponse<IntegrationDependency>>(
      `${API_BASE_URL}/integration-dependencies/${dependencyId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },

  // delete single dependency
  delete: async (dependencyId: number): Promise<ApiResponse<null>> => {
    if (!dependencyId) throw new Error("dependencyId is required");
    return httpFetch<ApiResponse<null>>(
      `${API_BASE_URL}/integration-dependencies/${dependencyId}`,
      {
        method: "DELETE",
      }
    );
  },
};

// MV Refresh Config API (http version)

export const mvRefreshConfigApi = {
  getAll: async (
    clientId?: number
  ): Promise<ApiResponse<MvRefreshConfig[]>> => {
    const url = clientId
      ? `${API_BASE_URL}/mv-refresh-configs?client_id=${clientId}`
      : `${API_BASE_URL}/mv-refresh-configs`;
    return httpFetch<ApiResponse<MvRefreshConfig[]>>(url, { method: "GET" });
  },

  getById: async (id: number): Promise<ApiResponse<MvRefreshConfig>> => {
    if (!id) throw new Error("id is required");
    return httpFetch<ApiResponse<MvRefreshConfig>>(
      `${API_BASE_URL}/mv-refresh-configs/${id}`,
      { method: "GET" }
    );
  },

  create: async (
    payload: Omit<MvRefreshConfig, "mv_id" | "created_at" | "created_by">
  ): Promise<ApiResponse<MvRefreshConfig>> => {
    if (!payload) throw new Error("payload is required");
    if (payload.client_id === undefined || payload.client_id === null) {
      throw new Error("client_id is required");
    }
    if (!payload.mv_proc_name) {
      throw new Error("mv_proc_name is required");
    }

    return httpFetch<ApiResponse<MvRefreshConfig>>(
      `${API_BASE_URL}/mv-refresh-configs`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * batchSave
   * - expects an array of Omit<MvRefreshConfig, 'mv_id'|'created_at'|'created_by'>
   * - backend endpoint: POST /mv-refresh-configs/batch-add
   * - backend expected body: raw array (not wrapped). Adjust if backend expects wrapper.
   */
  batchSave: async (
    configs: Array<Omit<MvRefreshConfig, "mv_id" | "created_at" | "created_by">>
  ): Promise<ApiResponse<MvRefreshConfig[]>> => {
    if (!Array.isArray(configs) || configs.length === 0) {
      throw new Error("configs array is required");
    }

    const invalid = configs.some((c) => {
      return (
        c.client_id === undefined || c.client_id === null || !c.mv_proc_name
      );
    });

    if (invalid) {
      throw new Error(
        "Each MV refresh config must include client_id and mv_proc_name"
      );
    }

    return httpFetch<ApiResponse<MvRefreshConfig[]>>(
      `${API_BASE_URL}/mv-refresh-configs/batch-add`,
      {
        method: "POST",
        body: JSON.stringify(configs),
      }
    );
  },

  update: async (
    id: number,
    payload: Partial<
      Omit<MvRefreshConfig, "mv_id" | "created_at" | "created_by">
    >
  ): Promise<ApiResponse<MvRefreshConfig>> => {
    if (!id) throw new Error("id is required");

    if (
      "client_id" in payload &&
      (payload.client_id === null || payload.client_id === undefined)
    ) {
      throw new Error("client_id cannot be empty");
    }
    if (
      "mv_proc_name" in payload &&
      payload.mv_proc_name !== undefined &&
      !payload.mv_proc_name
    ) {
      throw new Error("mv_proc_name cannot be empty");
    }

    return httpFetch<ApiResponse<MvRefreshConfig>>(
      `${API_BASE_URL}/mv-refresh-configs/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },

  delete: async (id: number): Promise<ApiResponse<null>> => {
    if (!id) throw new Error("id is required");
    return httpFetch<ApiResponse<null>>(
      `${API_BASE_URL}/mv-refresh-configs/${id}`,
      { method: "DELETE" }
    );
  },
};


//                           //
// Audit Log APIs (Read-only)//
//                           //
// File Audit Log API
export const fileAuditLogApi = {
  getAll: async (
    clientId?: number,
    batchId?: string
  ): Promise<ApiResponse<FileAuditLog[]>> => {
    let url = `${API_BASE_URL}/audit-logs/files`;
    const params = [];
    if (clientId) params.push(`client_id=${clientId}`);
    if (batchId) params.push(`batch_id=${batchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return httpFetch<ApiResponse<FileAuditLog[]>>(url, { method: "GET" });
  },
};

// Mapping Validation Log API
export const mappingValidationLogApi = {
  getAll: async (
    clientId?: number,
    batchId?: string
  ): Promise<ApiResponse<MappingValidationLog[]>> => {
    let url = `${API_BASE_URL}/audit-logs/mapping`;
    const params = [];
    if (clientId) params.push(`client_id=${clientId}`);
    if (batchId) params.push(`batch_id=${batchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return httpFetch<ApiResponse<MappingValidationLog[]>>(url, { method: "GET" });
  },
};

// Row Validation Log API
export const rowValidationLogApi = {
  getAll: async (
    clientId?: number,
    batchId?: string
  ): Promise<ApiResponse<RowValidationLog[]>> => {
    let url = `${API_BASE_URL}/audit-logs/rows`;
    const params = [];
    if (clientId) params.push(`client_id=${clientId}`);
    if (batchId) params.push(`batch_id=${batchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return httpFetch<ApiResponse<RowValidationLog[]>>(url, { method: "GET" });
  },
};

// Load Error Log API
export const loadErrorLogApi = {
  getAll: async (
    clientId?: number,
    batchId?: string
  ): Promise<ApiResponse<LoadErrorLog[]>> => {
    let url = `${API_BASE_URL}/audit-logs/load-errors`;
    const params = [];
    if (clientId) params.push(`client_id=${clientId}`);
    if (batchId) params.push(`batch_id=${batchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return httpFetch<ApiResponse<LoadErrorLog[]>>(url, { method: "GET" });
  },
};

// Transformation Log API
export const transformationLogApi = {
  getAll: async (
    clientId?: number,
    batchId?: string
  ): Promise<ApiResponse<TransformationLog[]>> => {
    let url = `${API_BASE_URL}/audit-logs/transformations`;
    const params = [];
    if (clientId) params.push(`client_id=${clientId}`);
    if (batchId) params.push(`batch_id=${batchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return httpFetch<ApiResponse<TransformationLog[]>>(url, { method: "GET" });
  },
};

// Job Execution Log API
export const jobExecutionLogApi = {
  getAll: async (
    clientId?: number,
    batchId?: string
  ): Promise<ApiResponse<JobExecutionLog[]>> => {
    let url = `${API_BASE_URL}/audit-logs/jobs`;
    const params = [];
    if (clientId) params.push(`client_id=${clientId}`);
    if (batchId) params.push(`batch_id=${batchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return httpFetch<ApiResponse<JobExecutionLog[]>>(url, { method: "GET" });
  },
};

// Integration Log API
export const integrationLogApi = {
  getAll: async (
    clientId?: number,
    batchId?: string
  ): Promise<ApiResponse<IntegrationLog[]>> => {
    let url = `${API_BASE_URL}/audit-logs/integrations`;
    const params = [];
    if (clientId) params.push(`client_id=${clientId}`);
    if (batchId) params.push(`batch_id=${batchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return httpFetch<ApiResponse<IntegrationLog[]>>(url, { method: "GET" });
  },
};

// MV Refresh Log API
export const mvRefreshLogApi = {
  getAll: async (
    clientId?: number,
    batchId?: string
  ): Promise<ApiResponse<MvRefreshLog[]>> => {
    let url = `${API_BASE_URL}/audit-logs/mv-refresh`;
    const params = [];
    if (clientId) params.push(`client_id=${clientId}`);
    if (batchId) params.push(`batch_id=${batchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return httpFetch<ApiResponse<MvRefreshLog[]>>(url, { method: "GET" });
  },
};

// Batch API
export const batchApi = {
  getAll: async (): Promise<ApiResponse<string[]>> => {
    const url = `${API_BASE_URL}/batches`;
    return httpFetch<ApiResponse<string[]>>(url, { method: "GET" });
  },
};