// src/components/common/MetadataListFilter.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { clientReferenceApi } from "@/utils/api";
import type { FilterOptions } from "@/types";

interface Option {
  value: string;
  label: string;
}

interface MetadataListFilterProps {
  onFiltersChange: (filters: FilterOptions) => void;
  loading?: boolean;
  showVersionFilter?: boolean;
  showStatusFilter?: boolean;
  showBatchFilter?: boolean;
  showDateFilter?: boolean;
  showTableTypeFilter?: boolean;
  showRefreshModeFilter?: boolean;
  statusFilterType?: "default" | "active-inactive";
  extraFilters?: React.ReactNode;
  className?: string;
  showLogicalFilter?: boolean;
  // suggestion list for batch combobox (client-specific suggestions expected)
  batchOptions?: string[];
  // override default status options if needed
  statusOptions?: { label: string; value: string }[];
}

export function MetadataListFilter({
  onFiltersChange,
  loading = false,
  showVersionFilter = true,
  showStatusFilter = false,
  showBatchFilter = false,
  showDateFilter = false,
  showTableTypeFilter = false,
  showRefreshModeFilter = false,
  statusFilterType = "default",
  extraFilters,
  className,
  showLogicalFilter = false,
  batchOptions,
  statusOptions,
}: MetadataListFilterProps) {
  const [filters, setFilters] = useState<FilterOptions>({});
  // client options loaded from backend
  const [clientOptions, setClientOptions] = useState<Option[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  // local batch input (typing) which does NOT immediately change `filters`
  const [batchInput, setBatchInput] = useState<string>("");

  // suggestion dropdown state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);

  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // unique input name to avoid browser re-using stored autocomplete values
  const batchInputNameRef = useRef<string>(
    `batch_input_${Math.random().toString(36).slice(2)}`
  );

  // Load clients from backend on mount
  useEffect(() => {
    let mounted = true;

    const loadClients = async () => {
      setClientsLoading(true);
      try {
        const resp = await clientReferenceApi.getAll();
        const clients = resp?.data || [];
        if (!mounted) return;
        // map and filter out empty/invalid ids
        const opts = (clients || [])
          .map((client: any) => {
            const id = client?.client_id;
            if (id === undefined || id === null) return null;
            return {
              value: String(id),
              label: client.client_schema ?? client.client_name ?? `Client ${id}`,
            } as Option;
          })
          .filter(Boolean) as Option[];
        // sort by label
        opts.sort((a, b) => a.label.localeCompare(b.label));
        setClientOptions(opts);
      } catch (err) {
        console.error("Failed to load clients", err);
        if (mounted) setClientOptions([]);
      } finally {
        if (mounted) setClientsLoading(false);
      }
    };

    loadClients();
    return () => {
      mounted = false;
    };
  }, []);

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilters((prev) => {
      const next: any = { ...(prev as any) };

      if (!value) {
        delete next[key];
      } else {
        if (key === "clientId") {
          const parsed = isNaN(Number(value)) ? value : Number(value);
          next[key] = parsed;
        } else {
          next[key] = value;
        }
      }

      // Clear dependent filters when parent filter changes
      if (key === "clientId") {
        delete next["version"];
        delete next["tableType"];
        // when client changes, clear batch selection too so suggestions update
        delete next["batchId"];
      } else if (key === "version") {
        delete next["tableType"];
      }

      return next as FilterOptions;
    });
  };

  const resetFilters = () => {
    setFilters({});
    setBatchInput("");
    setShowSuggestions(false);
    setHighlightIndex(-1);
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  // default status options (kept for backwards compat)
  const defaultStatusOptions =
    statusFilterType === "active-inactive"
      ? [
          { label: "All", value: "all" },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ]
      : [
          { label: "All", value: "all" },
          { label: "Success", value: "success" },
          { label: "Failed", value: "failed" },
          { label: "Pending", value: "pending" },
          { label: "Processing", value: "processing" },
        ];

  const statusOpts = statusOptions ?? defaultStatusOptions;

  // Sync batchInput when applied filters change from elsewhere (e.g. reset, client change)
  useEffect(() => {
    setBatchInput((filters as any).batchId ?? "");
    setShowSuggestions(false);
    setHighlightIndex(-1);
  }, [filters.clientId, filters.batchId]);

  // compute filtered suggestions (substring match, ascending), only from provided batchOptions (no history)
  const filteredBatchSuggestions = useMemo(() => {
    if (!batchOptions || batchOptions.length === 0) return [];
    const q = (batchInput ?? "").trim().toLowerCase();
    // if empty input, show top N suggestions (helps UX)
    const matches = batchOptions.filter((b) => b.toLowerCase().includes(q));
    matches.sort((a, b) => a.localeCompare(b));
    // limit to reasonable number
    return matches.slice(0, 50);
  }, [batchOptions, batchInput]);

  // handle outside click to close suggestions
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (suggestionsRef.current && suggestionsRef.current.contains(e.target as Node)) return;
      if (inputRef.current && inputRef.current.contains(e.target as Node)) return;
      setShowSuggestions(false);
      setHighlightIndex(-1);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // keyboard navigation for suggestions
  const onBatchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredBatchSuggestions.length === 0) {
      // If suggestions are closed but Enter is pressed, apply current typed text
      if (e.key === "Enter") {
        e.preventDefault();
        handleFilterChange("batchId", batchInput ? batchInput : undefined);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filteredBatchSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = highlightIndex >= 0 ? filteredBatchSuggestions[highlightIndex] : batchInput;
      handleFilterChange("batchId", chosen ? chosen : undefined);
      setShowSuggestions(false);
      setHighlightIndex(-1);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightIndex(-1);
    }
  };

  // helper to render highlighted match
  const renderHighlighted = (text: string, q: string) => {
    if (!q) return <>{text}</>;
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    const parts: React.ReactNode[] = [];
    let idx = 0;
    while (true) {
      const pos = lower.indexOf(ql, idx);
      if (pos === -1) {
        parts.push(<span key={idx}>{text.slice(idx)}</span>);
        break;
      }
      if (pos > idx) {
        parts.push(<span key={idx}>{text.slice(idx, pos)}</span>);
      }
      parts.push(
        <span key={pos} className="font-semibold underline decoration-sky-400/50">
          {text.slice(pos, pos + ql.length)}
        </span>
      );
      idx = pos + ql.length;
    }
    return <>{parts}</>;
  };

  return (
    <Card className={cn("professional-card", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center space-x-2">
            <Filter className="h-5 w-5 text-primary" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="text-sm font-normal text-muted-foreground">
                ({Object.keys(filters).length} active)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client-select">Client</Label>
            <Select
              value={filters.clientId?.toString() ?? "all"}
              onValueChange={(value) => {
                handleFilterChange("clientId", value === "all" ? undefined : value);
                // clear local batch input and close suggestions so new suggestions reflect new client
                setBatchInput("");
                setShowSuggestions(false);
                setHighlightIndex(-1);
              }}
              disabled={loading || clientsLoading}
            >
              <SelectTrigger id="client-select">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Clients</SelectItem>
                {clientOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Version Filter */}
          {showVersionFilter && (
            <div className="space-y-2">
              <Label htmlFor="version-select">Version</Label>
              <Select
                value={(filters as any).version || "all"}
                onValueChange={(value) => handleFilterChange("version", value === "all" ? undefined : value)}
                disabled={loading || !filters.clientId}
              >
                <SelectTrigger id="version-select">
                  <SelectValue placeholder="All Versions" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Versions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status Filter */}
          {showStatusFilter && (
            <div className="space-y-2">
              <Label htmlFor="status-select">Status</Label>
              <Select
                value={(filters as any).status || "all"}
                onValueChange={(value) => handleFilterChange("status", value === "all" ? undefined : value)}
                disabled={loading}
              >
                <SelectTrigger id="status-select">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {statusOpts.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Batch Filter implemented with nicer suggestion dropdown */}
          {showBatchFilter && (
            <div className="space-y-2 relative">
              <Label htmlFor="batch-input">Batch ID</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative" ref={suggestionsRef}>
                  <Input
                    id="batch-input"
                    name={batchInputNameRef.current}
                    ref={inputRef}
                    placeholder="Type to search batch (suggestions)"
                    value={batchInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setBatchInput(e.target.value);
                      setShowSuggestions(true);
                      setHighlightIndex(-1);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={onBatchKeyDown}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={loading}
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions}
                    aria-controls="batch-suggestions-list"
                  />

                  {/* suggestions dropdown */}
                  {showSuggestions && filteredBatchSuggestions.length > 0 && (
                    <div
                      className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-56 overflow-auto"
                      role="listbox"
                      id="batch-suggestions-list"
                    >
                      <ul className="divide-y">
                        {filteredBatchSuggestions.map((s, i) => (
                          <li
                            key={s}
                            role="option"
                            aria-selected={highlightIndex === i}
                            onMouseEnter={() => setHighlightIndex(i)}
                            onMouseLeave={() => setHighlightIndex(-1)}
                            onMouseDown={(e) => {
                              // prevent input blur before click handler
                              e.preventDefault();
                              setBatchInput(s);
                              // note: we intentionally DO NOT apply filter immediately so user can still edit or press Apply
                              setShowSuggestions(false);
                              setHighlightIndex(-1);
                            }}
                            className={`px-3 py-2 cursor-pointer hover:bg-accent/80 ${highlightIndex === i ? "bg-accent/90" : ""}`}
                          >
                            <div className="text-sm text-foreground">{renderHighlighted(s, batchInput)}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {showSuggestions && filteredBatchSuggestions.length === 0 && batchInput.trim() !== "" && (
                    <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md p-2 text-sm text-muted-foreground">
                      No matching batches
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleFilterChange("batchId", batchInput ? batchInput : undefined);
                      setShowSuggestions(false);
                      setHighlightIndex(-1);
                    }}
                    disabled={loading}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setBatchInput("");
                      handleFilterChange("batchId", undefined);
                      setShowSuggestions(false);
                      setHighlightIndex(-1);
                    }}
                    disabled={loading}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Logical Source File Filter */}
          {showLogicalFilter && (
            <div className="space-y-2">
              <Label htmlFor="logical-input">Logical Source File</Label>
              <Input
                id="logical-input"
                placeholder="Filter by logical source file"
                value={(filters as any).logicalSourceFile || ""}
                onChange={(e) => handleFilterChange("logicalSourceFile", e.target.value || undefined)}
                disabled={loading}
              />
            </div>
          )}

          {/* Date Range Filters (kept if used by other pages) */}
          {showDateFilter && (
            <>
              <div className="space-y-2">
                <Label htmlFor="date-from">Date From</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={(filters as any).dateFrom || ""}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value || undefined)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">Date To</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={(filters as any).dateTo || ""}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value || undefined)}
                  disabled={loading}
                />
              </div>
            </>
          )}

          {/* Table Type Filter */}
          {showTableTypeFilter && (
            <div className="space-y-2">
              <Label htmlFor="table-type-select">Table Type</Label>
              <Select
                value={(filters as any).tableType || "all"}
                onValueChange={(value) => handleFilterChange("tableType", value === "all" ? undefined : value)}
                disabled={loading || !(filters as any).version}
              >
                <SelectTrigger id="table-type-select">
                  <SelectValue placeholder="Select table type" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Table Types</SelectItem>
                  <SelectItem value="dimension">Dimension</SelectItem>
                  <SelectItem value="fact">Fact</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Refresh Mode Filter */}
          {showRefreshModeFilter && (
            <div className="space-y-2">
              <Label htmlFor="refresh-mode-select">Refresh Mode</Label>
              <Select
                value={(filters as any).refreshMode || "all"}
                onValueChange={(value) => handleFilterChange("refreshMode", value === "all" ? undefined : value)}
                disabled={loading}
              >
                <SelectTrigger id="refresh-mode-select">
                  <SelectValue placeholder="Select refresh mode" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Refresh Modes</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatic">Automatic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Extra Filters */}
        {extraFilters && <div className="pt-4 border-t border-border">{extraFilters}</div>}
      </CardContent>
    </Card>
  );
}
