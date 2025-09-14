import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable } from "@/components/common/DataTable";
import { MetadataListFilter } from "@/components/common/MetadataListFilter";
import { Badge } from "@/components/ui/badge";
import { mvRefreshLogApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { MvRefreshLog, FilterOptions } from "@/types";

/** Normalize options (same pattern used elsewhere) */
function normalizeOptions(opts: { value?: string | number; label?: string }[]) {
  return (opts || [])
    .map((o) => {
      const value = o.value === undefined || o.value === null ? "" : String(o.value);
      const label = (o.label ?? "").toString();
      return { value, label };
    })
    .filter((o) => o.value !== ""); // remove empty values for Radix Select
}

/** Simple status -> class mapping for Badge (kept inline) */
function getStatusColor(status: string) {
  const s = (status ?? "").toString().toLowerCase();
  if (s.includes("success") || s.includes("completed") || s.includes("ok")) return "bg-green-100 text-green-800";
  if (s.includes("fail") || s.includes("error") || s.includes("failed")) return "bg-red-100 text-red-800";
  if (s.includes("running") || s.includes("in_progress") || s.includes("processing")) return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-800";
}

const MvRefreshLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<MvRefreshLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const { toast } = useToast();

  // client refs for mapping + select options (loaded once)
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  const [clientOptions, setClientOptions] = useState<{ value: string; label: string }[]>([]);

  // batch suggestions derived from full log list for the selected client (or all clients)
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  // NEW: rows after table-level processing (search+sort) but BEFORE pagination
  const [processedRows, setProcessedRows] = useState<MvRefreshLog[]>([]);

  // load clients once (for client schema map & select options)
  useEffect(() => {
    (async () => {
      try {
        const clientsResp = await clientReferenceApi.getAll();
        const map: Record<number, string> = {};
        const optsRaw: { value: string; label: string }[] = [];
        (clientsResp?.data ?? []).forEach((c: any) => {
          if (typeof c.client_id === "number") {
            const label = c.client_schema ?? c.client_name ?? String(c.client_id);
            map[c.client_id] = label;
            optsRaw.push({ value: String(c.client_id), label });
          }
        });
        const normalized = normalizeOptions(optsRaw);
        normalized.sort((a, b) => a.label.localeCompare(b.label));
        setClientMap(map);
        setClientOptions(normalized);
      } catch (err) {
        console.error("failed loading client refs", err);
        setClientMap({});
        setClientOptions([]);
      }
    })();
  }, []);

  // load logs whenever applied filters change (clientId/status/batchId)
  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.clientId, filters.batchId, filters.status]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const resp = await mvRefreshLogApi.getAll(filters.clientId, filters.batchId);
      setLogs(resp?.data ?? []);
    } catch (err) {
      console.error("load MV refresh logs error", err);
      toast({
        title: "Error",
        description: "Failed to load MV refresh logs",
        variant: "destructive",
      });
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // load batch suggestions list for given client (or for all clients when undefined).
  // This fetches all logs for the client (no batch filter) and extracts unique batch ids.
  const loadBatchOptions = async (clientId?: number) => {
    try {
      const resp = await mvRefreshLogApi.getAll(clientId, undefined);
      const batches = Array.from(new Set((resp?.data ?? []).map((r) => r.batch_id).filter(Boolean))) as string[];
      batches.sort((a, b) => a.localeCompare(b));
      setBatchOptions(batches);
    } catch (err) {
      console.error("failed loading batch suggestions", err);
      setBatchOptions([]);
    }
  };

  // Whenever client selection changes, refresh batch suggestions.
  useEffect(() => {
    loadBatchOptions(filters.clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.clientId]);

  // helper status checks (same logic as other pages)
  const isAllSuccess = (log: MvRefreshLog) => {
    const s = (log.status ?? "").toString().toLowerCase();
    return s === "" || s.includes("success") || s.includes("completed") || s.includes("ok");
  };

  const hasAnyFailed = (log: MvRefreshLog) => {
    const s = (log.status ?? "").toString().toLowerCase();
    return s.includes("fail") || s.includes("error") || s.includes("failed");
  };

  // filter client-side according to applied `filters` (status logic implemented here)
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filters.status === "success") {
        if (!isAllSuccess(log)) return false;
      } else if (filters.status === "failed") {
        if (!hasAnyFailed(log)) return false;
      }
      if (filters.clientId && log.client_id !== filters.clientId) return false;
      if (filters.batchId && log.batch_id !== filters.batchId) return false;
      return true;
    });
  }, [logs, filters]);

  const columns = [
    { key: "mv_log_id", label: "Log ID", sortable: true },
    { key: "client_schema", label: "Client", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value: string, row: MvRefreshLog) => (
        <Badge className={getStatusColor(row.status || "")}>{row.status}</Badge>
      ),
    },
    { key: "proc_mv_name", label: "MV Procedure Name", sortable: true },
    { key: "batch_id", label: "Batch ID", sortable: true },
    { key: "start_time", label: "Start Time", sortable: true },
    { key: "end_time", label: "End Time", sortable: true },
    { key: "message", label: "Message", sortable: false },
  ];

  // data mapping: include client_schema for display (use clientMap)
  const displayed = filteredLogs.map((l) => ({
    ...l,
    client_schema: clientMap[l.client_id] ?? String(l.client_id),
  }));

  // choose source for aggregation:
  const sourceForAggregation = processedRows.length > 0 ? processedRows : displayed;

  return (
    <div className="h-full w-full p-6 space-y-6 flex flex-col overflow-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MV Refresh Logs</h1>
        <p className="text-muted-foreground">View materialized view refresh logs and status information</p>
      </div>

      {/* Summary Stats (3 cards, grid adjusted) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sourceForAggregation.length}</div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {sourceForAggregation.filter((log) => isAllSuccess(log)).length}
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {sourceForAggregation.filter((log) => hasAnyFailed(log)).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters (same behaviour as other pages) */}
      <MetadataListFilter
        onFiltersChange={(next) => {
          const nf = next as FilterOptions;
          setFilters(nf);
        }}
        loading={loading}
        showVersionFilter={false}
        showStatusFilter={true}
        showBatchFilter={true}
        showDateFilter={false}
        batchOptions={batchOptions}
        statusOptions={[
          { label: "All", value: "all" },
          { label: "Success", value: "success" },
          { label: "Failed", value: "failed" },
        ]}
      />

      {/* Data Table */}
      <Card className="professional-card">
        <CardContent className="p-0">
          <DataTable
            data={displayed}
            columns={columns}
            loading={loading}
            searchPlaceholder="Search MV refresh logs..."
            onProcessedRowsChange={(rows) => setProcessedRows(rows as MvRefreshLog[])}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default MvRefreshLogsPage;
