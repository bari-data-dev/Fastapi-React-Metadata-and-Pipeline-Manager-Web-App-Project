import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/common/DataTable";
import { MetadataListFilter } from "@/components/common/MetadataListFilter";
import { jobExecutionLogApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { JobExecutionLog, FilterOptions } from "@/types";

/** Normalize options (same pattern used elsewhere) */
function normalizeOptions(opts: { value?: string | number; label?: string }[]) {
  return (opts || [])
    .map((o) => {
      const value =
        o.value === undefined || o.value === null ? "" : String(o.value);
      const label = (o.label ?? "").toString();
      return { value, label };
    })
    .filter((o) => o.value !== ""); // remove empty values for Radix Select
}

const JobExecutionPage = () => {
  const [jobLogs, setJobLogs] = useState<JobExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // applied filters (use MetadataListFilter behaviour same as FileAuditPage)
  const [filters, setFilters] = useState<FilterOptions>({});

  const { toast } = useToast();

  // client refs for mapping + select options (loaded once)
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  const [clientOptions, setClientOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // batch suggestions derived from full log list for the selected client (or all clients)
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  // NEW: rows after table-level processing (search+sort) but BEFORE pagination
  const [processedRows, setProcessedRows] = useState<JobExecutionLog[]>([]);

  // load clients once (for client schema map & select options)
  useEffect(() => {
    (async () => {
      try {
        const clientsResp = await clientReferenceApi.getAll();
        const map: Record<number, string> = {};
        const optsRaw: { value: string; label: string }[] = [];
        (clientsResp?.data ?? []).forEach((c: any) => {
          if (typeof c.client_id === "number") {
            const label =
              c.client_schema ?? c.client_name ?? String(c.client_id);
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

  // load job logs whenever applied filters change (clientId/status/batchId)
  useEffect(() => {
    loadJobLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.clientId, filters.batchId, filters.status]);

  const loadJobLogs = async () => {
    try {
      setLoading(true);
      const response = await jobExecutionLogApi.getAll(
        filters.clientId,
        filters.batchId
      );
      setJobLogs(response?.data ?? []);
    } catch (error) {
      console.error("load job execution logs error", error);
      toast({
        title: "Error",
        description: "Failed to load job execution logs",
        variant: "destructive",
      });
      setJobLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // load batch suggestions list for given client (or for all clients when undefined).
  // This fetches all logs for the client (no batch filter) and extracts unique batch ids.
  const loadBatchOptions = async (clientId?: number) => {
    try {
      const resp = await jobExecutionLogApi.getAll(clientId, undefined);
      const batches = Array.from(
        new Set((resp?.data ?? []).map((r) => r.batch_id).filter(Boolean))
      ) as string[];
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

  // helper status checks (adapted for job logs)
  const isAllSuccess = (log: JobExecutionLog) => {
    const s = (log.status ?? "").toString().toLowerCase();
    return (
      s === "" ||
      s.includes("completed") ||
      s.includes("success") ||
      s.includes("ok")
    );
  };

  const hasAnyFailed = (log: JobExecutionLog) => {
    const s = (log.status ?? "").toString().toLowerCase();
    return s.includes("fail") || s.includes("error") || s.includes("failed");
  };

  // client-side filtering according to applied `filters` (status logic implemented here)
  const filteredLogs = useMemo(() => {
    return jobLogs.filter((log) => {
      if (filters.status === "success") {
        if (!isAllSuccess(log)) return false;
      } else if (filters.status === "failed") {
        if (!hasAnyFailed(log)) return false;
      }
      if (filters.clientId && log.client_id !== filters.clientId) return false;
      if (filters.batchId && log.batch_id !== filters.batchId) return false;
      return true;
    });
  }, [jobLogs, filters]);

  // columns: show client_schema instead of numeric client_id
  const columns = [
    { key: "client_schema", label: "Client", sortable: true },
    { key: "job_name", label: "Job Name", sortable: true },
    { key: "file_name", label: "File", sortable: true },
    { key: "status", label: "Status", sortable: true },
    {
      key: "error_message",
      label: "Error Details",
      render: (value: string) => {
        if (!value) return "-";
        return (
          <div className="max-w-xs truncate" title={value}>
            {value}
          </div>
        );
      },
    },
    { key: "start_time", label: "Started", sortable: true },
    { key: "end_time", label: "Completed", sortable: true },
    {
      key: "duration",
      label: "Duration",
      render: (value: any, row: JobExecutionLog) => {
        if (!row.start_time || !row.end_time) return "-";
        const start = new Date(row.start_time);
        const end = new Date(row.end_time);
        const duration = end.getTime() - start.getTime();
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
      },
    },
    { key: "batch_id", label: "Batch ID", sortable: true },
  ];

  // data mapping: include client_schema for display
  const displayed = filteredLogs.map((l) => ({
    ...l,
    client_schema: clientMap[l.client_id] ?? String(l.client_id),
  }));

  // choose source for aggregation:
  const sourceForAggregation =
    processedRows.length > 0 ? processedRows : displayed;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Job Execution Logs
        </h1>
        <p className="text-muted-foreground">
          Monitor and track data processing job executions and their outcomes
        </p>
      </div>

      {/* Summary Stats (uses sourceForAggregation like FileAuditPage) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sourceForAggregation.length}
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {sourceForAggregation.filter((log) => isAllSuccess(log)).length}
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {sourceForAggregation.filter((log) => hasAnyFailed(log)).length}
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sourceForAggregation.length > 0
                ? Math.round(
                    (sourceForAggregation.filter((log) => isAllSuccess(log))
                      .length /
                      sourceForAggregation.length) *
                      100
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters (same behaviour as FileAuditPage) */}
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
            searchPlaceholder="Search job logs..."
            onProcessedRowsChange={(rows) => {
              // rows here are already the processed rows (with client_schema)
              setProcessedRows(rows as JobExecutionLog[]);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default JobExecutionPage;
