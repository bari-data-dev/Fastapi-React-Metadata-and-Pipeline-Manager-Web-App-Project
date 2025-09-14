import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/common/DataTable";
import { MetadataListFilter } from "@/components/common/MetadataListFilter";
import { Badge } from "@/components/ui/badge";
import { loadErrorLogApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { LoadErrorLog, FilterOptions } from "@/types";

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

const LoadErrorsPage = () => {
  const [errorLogs, setErrorLogs] = useState<LoadErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  // applied filters (same behaviour as FileAuditPage)
  const [filters, setFilters] = useState<FilterOptions>({});

  const { toast } = useToast();

  // client refs for mapping + select options (loaded once)
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  const [clientOptions, setClientOptions] = useState<{ value: string; label: string }[]>([]);

  // batch suggestions derived from full log list for the selected client (or all clients)
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  // NEW: rows after table-level processing (search+sort) but BEFORE pagination
  const [processedRows, setProcessedRows] = useState<LoadErrorLog[]>([]);

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
    loadErrorLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.clientId, filters.batchId, filters.status]);

  const loadErrorLogs = async () => {
    try {
      setLoading(true);
      const response = await loadErrorLogApi.getAll(filters.clientId, filters.batchId);
      setErrorLogs(response?.data ?? []);
    } catch (error) {
      console.error("load load error logs error", error);
      toast({
        title: "Error",
        description: "Failed to load load error logs",
        variant: "destructive",
      });
      setErrorLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // load batch suggestions list for given client (or for all clients when undefined).
  // This fetches all logs for the client (no batch filter) and extracts unique batch ids.
  const loadBatchOptions = async (clientId?: number) => {
    try {
      const resp = await loadErrorLogApi.getAll(clientId, undefined);
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

  // helper status checks for load errors:
  // here we assume "success" = entry WITHOUT error_detail (since this page is error logs).
  const isAllSuccess = (log: LoadErrorLog) => {
    const detail = (log.error_detail ?? "").toString().trim();
    return detail === "";
  };

  const hasAnyFailed = (log: LoadErrorLog) => {
    const detail = (log.error_detail ?? "").toString().trim();
    return detail !== "";
  };

  // filter client-side according to applied `filters` (status logic implemented here)
  const filteredLogs = useMemo(() => {
    return errorLogs.filter((log) => {
      if (filters.status === "success") {
        if (!isAllSuccess(log)) return false;
      } else if (filters.status === "failed") {
        if (!hasAnyFailed(log)) return false;
      }
      if (filters.clientId && log.client_id !== filters.clientId) return false;
      if (filters.batchId && log.batch_id !== filters.batchId) return false;
      return true;
    });
  }, [errorLogs, filters]);

  const columns = [
    { key: "error_id", label: "Error ID", sortable: true },
    { key: "client_schema", label: "Client", sortable: true },
    { key: "file_name", label: "File Name", sortable: true },
    /*{
      key: "stage",
      label: "Stage",
      sortable: true,
      render: (value: string) => {
        const colorMap: Record<string, string> = {
          Extract: "bg-blue-100 text-blue-800",
          Transform: "bg-purple-100 text-purple-800",
          Load: "bg-green-100 text-green-800",
          Validation: "bg-yellow-100 text-yellow-800",
        };
        return (
          <Badge variant="secondary" className={colorMap[value] || "bg-gray-100 text-gray-800"}>
            {value}
          </Badge>
        );
      },
    },*/
    {
      key: "error_detail",
      label: "Error Detail",
      render: (value: string) => (
        <div className="max-w-md">
          <div className="truncate" title={value}>
            {value}
          </div>
        </div>
      ),
    },
    { key: "batch_id", label: "Batch ID", sortable: true },
    { key: "timestamp", label: "Timestamp", sortable: true },
  ];

  // data mapping: include client_schema for display
  const displayed = filteredLogs.map((l) => ({
    ...l,
    client_schema: clientMap[l.client_id] ?? String(l.client_id),
  }));

  // choose source for aggregation:
  const sourceForAggregation = processedRows.length > 0 ? processedRows : displayed;

  // stage stats derived from sourceForAggregation (so summaries reflect table search/sort)
  const stageStats = sourceForAggregation.reduce((acc, log) => {
    const stage = log.stage || "Unknown";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full w-full p-6 space-y-6 flex flex-col overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Load Error Logs</h1>
        <p className="text-muted-foreground">
          System-level errors during data loading and processing stages
        </p>
      </div>

      {/* Summary Stats (uses sourceForAggregation like FileAuditPage) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{sourceForAggregation.length}</div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Extract Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stageStats["Extract"] || 0}</div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Transform Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stageStats["Transform"] || 0}</div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Load Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stageStats["Load"] || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Breakdown (optional card) */}
      {Object.keys(stageStats).length > 0 && (
        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Stage Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stageStats).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <div className="text-sm">{stage}</div>
                  <div className="text-sm font-medium">{count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters (same behaviour as FileAuditPage) */}
      <MetadataListFilter
        onFiltersChange={(next) => {
          const nf = next as FilterOptions;
          setFilters(nf);
        }}
        loading={loading}
        showVersionFilter={false}
        showStatusFilter={false}
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
            searchPlaceholder="Search error logs..."
            onProcessedRowsChange={(rows) => {
              setProcessedRows(rows as LoadErrorLog[]);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadErrorsPage;
