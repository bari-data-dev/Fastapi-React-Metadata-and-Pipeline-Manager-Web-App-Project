import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DataTable } from "@/components/common/DataTable";
import { MetadataListFilter } from "@/components/common/MetadataListFilter";
import { Badge } from "@/components/ui/badge";
import { mappingValidationLogApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { MappingValidationLog, FilterOptions } from "@/types";

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

const MappingValidationPage = () => {
  const [validationLogs, setValidationLogs] = useState<MappingValidationLog[]>(
    []
  );
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
  const [processedRows, setProcessedRows] = useState<MappingValidationLog[]>(
    []
  );

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

  // load validation logs whenever applied filters change (clientId/status/batchId)
  useEffect(() => {
    loadValidationLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.clientId, filters.batchId, filters.status]);

  const loadValidationLogs = async () => {
    try {
      setLoading(true);
      const response = await mappingValidationLogApi.getAll(
        filters.clientId,
        filters.batchId
      );
      setValidationLogs(response?.data ?? []);
    } catch (error) {
      console.error("load mapping validation logs error", error);
      toast({
        title: "Error",
        description: "Failed to load mapping validation logs",
        variant: "destructive",
      });
      setValidationLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // load batch suggestions list for given client (or for all clients when undefined).
  // This fetches all logs for the client (no batch filter) and extracts unique batch ids.
  const loadBatchOptions = async (clientId?: number) => {
    try {
      const resp = await mappingValidationLogApi.getAll(clientId, undefined);
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

  // helper status checks (adapted for mapping validation logs)
  // define "success" as no missing_columns and no extra_columns
  const isAllSuccess = (log: MappingValidationLog) => {
    const missing = (log.missing_columns ?? "").toString().trim();
    const extra = (log.extra_columns ?? "").toString().trim();
    return missing === "" && extra === "";
  };

  const hasAnyFailed = (log: MappingValidationLog) => {
    const missing = (log.missing_columns ?? "").toString().trim();
    const extra = (log.extra_columns ?? "").toString().trim();
    return missing !== "" || extra !== "";
  };

  // filter client-side according to applied `filters` (status logic implemented here)
  const filteredLogs = useMemo(() => {
    return validationLogs.filter((log) => {
      if (filters.status === "success") {
        if (!isAllSuccess(log)) return false;
      } else if (filters.status === "failed") {
        if (!hasAnyFailed(log)) return false;
      }
      if (filters.clientId && log.client_id !== filters.clientId) return false;
      if (filters.batchId && log.batch_id !== filters.batchId) return false;
      return true;
    });
  }, [validationLogs, filters]);

  // columns: show client_schema instead of numeric client_id (columns kept as requested)
  const columns = [
    { key: "mapping_id", label: "ID", sortable: true },
    { key: "client_schema", label: "Client", sortable: true },
    { key: "file_name", label: "File Name", sortable: true },
    { key: "batch_id", label: "Batch ID", sortable: true },
    {
      key: "missing_columns",
      label: "Missing Columns",
      render: (value: string) => {
        if (!value) return <Badge variant="outline">None</Badge>;
        return (
          <Badge
            variant="destructive"
            className="max-w-xs truncate"
            title={value}
          >
            {value.split(",").length} missing
          </Badge>
        );
      },
    },
    {
      key: "extra_columns",
      label: "Extra Columns",
      render: (value: string) => {
        if (!value) return <Badge variant="outline">None</Badge>;
        return (
          <Badge
            variant="secondary"
            className="max-w-xs truncate"
            title={value}
          >
            {value.split(",").length} extra
          </Badge>
        );
      },
    },
    {
      key: "expected_columns",
      label: "Expected",
      render: (value: string) => {
        if (!value) return "-";
        return (
          <div className="max-w-xs truncate text-xs" title={value}>
            {value.split(",").length} columns
          </div>
        );
      },
    },
    {
      key: "received_columns",
      label: "Received",
      render: (value: string) => {
        if (!value) return "-";
        return (
          <div className="max-w-xs truncate text-xs" title={value}>
            {value.split(",").length} columns
          </div>
        );
      },
    },
    { key: "timestamp", label: "Timestamp", sortable: true },
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
          Mapping Validation Logs
        </h1>
        <p className="text-muted-foreground">
          Track column mapping validation results and schema compliance
        </p>
      </div>

      {/* Summary Stats (uses sourceForAggregation like FileAuditPage) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Validations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sourceForAggregation.length}
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Files with Missing Columns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {
                sourceForAggregation.filter((log) =>
                  Boolean(log.missing_columns)
                ).length
              }
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Files with Extra Columns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {
                sourceForAggregation.filter((log) => Boolean(log.extra_columns))
                  .length
              }
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
            searchPlaceholder="Search validation logs..."
            onProcessedRowsChange={(rows) => {
              setProcessedRows(rows as MappingValidationLog[]);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default MappingValidationPage;
