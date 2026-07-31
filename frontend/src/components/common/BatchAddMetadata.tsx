// src/components/common/BatchAddMetadata.tsx
import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface BatchEditRow {
  id: string;
  [key: string]: any;
}

interface FieldOption {
  value: string;
  label: string;
}

interface BatchEditMetadataProps {
  title: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'select' | 'switch' | 'textarea' | 'number';
    options?: FieldOption[]; // inline options (static)
    required?: boolean;
    placeholder?: string;
  }[];
  initialData?: BatchEditRow[];
  onSave: (data: any[]) => Promise<void>;
  loading?: boolean;
  className?: string;
  onSaved?: () => void;
  redirectTo?: string;
  fieldOptions?: Record<string, { options: FieldOption[] }>;
}

export function BatchEditMetadata({
  title,
  fields,
  initialData = [],
  onSave,
  loading = false,
  className,
  onSaved,
  redirectTo,
  fieldOptions = {},
}: BatchEditMetadataProps) {
  const [rows, setRows] = useState<BatchEditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const { toast } = useToast();
  const nextIdRef = useRef(1);

  useEffect(() => {
    if (initialData.length > 0) {
      setRows(initialData.map(r => ({ ...r, id: String(r.id) })));
      const maxId = initialData.reduce((max, r) => {
        const num = parseInt(String(r.id), 10);
        return Number.isFinite(num) ? Math.max(max, num) : max;
      }, 0);
      nextIdRef.current = maxId + 1;
    } else {
      const initialRow: BatchEditRow = {
        id: generateId(),
        ...fields.reduce((acc, field) => {
          acc[field.name] = field.type === 'switch' ? true : '';
          return acc;
        }, {} as Record<string, any>)
      };
      setRows([initialRow]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.length]);

  const generateId = () => {
    return (nextIdRef.current++).toString();
  };

  const addRow = () => {
    const newRow: BatchEditRow = {
      id: generateId(),
      ...fields.reduce((acc, field) => {
        acc[field.name] = field.type === 'switch' ? true : '';
        return acc;
      }, {} as Record<string, any>)
    };
    setRows(prev => [...prev, newRow]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) {
      toast({
        title: "Cannot remove",
        description: "At least one row is required",
        variant: "destructive"
      });
      return;
    }
    setRows(prev => prev.filter(row => row.id !== id));
    setErrors(prev => {
      const { [id]: removed, ...rest } = prev;
      return rest;
    });
  };

  const updateRow = (id: string, field: string, value: any) => {
    setRows(prev => prev.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ));

    const fieldLabel = fields.find(f => f.name === field)?.label || field;
    setErrors(prev => {
      const existing = prev[id] || [];
      const filtered = existing.filter(msg => !msg.includes(fieldLabel));
      if (filtered.length === 0) {
        const { [id]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: filtered };
    });
  };

  const validateRows = () => {
    const newErrors: Record<string, string[]> = {};
    let hasErrors = false;

    rows.forEach(row => {
      const rowErrors: string[] = [];

      fields.forEach(field => {
        const val = row[field.name];
        const isEmpty = val === undefined || val === '' || (field.type === 'number' && val === '');
        if (field.required && isEmpty) {
          rowErrors.push(`${field.label} is required`);
          hasErrors = true;
        }
      });

      if (rowErrors.length > 0) newErrors[row.id] = rowErrors;
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  const handleSave = async () => {
    if (!validateRows()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const processedRows = rows.map(({ id, ...row }) => {
        const obj: Record<string, any> = {};
        fields.forEach(field => {
          const val = row[field.name];

          if (field.type === 'switch') {
            if (val !== undefined) obj[field.name] = !!val;
            return;
          }

          if (val === undefined || val === '') return;

          const options = field.options || fieldOptions[field.name]?.options;
          if (options && val !== undefined && val !== '') {
            if (typeof val === 'string') {
              const possibleNum = Number(val);
              if (!Number.isNaN(possibleNum)) {
                obj[field.name] = possibleNum;
                return;
              }
            }
            const found = options.find(opt => opt.value === val || opt.label === val);
            if (found) {
              const v = found.value;
              const maybeNum = Number(v);
              obj[field.name] = !Number.isNaN(maybeNum) ? maybeNum : v;
              return;
            }
            obj[field.name] = val;
            return;
          }

          if (field.type === 'number') {
            if (typeof val === 'number') obj[field.name] = val;
            else if (typeof val === 'string' && val.trim() !== '') {
              const n = Number(val);
              if (!Number.isNaN(n)) obj[field.name] = n;
            }
          } else {
            obj[field.name] = val;
          }
        });
        return obj;
      });

      await onSave(processedRows);

      toast({
        title: "Success",
        description: `${title} saved successfully`,
      });

      if (typeof onSaved === 'function') {
        try {
          onSaved();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('onSaved callback error', err);
        }
      } else if (redirectTo) {
        try {
          window.location.href = redirectTo;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('redirect error', err);
        }
      }

      const initialRow: BatchEditRow = {
        id: generateId(),
        ...fields.reduce((acc, field) => {
          acc[field.name] = field.type === 'switch' ? true : '';
          return acc;
        }, {} as Record<string, any>)
      };
      setRows([initialRow]);
      setErrors({});
    } catch (error: any) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save data",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={cn('professional-card', className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>{title}</span>
          {saving && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Data Rows */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Data Entries</h3>
            <Button
              onClick={addRow}
              variant="outline"
              size="sm"
              disabled={loading || saving}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.id} className="relative">
                <CardContent className="p-4">
                  {errors[row.id] && errors[row.id].length > 0 && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-medium">Please fix the following errors:</span>
                        <ul className="mt-1 ml-4 list-disc">
                          {errors[row.id].map((error, index) => (
                            <li key={index} className="text-sm">{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <Label htmlFor={`${row.id}-${field.name}`}>
                          {field.label} {field.required && '*'}
                        </Label>

                        {field.type === 'select' ? (
                          (() => {
                            const sourceOptions = field.options || fieldOptions[field.name]?.options || [];
                            const optionsList = sourceOptions
                              .map(opt => ({ value: String(opt.value ?? ''), label: opt.label ?? String(opt.value ?? '') }))
                              .filter(o => o.value !== '');

                            return (
                              <Select
                                value={row[field.name]?.toString() || ''}
                                onValueChange={(value) => updateRow(row.id, field.name, value)}
                                disabled={loading || saving}
                              >
                                <SelectTrigger id={`${row.id}-${field.name}`}>
                                  <SelectValue placeholder={field.placeholder || "Select..."} />
                                </SelectTrigger>
                                <SelectContent className="bg-popover">
                                  {optionsList.length === 0 ? (
                                    <SelectItem value="__no_options__" disabled>
                                      {field.placeholder || 'No options'}
                                    </SelectItem>
                                  ) : (
                                    optionsList.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            );
                          })()
                        ) : field.type === 'switch' ? (
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`${row.id}-${field.name}`}
                              checked={!!row[field.name]}
                              onCheckedChange={(checked) => updateRow(row.id, field.name, checked)}
                              disabled={loading || saving}
                            />
                            <Label htmlFor={`${row.id}-${field.name}`} className="text-sm">
                              {row[field.name] ? 'Active' : 'Inactive'}
                            </Label>
                          </div>
                        ) : (
                          <Input
                            id={`${row.id}-${field.name}`}
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={row[field.name] ?? ''}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                field.name,
                                field.type === 'number'
                                  ? (e.target.value === '' ? '' : Number(e.target.value))
                                  : e.target.value
                              )
                            }
                            placeholder={field.placeholder}
                            disabled={loading || saving}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end mt-4 pt-4 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(row.id)}
                      disabled={loading || saving || rows.length === 1}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Hapus Row
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-border">
          {/* ✅ NEW: Add Row button on bottom (same style as existing) */}
          <Button
            onClick={addRow}
            variant="outline"
            size="sm"
            disabled={loading || saving}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>

          <Button
            onClick={handleSave}
            disabled={loading || saving || rows.length === 0}
            className="interactive-button"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save {title}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
