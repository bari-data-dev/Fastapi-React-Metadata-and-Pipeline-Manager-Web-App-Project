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
import { Progress } from "@/components/ui/progress";
import { fileAuditLogApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { FileAuditLog, FilterOptions } from "@/types";

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

const FileAuditPage = () => {
  const [auditLogs, setAuditLogs] = useState<FileAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // applied filters (we rely on MetadataListFilter to only call onFiltersChange
  // when user clicks Apply / selects client etc)
  const [filters, setFilters] = useState<FilterOptions>({});

  const { toast } = useToast();

  // client refs for mapping + select options
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  const [clientOptions, setClientOptions] = useState<{ value: string; label: string }[]>([]);

  // batch suggestions derived from full log list for the selected client (or all clients)
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  // NEW: rows after table-level processing (search+sort) but BEFORE pagination
  const [processedRows, setProcessedRows] = useState<FileAuditLog[]>([]);

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

  // load audit logs whenever applied filters change (clientId/status/batchId)
  useEffect(() => {
    loadAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.clientId, filters.batchId, filters.status]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const resp = await fileAuditLogApi.getAll(filters.clientId, filters.batchId);
      setAuditLogs(resp?.data ?? []);
    } catch (err) {
      console.error("load file audit logs error", err);
      toast({
        title: "Error",
        description: "Failed to load file audit logs",
        variant: "destructive",
      });
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // load batch suggestions list for given client (or for all clients when undefined).
  // This fetches all logs for the client (no batch filter) and extracts unique batch ids.
  const loadBatchOptions = async (clientId?: number) => {
    try {
      const resp = await fileAuditLogApi.getAll(clientId, undefined);
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
  }, [filters.clientId]);

  // helper status checks (same logic as requested)
  const isAllSuccess = (log: FileAuditLog) => {
    const statuses = [
      log.convert_status,
      log.mapping_validation_status,
      log.row_validation_status,
      log.load_status,
    ].map((s) => (s ?? "").toLowerCase());
    return statuses.every((s) => s === "" || s.includes("success") || s.includes("loaded") || s.includes("ok"));
  };

  const hasAnyFailed = (log: FileAuditLog) => {
    const statuses = [
      log.convert_status,
      log.mapping_validation_status,
      log.row_validation_status,
      log.load_status,
    ].map((s) => (s ?? "").toLowerCase());
    return statuses.some((s) => s.includes("fail") || s.includes("error") || s.includes("failed"));
  };

  // filter client-side according to applied `filters` (status logic implemented here)
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (filters.status === "success") {
        if (!isAllSuccess(log)) return false;
      } else if (filters.status === "failed") {
        if (!hasAnyFailed(log)) return false;
      }
      if (filters.clientId && log.client_id !== filters.clientId) return false;
      if (filters.batchId && log.batch_id !== filters.batchId) return false;
      return true;
    });
  }, [auditLogs, filters]);

  // columns: show client_schema instead of numeric client_id
  const columns = [
    { key: "client_schema", label: "Client Schema", sortable: true },
    { key: "logical_source_file", label: "Source File", sortable: true },
    { key: "physical_file_name", label: "Physical File", sortable: true },
    
    {
      key: "total_rows",
      label: "Records",
      sortable: true,
      render: (value: number, row: FileAuditLog) => {
        if (!value) return "-";
        const validRate = ((row.valid_rows || 0) / value) * 100;
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium">{value.toLocaleString()}</div>
            <Progress value={validRate} className="h-1" />
            <div className="text-xs text-muted-foreground">{validRate.toFixed(1)}% valid</div>
          </div>
        );
      },
    },
    { key: "convert_status", label: "Convert", sortable: true },
    { key: "mapping_validation_status", label: "Mapping", sortable: true },
    { key: "row_validation_status", label: "Validation", sortable: true },
    { key: "load_status", label: "Load", sortable: true },
    { key: "processed_by", label: "Processed By", sortable: true },
    { key: "file_received_time", label: "Received", sortable: true },
    { key: "parquet_converted_time", label: "Converted", sortable: true },
    { key: "batch_id", label: "Batch ID", sortable: true },
  ];

  // data mapping: include client_schema for display
  const displayed = filteredLogs.map((l) => ({
    ...l,
    client_schema: clientMap[l.client_id] ?? String(l.client_id),
  }));

  // choose source for aggregation:
  const sourceForAggregation = processedRows.length > 0 ? processedRows : displayed;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">File Audit Logs</h1>
        <p className="text-muted-foreground">Comprehensive audit trail of file processing activities and status</p>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sourceForAggregation.length}</div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valid and Loaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {
                sourceForAggregation.filter((log) => (log.load_status ?? "").toLowerCase().includes("load") || isAllSuccess(log)).length
              }
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Invalid and Loaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{sourceForAggregation.filter((log) => hasAnyFailed(log)).length}</div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sourceForAggregation.reduce((sum, log) => sum + (log.total_rows || 0), 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

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

      {/* Data table */}
      <Card className="professional-card">
        <CardContent className="p-0">
          <DataTable
            data={displayed}
            columns={columns}
            loading={loading}
            searchPlaceholder="Search audit logs..."
            onProcessedRowsChange={(rows) => {
              // rows here are already the processed rows (with client_schema)
              setProcessedRows(rows as FileAuditLog[]);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default FileAuditPage;
