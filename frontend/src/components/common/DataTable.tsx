import { useState, useMemo, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusColor } from "@/utils/mockData";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  /**
   * Callback invoked with the processed rows (post-search+filter+sort, PRE-PAGINATION).
   * Use this for summary/aggregation that must consider all matching rows.
   */
  onProcessedRowsChange?: (rows: any[]) => void;
  /**
   * Optional callback invoked with visible rows (post-pagination).
   */
  onVisibleRowsChange?: (rows: any[]) => void;
}

export function DataTable({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  className,
  onProcessedRowsChange,
  onVisibleRowsChange,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;

    return data.filter((item) =>
      Object.values(item).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // handle undefined/null
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      // numeric compare if both are numbers
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Inform parent about processed rows (pre-pagination)
  useEffect(() => {
    if (typeof onProcessedRowsChange === "function") {
      // pass a shallow copy to avoid accidental mutations
      onProcessedRowsChange(sortedData.slice());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedData]);

  // Inform parent about visible rows (post-pagination)
  useEffect(() => {
    if (typeof onVisibleRowsChange === "function") {
      onVisibleRowsChange(paginatedData.slice());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedData]);

  const handleSort = (key: string) => {
    const column = columns.find((col) => col.key === key);
    if (!column?.sortable) return;

    setSortConfig((current) => {
      if (current?.key === key) {
        return current.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
    setCurrentPage(1);
  };

  const renderSortIcon = (key: string) => {
    const column = columns.find((col) => col.key === key);
    if (!column?.sortable) return null;

    if (sortConfig?.key === key) {
      return sortConfig.direction === "asc" ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      );
    }
    return <ChevronDown className="h-4 w-4 opacity-0" />;
  };

  const renderCellValue = (column: Column, value: any, row: any) => {
    if (column.render) {
      return column.render(value, row);
    }

    // Auto-format status fields
    if (column.key.includes("status") && typeof value === "string") {
      return (
        <Badge variant="secondary" className={getStatusColor(value)}>
          {value}
        </Badge>
      );
    }

    // Auto-format dates
    if (column.key.includes("time") || column.key.includes("date")) {
      try {
        return value ? new Date(value).toLocaleString() : "-";
      } catch {
        return value;
      }
    }

    // Auto-format numbers
    if (typeof value === "number") {
      return value.toLocaleString();
    }

    return value ?? "-";
  };

  if (loading) {
    return (
      <div className={cn("data-table", className)}>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("data-table", className)}>
      {/* Search and Controls */}
      {searchable && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between space-x-4">
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="max-w-sm"
            />
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value, 10));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn("group", column.sortable && "cursor-pointer select-none")}
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {renderSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>{renderCellValue(column, row[column.key], row)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(pageNum)} className="w-8 h-8 p-0">
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
