import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity,
  Eye,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/table/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { appFetch } from "@/lib/appApi";
import { cn } from "@/lib/utils";


type ActivitySummary = {
  total_actions: number;
  insert_count: number;
  update_count: number;
  delete_count: number;
  active_users: number;
};

type ActivityRecord = {
  activity_id: number;
  batch_id: string;
  module_key: string;
  module_label: string;
  table_name: string;
  record_id: string;
  record_label?: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  actor_user_id?: number | null;
  actor_username: string;
  actor_full_name: string;
  changed_fields: string[];
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  activity_source: string;
  changed_at: string;
};

type ModuleOption = {
  value: string;
  label: string;
};

type UserOption = {
  user_id?: number | null;
  full_name: string;
  username: string;
};

type ActivityReportData = {
  items: ActivityRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: ActivitySummary;
  module_options: ModuleOption[];
  user_options: UserOption[];
  action_options: string[];
};

type Filters = {
  dateFrom: string;
  dateTo: string;
  moduleKey: string;
  action: string;
  userId: string;
  search: string;
};

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultFilters(): Filters {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: localDateString(firstDay),
    dateTo: localDateString(now),
    moduleKey: "",
    action: "",
    userId: "",
    search: "",
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-muted-foreground">NULL</span>;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function actionStyle(action: ActivityRecord["action"]) {
  if (action === "INSERT") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (action === "DELETE") {
    return "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
  }
  return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
}

function actionIcon(action: ActivityRecord["action"]) {
  if (action === "INSERT") return <PlusCircle className="h-3.5 w-3.5" />;
  if (action === "DELETE") return <Trash2 className="h-3.5 w-3.5" />;
  return <Pencil className="h-3.5 w-3.5" />;
}

export default function ActivityReportPage() {
  const { user } = useAuth();
  const allowed = Boolean(user && user.role !== "INTERN");
  const [data, setData] = useState<ActivityReportData | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<Filters>(() => defaultFilters());
  const [draftSearch, setDraftSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ActivityRecord | null>(null);

  const load = async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (filters.dateFrom) query.set("date_from", filters.dateFrom);
      if (filters.dateTo) query.set("date_to", filters.dateTo);
      if (filters.moduleKey) query.set("module_key", filters.moduleKey);
      if (filters.action) query.set("action", filters.action);
      if (filters.userId) query.set("user_id", filters.userId);
      if (filters.search) query.set("search", filters.search);

      const response = await appFetch<ActivityReportData>(
        `/activity-report?${query.toString()}`
      );
      setData(response.data);
      if (response.data.page !== page) setPage(response.data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil Activity Report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [
    allowed,
    page,
    pageSize,
    filters.dateFrom,
    filters.dateTo,
    filters.moduleKey,
    filters.action,
    filters.userId,
    filters.search,
  ]);

  const detailFields = useMemo(() => {
    if (!detail) return [];
    const ordered = detail.changed_fields.length
      ? detail.changed_fields
      : Array.from(
          new Set([
            ...Object.keys(detail.old_values || {}),
            ...Object.keys(detail.new_values || {}),
          ])
        );
    return ordered;
  }, [detail]);

  if (!allowed) return <Navigate to="/metadata/odists-parsing" replace />;

  const applySearch = (event?: FormEvent) => {
    event?.preventDefault();
    setPage(1);
    setFilters((current) => ({ ...current, search: draftSearch.trim() }));
  };

  const resetFilters = () => {
    const next = defaultFilters();
    setDraftSearch("");
    setFilters(next);
    setPage(1);
  };

  const summary = data?.summary || {
    total_actions: 0,
    insert_count: 0,
    update_count: 0,
    delete_count: 0,
    active_users: 0,
  };

  return (
    <div className="min-w-0 space-y-4 p-3 text-sm sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold sm:text-2xl">Activity Report</h1>
        <p className="text-sm text-muted-foreground">
          Audit trail perubahan master data: siapa yang melakukan perubahan, apa yang diubah, dan kapan perubahan terjadi.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Activity</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{summary.total_actions}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <PlusCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Insert</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{summary.insert_count}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Pencil className="h-5 w-5 text-amber-600" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Update</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{summary.update_count}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Trash2 className="h-5 w-5 text-red-600" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Delete</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{summary.delete_count}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Active Users</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{summary.active_users}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">DARI TANGGAL</span>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, dateFrom: event.target.value }));
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">SAMPAI TANGGAL</span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, dateTo: event.target.value }));
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">MASTER / MODULE</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={filters.moduleKey}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, moduleKey: event.target.value }));
                }}
              >
                <option value="">Semua master</option>
                {(data?.module_options || []).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">ACTION</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={filters.action}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, action: event.target.value }));
                }}
              >
                <option value="">Semua action</option>
                {(data?.action_options || ["INSERT", "UPDATE", "DELETE"]).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">USER</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={filters.userId}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, userId: event.target.value }));
                }}
              >
                <option value="">Semua user</option>
                {(data?.user_options || [])
                  .filter((option) => option.user_id !== null && option.user_id !== undefined)
                  .map((option) => (
                    <option key={`${option.user_id}-${option.username}`} value={String(option.user_id)}>
                      {option.full_name} ({option.username})
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={applySearch}>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cari user, master, ID record, nama/kode record, atau field..."
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
              />
            </div>
            <Button type="submit">Cari</Button>
            <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>Refresh</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardContent className="space-y-3 p-3 sm:p-6">
          <div className="w-full overflow-auto rounded-md border">
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="border-b border-r p-3 text-left">WAKTU</th>
                  <th className="border-b border-r p-3 text-left">USER</th>
                  <th className="border-b border-r p-3 text-left">MASTER</th>
                  <th className="border-b border-r p-3 text-left">ACTION</th>
                  <th className="border-b border-r p-3 text-left">RECORD</th>
                  <th className="border-b border-r p-3 text-left">FIELD BERUBAH</th>
                  <th className="border-b p-3 text-center">DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr><td colSpan={7} className="p-8 text-center">Memuat Activity Report...</td></tr>
                ) : data?.items.length ? (
                  data.items.map((item) => (
                    <tr key={item.activity_id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap border-b border-r p-3 align-top tabular-nums">
                        {formatDateTime(item.changed_at)}
                      </td>
                      <td className="border-b border-r p-3 align-top">
                        <div className="font-medium">{item.actor_full_name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{item.actor_username}</div>
                      </td>
                      <td className="border-b border-r p-3 align-top">
                        <div className="font-medium">{item.module_label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{item.table_name}</div>
                      </td>
                      <td className="border-b border-r p-3 align-top">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", actionStyle(item.action))}>
                          {actionIcon(item.action)}
                          {item.action}
                        </span>
                      </td>
                      <td className="max-w-[280px] border-b border-r p-3 align-top">
                        <div className="font-medium">ID {item.record_id}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground" title={item.record_label || ""}>
                          {item.record_label || "-"}
                        </div>
                      </td>
                      <td className="max-w-[360px] border-b border-r p-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {item.changed_fields.slice(0, 5).map((field) => (
                            <span key={field} className="rounded-md border bg-muted/40 px-2 py-1 text-xs">
                              {field.replace(/_/g, " ")}
                            </span>
                          ))}
                          {item.changed_fields.length > 5 && (
                            <span className="rounded-md border bg-muted/40 px-2 py-1 text-xs">
                              +{item.changed_fields.length - 5}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-b p-3 text-center align-top">
                        <Button size="sm" variant="outline" onClick={() => setDetail(item)}>
                          <Eye className="h-4 w-4" />
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Belum ada activity pada filter yang dipilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={data?.page ?? page}
            pageSize={pageSize}
            totalPages={data?.total_pages ?? 1}
            totalRows={data?.total ?? 0}
            loading={loading}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
          />
        </CardContent>
      </Card>

      {detail && (
        <div className="fixed inset-0 z-[130] overflow-y-auto bg-black/50 p-0 sm:p-6">
          <div className="flex min-h-full items-start justify-center sm:items-center sm:py-4">
            <Card className="flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:rounded-xl">
              <CardHeader className="shrink-0 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Activity Detail</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {detail.module_label} · ID {detail.record_id} · {formatDateTime(detail.changed_at)}
                    </p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", actionStyle(detail.action))}>
                    {actionIcon(detail.action)}
                    {detail.action}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">USER</div>
                    <div className="mt-1 font-medium">{detail.actor_full_name}</div>
                    <div className="text-xs text-muted-foreground">{detail.actor_username}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">MASTER</div>
                    <div className="mt-1 font-medium">{detail.module_label}</div>
                    <div className="text-xs text-muted-foreground">{detail.table_name}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">RECORD</div>
                    <div className="mt-1 font-medium">ID {detail.record_id}</div>
                    <div className="truncate text-xs text-muted-foreground" title={detail.record_label || ""}>{detail.record_label || "-"}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">BATCH ID</div>
                    <div className="mt-1 break-all font-mono text-xs">{detail.batch_id}</div>
                  </div>
                </div>

                <div className="overflow-auto rounded-lg border">
                  <table className="min-w-[680px] w-full border-collapse text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="w-[28%] border-b border-r p-3 text-left">FIELD</th>
                        <th className="w-[36%] border-b border-r p-3 text-left">BEFORE</th>
                        <th className="w-[36%] border-b p-3 text-left">AFTER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailFields.map((field) => (
                        <tr key={field}>
                          <td className="border-b border-r p-3 font-medium">{field.replace(/_/g, " ").toUpperCase()}</td>
                          <td className="break-words border-b border-r p-3">{displayValue(detail.old_values?.[field])}</td>
                          <td className="break-words border-b p-3">{displayValue(detail.new_values?.[field])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              <div className="flex shrink-0 justify-end border-t p-4 sm:px-6">
                <Button onClick={() => setDetail(null)}>Close</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
