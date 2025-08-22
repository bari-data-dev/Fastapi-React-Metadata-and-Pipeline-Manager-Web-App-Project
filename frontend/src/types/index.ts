// Types based on Pydantic schemas
export interface ClientReference {
  client_id: number;
  client_schema: string;
  client_name: string;
  // versi dihapus dari tipe frontend
  // config_version?: string;
  // mapping_version?: string;
  // required_column_version?: string;

  // last_batch_id sekarang optional karena tidak selalu diset
  last_batch_id?: string;
}

export interface ClientConfig {
  config_id: number;
  client_id: number;
  source_type: string;
  target_schema: string;
  target_table: string;
  source_config?: any;
  is_active?: boolean;
  //config_version?: string;
  logical_source_file?: string;
}

export interface ColumnMapping {
  mapping_id: number;
  client_id: number;
  source_column: string;
  target_column: string;
  //mapping_version: string;
  logical_source_file: string;
}

export interface RequiredColumn {
  required_id: number;
  client_id: number;
  column_name: string;
  //required_column_version: string;
  logical_source_file: string;
}

export interface TransformationConfig {
  transform_id: number;
  client_id: number;
  proc_name: string;
  is_active?: boolean;
  created_at?: string;
  created_by?: string;
}

export interface IntegrationConfig {
  integration_id: number;
  client_id: number;
  proc_name: string;
  is_active?: boolean;
  created_at?: string;
  created_by?: string;
  table_type?: string;
  run_order?: number;
}

export interface IntegrationDependency {
  dependency_id: number;
  client_id: number;
  fact_proc_name: string;
  dim_proc_name: string;
}

export interface MvRefreshConfig {
  mv_id: number;
  client_id: number;
  mv_proc_name: string;
  is_active: boolean;
  refresh_mode?: string;
  created_at?: string;
  created_by?: string;
}



export interface FileAuditLog {
  file_audit_id: number;
  client_id: number;
  convert_status?: string;
  mapping_validation_status?: string;
  row_validation_status?: string;
  load_status?: string;
  total_rows?: number;
  valid_rows?: number;
  invalid_rows?: number;
  processed_by?: string;
  logical_source_file?: string;
  physical_file_name?: string;
  parquet_file_name?: string;
  batch_id?: string;
  file_received_time?: string;
  parquet_converted_time?: string;
}

export interface MappingValidationLog {
  mapping_id: number;
  client_id: number;
  missing_columns?: string;
  extra_columns?: string;
  expected_columns?: string;
  received_columns?: string;
  file_name?: string;
  batch_id?: string;
  timestamp?: string;
}

export interface RowValidationLog {
  error_id: number;
  client_id?: number;
  file_name?: string;
  column_name?: string;
  row_number?: number;
  error_type?: string;
  error_detail?: string;
  batch_id?: string;
  timestamp?: string;
}

export interface LoadErrorLog {
  error_id: number;
  client_id?: number;
  error_detail?: string;
  stage?: string;
  file_name?: string;
  batch_id?: string;
  timestamp?: string;
}

export interface TransformationLog {
  transform_log_id: number;
  client_id?: number;
  status?: string;
  record_count?: number;
  source_table?: string;
  target_table?: string;
  batch_id?: string;
  message?: string;
  timestamp?: string;
}

export interface JobExecutionLog {
  job_id: number;
  client_id: number;
  job_name?: string;
  status?: string;
  error_message?: string;
  file_name?: string;
  batch_id?: string;
  start_time?: string;
  end_time?: string;
}

export interface IntegrationLog {
  integration_log_id: number;
  client_id: number;
  status?: string;
  record_count?: number;
  proc_name: string;
  table_type?: string;
  batch_id?: string;
  message?: string;
  start_time?: string;
  end_time?: string;
}

export interface MvRefreshLog {
  mv_log_id: number;
  client_id: number;
  status?: string;
  proc_mv_name: string;
  batch_id?: string;
  message?: string;
  start_time?: string;
  end_time?: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}


// Filter types
export interface FilterOptions {
  clientId?: number;
  version?: string;
  status?: string;
  batchId?: string;
  dateFrom?: string;
  dateTo?: string;
  tableType?: string;
  refreshMode?: string;
}