import { useEffect, useMemo, useState } from "react";
import {
  PagedResult,
  parsingReportApi,
  ParsingActivityItem,
  ParsingEffectiveItem,
  ParsingMemberSummary,
  ParsingReportSummary,
} from "@/lib/appApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/table/TablePagination";

const CHANGE_TYPES = [
  "PARSING",
  "REVISI DATA",
  "PARSING & REVISI DATA",
];
const REVERT_STATES = ["CHANGE", "PARTIAL REVERT", "REVERT"];
const EFFECTIVE_REVERT_STATES = [...REVERT_STATES, "UNTRACKED"];

type SortDirection = "asc" | "desc";
type SummarySortKey =
  | "member_name"
  | "active_parsing_rows"
  | "active_revision_rows"
  | "active_parsing_revision_rows"
  | "active_revised_fields"
  | "total_edit_activities"
  | "reverted_activities"
  | "partial_revert_activities";

const SUMMARY_COLUMNS: { label: string; key: SummarySortKey }[] = [
  { label: "ANGGOTA", key: "member_name" },
  { label: "PARSING AKTIF", key: "active_parsing_rows" },
  { label: "REVISI AKTIF", key: "active_revision_rows" },
  { label: "PARSING + REVISI", key: "active_parsing_revision_rows" },
  { label: "FIELD DIREVISI", key: "active_revised_fields" },
  { label: "AKTIVITAS", key: "total_edit_activities" },
  { label: "REVERT", key: "reverted_activities" },
  { label: "PARTIAL REVERT", key: "partial_revert_activities" },
];

const EFFECTIVE_COLUMNS = [
  { label: "ODISTS ID", key: "odist_id" },
  { label: "ANGGOTA", key: "member_name" },
  { label: "JENIS", key: "status" },
  { label: "REVERT STATE", key: "revert_state" },
  { label: "ORIGINAL OGAL", key: "original_ogal_id" },
  { label: "CURRENT OGAL", key: "current_ogal_id" },
  { label: "FIELD REVISI MILIK ANGGOTA", key: "owned_revision_fields" },
  { label: "OUTLET", key: "cust_name" },
  { label: "CITY", key: "city" },
  { label: "PROVINCE", key: "province" },
  { label: "LAST EDITED", key: "last_edited_at" },
  { label: "ACTIONS", key: "total_actions" },
  { label: "TRACKING", key: "tracking" },
] as const;

const HISTORY_COLUMNS = [
  { label: "WAKTU", key: "changed_at" },
  { label: "ODISTS ID", key: "odist_id" },
  { label: "ANGGOTA", key: "member_name" },
  { label: "JENIS", key: "change_type" },
  { label: "REVERT STATE", key: "revert_state" },
  { label: "FIELDS", key: "changed_fields" },
  { label: "BEFORE → AFTER", key: "before_after" },
] as const;

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
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

function displayField(field: string) {
  return field.replace(/_/g, " ").toUpperCase();
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "NULL";
  return String(value);
}

function normalizeComparable(value: unknown): string | number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) return value.join(" ").toUpperCase();
  return String(value ?? "").trim().toUpperCase();
}

function compareValues(left: unknown, right: unknown, direction: SortDirection) {
  const leftValue = normalizeComparable(left);
  const rightValue = normalizeComparable(right);
  let result = 0;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    result = leftValue - rightValue;
  } else {
    result = String(leftValue).localeCompare(String(rightValue), "id", {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? result : -result;
}

function statusClass(status: string) {
  if (status === "PARSING") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
  }
  if (status === "REVISI DATA") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (status === "PARSING & REVISI DATA") {
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300";
  }
  if (status === "REVERT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "PARTIAL REVERT") {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300";
  }
  if (status === "UNTRACKED") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
        value
      )}`}
    >
      {value}
    </span>
  );
}

function SortHeader({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: SortDirection;
  onSort: (column: string) => void;
}) {
  const active = sortBy === column;
  return (
    <th className="border-b p-0 text-left text-xs font-semibold">
      <button
        type="button"
        className="flex w-full items-center gap-1 whitespace-nowrap p-3 text-left hover:bg-muted/60"
        title={`Sort ${label}`}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        <span className={active ? "text-foreground" : "text-muted-foreground/40"}>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function ParsingReportPage() {
  const now = useMemo(() => new Date(), []);
  const firstDay = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
    [now]
  );

  const [tab, setTab] = useState<"effective" | "history">("effective");
  const [dateFrom, setDateFrom] = useState(dateInputValue(firstDay));
  const [dateTo, setDateTo] = useState(dateInputValue(now));
  const [memberFilter, setMemberFilter] = useState("");

  const [odistIdInput, setOdistIdInput] = useState("");
  const [appliedOdistId, setAppliedOdistId] = useState<number | null>(null);
  const [effectiveType, setEffectiveType] = useState("");
  const [historyType, setHistoryType] = useState("");
  const [effectiveRevertState, setEffectiveRevertState] = useState("");
  const [historyRevertState, setHistoryRevertState] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [summarySortBy, setSummarySortBy] =
    useState<SummarySortKey>("member_name");
  const [summarySortDir, setSummarySortDir] =
    useState<SortDirection>("asc");
  const [effectiveSortBy, setEffectiveSortBy] = useState("last_edited_at");
  const [effectiveSortDir, setEffectiveSortDir] =
    useState<SortDirection>("desc");
  const [historySortBy, setHistorySortBy] = useState("changed_at");
  const [historySortDir, setHistorySortDir] =
    useState<SortDirection>("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [summary, setSummary] = useState<ParsingReportSummary | null>(null);
  const [effective, setEffective] =
    useState<PagedResult<ParsingEffectiveItem> | null>(null);
  const [history, setHistory] =
    useState<PagedResult<ParsingActivityItem> | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState("");

  const selectedUserId = memberFilter ? Number(memberFilter) : null;

  useEffect(() => {
    let cancelled = false;
    setLoadingSummary(true);
    setError("");

    parsingReportApi
      .summary({ dateFrom, dateTo, userId: selectedUserId })
      .then((response) => {
        if (!cancelled) setSummary(response.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal mengambil summary");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, memberFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoadingTable(true);
    setError("");

    if (tab === "effective") {
      parsingReportApi
        .effective({
          page,
          pageSize,
          odistId: appliedOdistId,
          userId: selectedUserId,
          status: effectiveType,
          revertState: effectiveRevertState,
          search: appliedSearch,
          sortBy: effectiveSortBy,
          sortDir: effectiveSortDir,
        })
        .then((response) => {
          if (!cancelled) setEffective(response.data);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : "Gagal mengambil effective result"
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingTable(false);
        });
    } else {
      parsingReportApi
        .history({
          page,
          pageSize,
          dateFrom,
          dateTo,
          odistId: appliedOdistId,
          userId: selectedUserId,
          changeType: historyType,
          revertState: historyRevertState,
          search: appliedSearch,
          sortBy: historySortBy,
          sortDir: historySortDir,
        })
        .then((response) => {
          if (!cancelled) setHistory(response.data);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : "Gagal mengambil activity history"
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingTable(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    tab,
    page,
    pageSize,
    dateFrom,
    dateTo,
    memberFilter,
    appliedOdistId,
    effectiveType,
    historyType,
    effectiveRevertState,
    historyRevertState,
    appliedSearch,
    effectiveSortBy,
    effectiveSortDir,
    historySortBy,
    historySortDir,
  ]);

  const sortedMembers = useMemo(() => {
    const members = [...(summary?.members || [])];
    members.sort((left, right) =>
      compareValues(left[summarySortBy], right[summarySortBy], summarySortDir)
    );
    return members;
  }, [summary?.members, summarySortBy, summarySortDir]);

  const activePage = tab === "effective" ? effective : history;
  const activeType = tab === "effective" ? effectiveType : historyType;
  const activeRevertState =
    tab === "effective" ? effectiveRevertState : historyRevertState;
  const revertOptions =
    tab === "effective" ? EFFECTIVE_REVERT_STATES : REVERT_STATES;

  const applyTableFilters = () => {
    const trimmedId = odistIdInput.trim();
    setAppliedOdistId(trimmedId ? Number(trimmedId) : null);
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  const resetTableFilters = () => {
    setOdistIdInput("");
    setAppliedOdistId(null);
    setSearchInput("");
    setAppliedSearch("");
    if (tab === "effective") {
      setEffectiveType("");
      setEffectiveRevertState("");
    } else {
      setHistoryType("");
      setHistoryRevertState("");
    }
    setPage(1);
  };

  const toggleSummarySort = (column: string) => {
    const safeColumn = column as SummarySortKey;
    if (summarySortBy === safeColumn) {
      setSummarySortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSummarySortBy(safeColumn);
      setSummarySortDir("asc");
    }
  };

  const toggleDetailSort = (column: string) => {
    setPage(1);
    if (tab === "effective") {
      if (effectiveSortBy === column) {
        setEffectiveSortDir((current) =>
          current === "asc" ? "desc" : "asc"
        );
      } else {
        setEffectiveSortBy(column);
        setEffectiveSortDir("asc");
      }
    } else if (historySortBy === column) {
      setHistorySortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setHistorySortBy(column);
      setHistorySortDir("asc");
    }
  };

  return (
    <div className="min-w-0 space-y-4 p-3 text-sm sm:p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold sm:text-2xl">PARSING REPORT</h1>
        <p className="text-sm text-muted-foreground">
          Effective Result membandingkan data saat ini dengan baseline awal.
          Activity History menampilkan seluruh aktivitas before-after, termasuk
          revert.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PERIODE DAN ANGGOTA</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              DARI TANGGAL
            </span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              SAMPAI TANGGAL
            </span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              ANGGOTA
            </span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={memberFilter}
              onChange={(event) => {
                setMemberFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">SEMUA ANGGOTA</option>
              {(summary?.member_options || [])
                .filter((member) => member.user_id !== null)
                .map((member) => (
                  <option
                    key={String(member.user_id)}
                    value={String(member.user_id)}
                  >
                    {member.member_name} ({member.username})
                  </option>
                ))}
            </select>
          </label>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ["PARSING AKTIF", summary?.totals.active_parsing_rows ?? 0],
          ["REVISI AKTIF", summary?.totals.active_revision_rows ?? 0],
          ["PARSING + REVISI", summary?.totals.active_parsing_revision_rows ?? 0],
          ["FIELD DIREVISI", summary?.totals.active_revised_fields ?? 0],
          ["AKTIVITAS", summary?.totals.total_edit_activities ?? 0],
          ["REVERT", summary?.totals.reverted_activities ?? 0],
          ["PARTIAL REVERT", summary?.totals.partial_revert_activities ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {loadingSummary ? "..." : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">SUMMARY PER ANGGOTA</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                {SUMMARY_COLUMNS.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    column={column.key}
                    sortBy={summarySortBy}
                    sortDir={summarySortDir}
                    onSort={toggleSummarySort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMembers.length ? (
                sortedMembers.map((member: ParsingMemberSummary) => (
                  <tr
                    key={`${member.user_id}-${member.username}`}
                    className="hover:bg-muted/30"
                  >
                    <td className="border-b p-3">
                      <div className="font-medium">{member.member_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.username}
                      </div>
                    </td>
                    <td className="border-b p-3 tabular-nums">
                      {member.active_parsing_rows}
                    </td>
                    <td className="border-b p-3 tabular-nums">
                      {member.active_revision_rows}
                    </td>
                    <td className="border-b p-3 tabular-nums">
                      {member.active_parsing_revision_rows}
                    </td>
                    <td className="border-b p-3 tabular-nums">
                      {member.active_revised_fields}
                    </td>
                    <td className="border-b p-3 tabular-nums">
                      {member.total_edit_activities}
                    </td>
                    <td className="border-b p-3 tabular-nums">
                      {member.reverted_activities}
                    </td>
                    <td className="border-b p-3 tabular-nums">
                      {member.partial_revert_activities}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Belum ada aktivitas parsing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 rounded-lg border bg-muted/30 p-1 sm:w-[420px]">
        <Button
          variant={tab === "effective" ? "default" : "ghost"}
          onClick={() => {
            setTab("effective");
            setPage(1);
          }}
        >
          EFFECTIVE RESULT
        </Button>
        <Button
          variant={tab === "history" ? "default" : "ghost"}
          onClick={() => {
            setTab("history");
            setPage(1);
          }}
        >
          ACTIVITY HISTORY
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            FILTER {tab === "effective" ? "EFFECTIVE RESULT" : "ACTIVITY HISTORY"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              ODISTS ID
            </span>
            <Input
              inputMode="numeric"
              value={odistIdInput}
              placeholder="Exact ODISTS ID"
              onChange={(event) =>
                setOdistIdInput(event.target.value.replace(/[^0-9]/g, ""))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") applyTableFilters();
              }}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              JENIS
            </span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={activeType}
              onChange={(event) => {
                if (tab === "effective") setEffectiveType(event.target.value);
                else setHistoryType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">SEMUA JENIS</option>
              {CHANGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              REVERT STATE
            </span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={activeRevertState}
              onChange={(event) => {
                if (tab === "effective") {
                  setEffectiveRevertState(event.target.value);
                } else {
                  setHistoryRevertState(event.target.value);
                }
                setPage(1);
              }}
            >
              <option value="">SEMUA REVERT STATE</option>
              {revertOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              CARI
            </span>
            <Input
              value={searchInput}
              placeholder="Anggota, outlet, kota..."
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyTableFilters();
              }}
            />
          </label>

          <div className="flex items-end gap-2">
            <Button className="flex-1" onClick={applyTableFilters}>
              Terapkan
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={resetTableFilters}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-0 sm:p-4">
          <div className="max-h-[62dvh] w-full touch-auto overflow-auto overscroll-contain rounded-md border-0 sm:max-h-[68vh] sm:border">
            {tab === "effective" ? (
              <table className="w-full min-w-[1550px] text-sm">
                <thead className="sticky top-0 z-10 bg-background shadow-sm">
                  <tr>
                    {EFFECTIVE_COLUMNS.map((column) => (
                      <SortHeader
                        key={column.key}
                        label={column.label}
                        column={column.key}
                        sortBy={effectiveSortBy}
                        sortDir={effectiveSortDir}
                        onSort={toggleDetailSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingTable && !effective ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center">
                        Memuat report...
                      </td>
                    </tr>
                  ) : effective?.items.length ? (
                    effective.items.map((item) => (
                      <tr
                        key={`${item.odist_id}-${
                          item.member_user_id ?? "untracked"
                        }`}
                        className="hover:bg-muted/30"
                      >
                        <td className="border-b p-3 font-medium tabular-nums">
                          {item.odist_id}
                        </td>
                        <td className="border-b p-3">
                          <div className="font-medium">{item.member_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.username}
                          </div>
                        </td>
                        <td className="border-b p-3">
                          <StatusBadge value={item.status} />
                        </td>
                        <td className="border-b p-3">
                          <StatusBadge value={item.revert_state} />
                        </td>
                        <td className="border-b p-3 tabular-nums">
                          {displayValue(item.original_ogal_id)}
                        </td>
                        <td className="border-b p-3 tabular-nums">
                          {displayValue(item.current_ogal_id)}
                        </td>
                        <td className="border-b p-3">
                          {item.owned_revision_fields.length
                            ? item.owned_revision_fields
                                .map(displayField)
                                .join(", ")
                            : "-"}
                        </td>
                        <td
                          className="max-w-72 truncate border-b p-3"
                          title={displayValue(item.cust_name)}
                        >
                          {displayValue(item.cust_name)}
                        </td>
                        <td className="border-b p-3">
                          {displayValue(item.city)}
                        </td>
                        <td className="border-b p-3">
                          {displayValue(item.province)}
                        </td>
                        <td className="whitespace-nowrap border-b p-3">
                          {formatDate(item.last_edited_at)}
                        </td>
                        <td className="border-b p-3 tabular-nums">
                          {item.total_actions}
                        </td>
                        <td className="border-b p-3">
                          {item.is_untracked ? (
                            <StatusBadge value="UNTRACKED" />
                          ) : (
                            "TRACKED"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={13}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Tidak ada hasil efektif sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[1350px] text-sm">
                <thead className="sticky top-0 z-10 bg-background shadow-sm">
                  <tr>
                    {HISTORY_COLUMNS.map((column) => (
                      <SortHeader
                        key={column.key}
                        label={column.label}
                        column={column.key}
                        sortBy={historySortBy}
                        sortDir={historySortDir}
                        onSort={toggleDetailSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingTable && !history ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        Memuat histori...
                      </td>
                    </tr>
                  ) : history?.items.length ? (
                    history.items.map((item) => (
                      <tr key={item.audit_id} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap border-b p-3">
                          {formatDate(item.changed_at)}
                        </td>
                        <td className="border-b p-3 font-medium tabular-nums">
                          {item.odist_id}
                        </td>
                        <td className="border-b p-3">
                          <div className="font-medium">{item.member_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.username}
                          </div>
                        </td>
                        <td className="border-b p-3">
                          <StatusBadge value={item.change_type} />
                        </td>
                        <td className="border-b p-3">
                          <StatusBadge value={item.revert_state} />
                        </td>
                        <td className="border-b p-3">
                          {item.changed_fields.map(displayField).join(", ")}
                        </td>
                        <td className="border-b p-3">
                          <div className="space-y-1">
                            {item.changed_fields.map((field) => (
                              <div
                                key={field}
                                className="grid grid-cols-[150px_1fr] gap-2 text-xs"
                              >
                                <span className="font-semibold">
                                  {displayField(field)}
                                </span>
                                <span className="break-words text-muted-foreground">
                                  {displayValue(item.old_values[field])} →{" "}
                                  {displayValue(item.new_values[field])}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Tidak ada aktivitas sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-3 pb-3 sm:px-0 sm:pb-0">
            <TablePagination
              page={activePage?.page ?? page}
              pageSize={pageSize}
              totalPages={activePage?.total_pages ?? 1}
              totalRows={activePage?.total ?? 0}
              loading={loadingTable}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPage(1);
                setPageSize(size);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
