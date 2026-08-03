import { useEffect, useMemo, useState } from "react";
import {
  PagedResult,
  parsingReportApi,
  ParsingActivityItem,
  ParsingEffectiveItem,
  ParsingReportSummary,
} from "@/lib/appApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const EFFECTIVE_STATUSES = [
  "PARSING",
  "REVISI DATA",
  "PARSING & REVISI DATA",
];
const CHANGE_TYPES = [
  "PARSING",
  "REVISI DATA",
  "PARSING & REVISI DATA",
];
const REVERT_STATES = ["CHANGE", "PARTIAL REVERT", "REVERT"];

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
  const [effectiveStatus, setEffectiveStatus] = useState("");
  const [changeType, setChangeType] = useState("");
  const [revertState, setRevertState] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [summary, setSummary] = useState<ParsingReportSummary | null>(null);
  const [effective, setEffective] = useState<PagedResult<ParsingEffectiveItem> | null>(null);
  const [history, setHistory] = useState<PagedResult<ParsingActivityItem> | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState("");

  const selectedUserId = memberFilter ? Number(memberFilter) : null;

  useEffect(() => {
    let cancelled = false;
    setLoadingSummary(true);
    setError("");
    parsingReportApi
      .summary({
        dateFrom,
        dateTo,
        userId: selectedUserId,
      })
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

    const request =
      tab === "effective"
        ? parsingReportApi.effective({
            page,
            pageSize,
            userId: selectedUserId,
            status: effectiveStatus,
            search: appliedSearch,
          })
        : parsingReportApi.history({
            page,
            pageSize,
            dateFrom,
            dateTo,
            userId: selectedUserId,
            changeType,
            revertState,
            search: appliedSearch,
          });

    request
      .then((response) => {
        if (cancelled) return;
        if (tab === "effective") {
          setEffective(response.data as PagedResult<ParsingEffectiveItem>);
        } else {
          setHistory(response.data as PagedResult<ParsingActivityItem>);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal mengambil report");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    tab,
    page,
    pageSize,
    memberFilter,
    effectiveStatus,
    changeType,
    revertState,
    appliedSearch,
    dateFrom,
    dateTo,
  ]);

  const activePage = tab === "effective" ? effective : history;

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const resetFilters = () => {
    setMemberFilter("");
    setEffectiveStatus("");
    setChangeType("");
    setRevertState("");
    setSearch("");
    setAppliedSearch("");
    setDateFrom(dateInputValue(firstDay));
    setDateTo(dateInputValue(now));
    setPage(1);
  };

  return (
    <div className="min-w-0 space-y-4 p-3 text-sm sm:p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold sm:text-2xl">PARSING REPORT</h1>
        <p className="text-sm text-muted-foreground">
          Hasil efektif dibandingkan baseline awal dan histori aktivitas setiap anggota.
          Perubahan yang kembali ke nilai awal tidak dihitung sebagai hasil aktif.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-6">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">DARI TANGGAL</span>
            <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">SAMPAI TANGGAL</span>
            <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">ANGGOTA</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={memberFilter}
              onChange={(event) => { setMemberFilter(event.target.value); setPage(1); }}
            >
              <option value="">SEMUA ANGGOTA</option>
              {(summary?.member_options || [])
                .filter((member) => member.user_id !== null)
                .map((member) => (
                  <option key={String(member.user_id)} value={String(member.user_id)}>
                    {member.member_name} ({member.username})
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {tab === "effective" ? "STATUS EFEKTIF" : "JENIS AKTIVITAS"}
            </span>
            {tab === "effective" ? (
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={effectiveStatus}
                onChange={(event) => { setEffectiveStatus(event.target.value); setPage(1); }}
              >
                <option value="">SEMUA STATUS</option>
                {EFFECTIVE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            ) : (
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={changeType}
                onChange={(event) => { setChangeType(event.target.value); setPage(1); }}
              >
                <option value="">SEMUA JENIS</option>
                {CHANGE_TYPES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            )}
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {tab === "history" ? "STATUS REVERT" : "CARI"}
            </span>
            {tab === "history" ? (
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={revertState}
                onChange={(event) => { setRevertState(event.target.value); setPage(1); }}
              >
                <option value="">SEMUA</option>
                {REVERT_STATES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            ) : (
              <Input
                value={search}
                placeholder="ODIST, outlet, kota..."
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
              />
            )}
          </label>
          <div className="flex items-end gap-2">
            {tab === "history" && (
              <Input
                value={search}
                placeholder="Cari..."
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
              />
            )}
            <Button onClick={applySearch}>Cari</Button>
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
          </div>
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
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{loadingSummary ? "..." : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">SUMMARY PER ANGGOTA</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {[
                  "ANGGOTA",
                  "PARSING AKTIF",
                  "REVISI AKTIF",
                  "PARSING + REVISI",
                  "FIELD DIREVISI",
                  "AKTIVITAS",
                  "REVERT",
                  "PARTIAL REVERT",
                ].map((header) => (
                  <th key={header} className="border-b p-3 text-left text-xs font-semibold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary?.members.length ? summary.members.map((member) => (
                <tr key={`${member.user_id}-${member.username}`} className="hover:bg-muted/30">
                  <td className="border-b p-3">
                    <div className="font-medium">{member.member_name}</div>
                    <div className="text-xs text-muted-foreground">{member.username}</div>
                  </td>
                  <td className="border-b p-3 tabular-nums">{member.active_parsing_rows}</td>
                  <td className="border-b p-3 tabular-nums">{member.active_revision_rows}</td>
                  <td className="border-b p-3 tabular-nums">{member.active_parsing_revision_rows}</td>
                  <td className="border-b p-3 tabular-nums">{member.active_revised_fields}</td>
                  <td className="border-b p-3 tabular-nums">{member.total_edit_activities}</td>
                  <td className="border-b p-3 tabular-nums">{member.reverted_activities}</td>
                  <td className="border-b p-3 tabular-nums">{member.partial_revert_activities}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Belum ada aktivitas parsing.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 rounded-lg border bg-muted/30 p-1 sm:w-[420px]">
        <Button
          variant={tab === "effective" ? "default" : "ghost"}
          onClick={() => { setTab("effective"); setPage(1); }}
        >
          EFFECTIVE RESULT
        </Button>
        <Button
          variant={tab === "history" ? "default" : "ghost"}
          onClick={() => { setTab("history"); setPage(1); }}
        >
          ACTIVITY HISTORY
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-0 sm:p-4">
          <div className="overflow-x-auto rounded-md border-0 sm:border">
            {tab === "effective" ? (
              <table className="min-w-[1450px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-background shadow-sm">
                  <tr>
                    {[
                      "ODISTS ID",
                      "ANGGOTA",
                      "STATUS",
                      "ORIGINAL OGAL",
                      "CURRENT OGAL",
                      "FIELD REVISI MILIK ANGGOTA",
                      "OUTLET",
                      "CITY",
                      "PROVINCE",
                      "LAST EDITED",
                      "ACTIONS",
                      "TRACKING",
                    ].map((header) => (
                      <th key={header} className="border-b p-3 text-left text-xs font-semibold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingTable ? (
                    <tr><td colSpan={12} className="p-8 text-center">Memuat report...</td></tr>
                  ) : effective?.items.length ? effective.items.map((item) => (
                    <tr key={`${item.odist_id}-${item.member_user_id ?? "untracked"}`} className="hover:bg-muted/30">
                      <td className="border-b p-3 font-medium tabular-nums">{item.odist_id}</td>
                      <td className="border-b p-3">
                        <div className="font-medium">{item.member_name}</div>
                        <div className="text-xs text-muted-foreground">{item.username}</div>
                      </td>
                      <td className="border-b p-3"><StatusBadge value={item.status} /></td>
                      <td className="border-b p-3 tabular-nums">{displayValue(item.original_ogal_id)}</td>
                      <td className="border-b p-3 tabular-nums">{displayValue(item.current_ogal_id)}</td>
                      <td className="border-b p-3">{item.owned_revision_fields.length ? item.owned_revision_fields.map(displayField).join(", ") : "-"}</td>
                      <td className="max-w-72 truncate border-b p-3" title={displayValue(item.cust_name)}>{displayValue(item.cust_name)}</td>
                      <td className="border-b p-3">{displayValue(item.city)}</td>
                      <td className="border-b p-3">{displayValue(item.province)}</td>
                      <td className="border-b p-3 whitespace-nowrap">{formatDate(item.last_edited_at)}</td>
                      <td className="border-b p-3 tabular-nums">{item.total_actions}</td>
                      <td className="border-b p-3">{item.is_untracked ? <StatusBadge value="UNTRACKED" /> : "TRACKED"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Tidak ada hasil efektif.</td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="min-w-[1350px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-background shadow-sm">
                  <tr>
                    {[
                      "WAKTU",
                      "ODISTS ID",
                      "ANGGOTA",
                      "JENIS",
                      "REVERT STATE",
                      "FIELDS",
                      "BEFORE → AFTER",
                    ].map((header) => (
                      <th key={header} className="border-b p-3 text-left text-xs font-semibold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingTable ? (
                    <tr><td colSpan={7} className="p-8 text-center">Memuat histori...</td></tr>
                  ) : history?.items.length ? history.items.map((item) => (
                    <tr key={item.audit_id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap border-b p-3">{formatDate(item.changed_at)}</td>
                      <td className="border-b p-3 font-medium tabular-nums">{item.odist_id}</td>
                      <td className="border-b p-3">
                        <div className="font-medium">{item.member_name}</div>
                        <div className="text-xs text-muted-foreground">{item.username}</div>
                      </td>
                      <td className="border-b p-3"><StatusBadge value={item.change_type} /></td>
                      <td className="border-b p-3"><StatusBadge value={item.revert_state} /></td>
                      <td className="border-b p-3">{item.changed_fields.map(displayField).join(", ")}</td>
                      <td className="border-b p-3">
                        <div className="space-y-1">
                          {item.changed_fields.map((field) => (
                            <div key={field} className="grid grid-cols-[150px_1fr] gap-2 text-xs">
                              <span className="font-semibold">{displayField(field)}</span>
                              <span className="break-words text-muted-foreground">
                                {displayValue(item.old_values[field])} → {displayValue(item.new_values[field])}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Tidak ada aktivitas pada periode ini.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col gap-3 px-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-0 sm:pb-0">
            <div className="flex items-center gap-2">
              <span>Total {activePage?.total ?? 0} row</span>
              <select
                className="h-9 rounded-md border bg-background px-2"
                value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
              >
                {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="whitespace-nowrap">Page {activePage?.page ?? page} / {activePage?.total_pages ?? 1}</span>
              <Button variant="outline" size="sm" disabled={page >= (activePage?.total_pages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
