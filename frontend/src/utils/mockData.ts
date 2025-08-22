// Mock data based on provided dummy records
import { 
  ClientReference, 
  ClientConfig, 
  ColumnMapping, 
  RequiredColumn, 
  TransformationConfig,
  IntegrationConfig,
  MvRefreshConfig,
  IntegrationDependency,
  FileAuditLog,
  MappingValidationLog,
  RowValidationLog,
  LoadErrorLog,
  TransformationLog,
  JobExecutionLog,
  IntegrationLog,
  MvRefreshLog
} from '@/types';

export const mockClients: ClientReference[] = [
  {
    client_id: 1,
    client_schema: "schema_a",
    client_name: "Client A",
    config_version: "v1",
    mapping_version: "v2",
    required_column_version: "v1",
    last_batch_id: "BATCH001"
  },
  {
    client_id: 2,
    client_schema: "schema_b",
    client_name: "Client B",
    config_version: "v2",
    mapping_version: "v1",
    required_column_version: "v2",
    last_batch_id: "BATCH002"
  }
];

export const mockClientConfigs: ClientConfig[] = [
  {
    config_id: 1,
    client_id: 1,
    source_type: "csv",
    target_schema: "public",
    target_table: "customer",
    source_config: { delimiter: ",", encoding: "utf-8" },
    is_active: true,
    config_version: "v1",
    logical_source_file: "customer_data.csv"
  },
  {
    config_id: 2,
    client_id: 1,
    source_type: "json",
    target_schema: "public",
    target_table: "orders",
    source_config: { encoding: "utf-8" },
    is_active: true,
    config_version: "v1",
    logical_source_file: "orders_data.json"
  }
];

export const mockColumnMappings: ColumnMapping[] = [
  {
    mapping_id: 1,
    client_id: 1,
    source_column: "first_name",
    target_column: "fname",
    mapping_version: "v2",
    logical_source_file: "customer_data.csv"
  },
  {
    mapping_id: 2,
    client_id: 1,
    source_column: "last_name",
    target_column: "lname",
    mapping_version: "v2",
    logical_source_file: "customer_data.csv"
  }
];

export const mockRequiredColumns: RequiredColumn[] = [
  {
    required_id: 1,
    client_id: 1,
    column_name: "email",
    required_column_version: "v1",
    logical_source_file: "customer_data.csv"
  },
  {
    required_id: 2,
    client_id: 1,
    column_name: "phone",
    required_column_version: "v1",
    logical_source_file: "customer_data.csv"
  }
];

export const mockTransformationConfigs: TransformationConfig[] = [
  {
    transform_id: 1,
    client_id: 1,
    proc_name: "clean_customer_data",
    is_active: true,
    created_at: "2025-08-01T10:00:00",
    created_by: "system"
  },
  {
    transform_id: 2,
    client_id: 1,
    proc_name: "validate_orders",
    is_active: true,
    created_at: "2025-08-01T10:30:00",
    created_by: "admin"
  }
];

export const mockIntegrationConfigs: IntegrationConfig[] = [
  {
    integration_id: 1,
    client_id: 1,
    proc_name: "sync_customer_data",
    is_active: true,
    created_at: "2025-08-01T11:00:00",
    created_by: "system",
    table_type: "dimension",
    run_order: 1
  },
  {
    integration_id: 2,
    client_id: 1,
    proc_name: "export_orders",
    is_active: false,
    created_at: "2025-08-01T11:30:00",
    created_by: "admin",
    table_type: "fact",
    run_order: 3
  },
  {
    integration_id: 3,
    client_id: 2,
    proc_name: "import_products",
    is_active: true,
    created_at: "2025-08-02T09:00:00",
    created_by: "system",
    table_type: "dimension",
    run_order: 2
  }
];

export const mockMvRefreshConfigs: MvRefreshConfig[] = [
  {
    mv_id: 1,
    client_id: 1,
    mv_proc_name: "refresh_customer_summary_mv",
    is_active: true,
    refresh_mode: "manual",
    created_at: "2025-08-01T12:00:00",
    created_by: "system"
  },
  {
    mv_id: 2,
    client_id: 1,
    mv_proc_name: "refresh_order_analytics_mv",
    is_active: false,
    refresh_mode: "automatic",
    created_at: "2025-08-01T12:30:00",
    created_by: "admin"
  },
  {
    mv_id: 3,
    client_id: 2,
    mv_proc_name: "refresh_product_stats_mv",
    is_active: true,
    refresh_mode: "manual",
    created_at: "2025-08-02T10:00:00",
    created_by: "system"
  }
];

export const mockIntegrationDependencies: IntegrationDependency[] = [
  {
    dependency_id: 1,
    client_id: 1,
    fact_proc_name: "load_sales_fact",
    dim_proc_name: "load_customer_dim"
  },
  {
    dependency_id: 2,
    client_id: 1,
    fact_proc_name: "load_sales_fact",
    dim_proc_name: "load_product_dim"
  },
  {
    dependency_id: 3,
    client_id: 2,
    fact_proc_name: "load_order_fact",
    dim_proc_name: "load_vendor_dim"
  }
];

export const mockFileAuditLogs: FileAuditLog[] = [
  {
    file_audit_id: 1,
    client_id: 1,
    convert_status: "Success",
    mapping_validation_status: "Passed",
    row_validation_status: "Passed",
    load_status: "Loaded",
    total_rows: 500,
    valid_rows: 495,
    invalid_rows: 5,
    processed_by: "ETL Job",
    logical_source_file: "customer_data.csv",
    physical_file_name: "cust_august.csv",
    parquet_file_name: "cust_august.parquet",
    batch_id: "BATCH001",
    file_received_time: "2025-08-01T09:30:00",
    parquet_converted_time: "2025-08-01T09:35:00"
  },
  {
    file_audit_id: 2,
    client_id: 1,
    convert_status: "Failed",
    mapping_validation_status: "Failed",
    row_validation_status: "Pending",
    load_status: "Pending",
    total_rows: 300,
    valid_rows: 0,
    invalid_rows: 300,
    processed_by: "ETL Job",
    logical_source_file: "orders_data.json",
    physical_file_name: "orders_july.json",
    parquet_file_name: "orders_july_converted.parquet",
    batch_id: "BATCH002",
    file_received_time: "2025-07-31T14:15:00",
    parquet_converted_time: "2025-07-31T14:20:00"
  }
];

export const mockMappingValidationLogs: MappingValidationLog[] = [
  {
    mapping_id: 1,
    client_id: 1,
    missing_columns: "phone_number",
    extra_columns: "middle_name",
    expected_columns: "first_name,last_name,email,phone_number",
    received_columns: "first_name,last_name,email,middle_name",
    file_name: "customer_data.csv",
    batch_id: "BATCH001",
    timestamp: "2025-08-01T09:32:00"
  }
];

export const mockRowValidationLogs: RowValidationLog[] = [
  {
    error_id: 1,
    client_id: 1,
    file_name: "customer_data.csv",
    column_name: "email",
    row_number: 45,
    error_type: "Invalid Format",
    error_detail: "Email format is invalid",
    batch_id: "BATCH001",
    timestamp: "2025-08-01T09:33:00"
  },
  {
    error_id: 2,
    client_id: 1,
    file_name: "customer_data.csv",
    column_name: "phone",
    row_number: 123,
    error_type: "Missing Value",
    error_detail: "Required field is empty",
    batch_id: "BATCH001",
    timestamp: "2025-08-01T09:33:15"
  }
];

export const mockLoadErrorLogs: LoadErrorLog[] = [
  {
    error_id: 1,
    client_id: 1,
    error_detail: "Connection timeout to database",
    stage: "Load",
    file_name: "orders_data.json",
    batch_id: "BATCH002",
    timestamp: "2025-07-31T14:25:00"
  }
];

export const mockTransformationLogs: TransformationLog[] = [
  {
    transform_log_id: 1,
    client_id: 1,
    status: "Success",
    record_count: 495,
    source_table: "staging_customer",
    target_table: "customer",
    batch_id: "BATCH001",
    message: "Customer data transformation completed successfully",
    timestamp: "2025-08-01T09:40:00"
  }
];

export const mockJobExecutionLogs: JobExecutionLog[] = [
  {
    job_id: 1,
    client_id: 1,
    job_name: "Customer Data ETL",
    status: "Completed",
    error_message: null,
    file_name: "customer_data.csv",
    batch_id: "BATCH001",
    start_time: "2025-08-01T09:30:00",
    end_time: "2025-08-01T09:45:00"
  },
  {
    job_id: 2,
    client_id: 1,
    job_name: "Orders Data ETL",
    status: "Failed",
    error_message: "Database connection failed",
    file_name: "orders_data.json",
    batch_id: "BATCH002",
    start_time: "2025-07-31T14:15:00",
    end_time: "2025-07-31T14:25:00"
  }
];

export const mockIntegrationLogs: IntegrationLog[] = [
  {
    integration_log_id: 1,
    client_id: 1,
    status: "SUCCESS",
    record_count: 1250,
    proc_name: "load_customer_dim",
    table_type: "dimension",
    batch_id: "BATCH001",
    message: "Customer dimension loaded successfully",
    start_time: "2025-08-01T10:00:00",
    end_time: "2025-08-01T10:05:00"
  },
  {
    integration_log_id: 2,
    client_id: 1,
    status: "SUCCESS",
    record_count: 3400,
    proc_name: "load_sales_fact",
    table_type: "fact",
    batch_id: "BATCH001",
    message: "Sales fact table loaded successfully",
    start_time: "2025-08-01T10:05:00",
    end_time: "2025-08-01T10:12:00"
  },
  {
    integration_log_id: 3,
    client_id: 2,
    status: "FAILED",
    record_count: 0,
    proc_name: "load_product_dim",
    table_type: "dimension",
    batch_id: "BATCH003",
    message: "Connection timeout during dimension load",
    start_time: "2025-08-02T11:00:00",
    end_time: "2025-08-02T11:02:00"
  }
];

export const mockMvRefreshLogs: MvRefreshLog[] = [
  {
    mv_log_id: 1,
    client_id: 1,
    status: "SUCCESS",
    proc_mv_name: "refresh_customer_summary_mv",
    batch_id: "BATCH001",
    message: "Customer summary MV refreshed successfully",
    start_time: "2025-08-01T10:15:00",
    end_time: "2025-08-01T10:18:00"
  },
  {
    mv_log_id: 2,
    client_id: 1,
    status: "FAILED",
    proc_mv_name: "refresh_order_analytics_mv",
    batch_id: "BATCH002",
    message: "MV refresh failed due to insufficient disk space",
    start_time: "2025-08-01T11:00:00",
    end_time: "2025-08-01T11:02:00"
  },
  {
    mv_log_id: 3,
    client_id: 2,
    status: "SUCCESS",
    proc_mv_name: "refresh_product_stats_mv",
    message: "Product statistics MV refreshed successfully",
    start_time: "2025-08-02T12:00:00",
    end_time: "2025-08-02T12:03:00"
  }
];

// Validation utility
export const validateVersionFormat = (version: string): boolean => {
  return /^v\d+$/.test(version);
};

// Status color mapping
export const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'success':
    case 'passed':
    case 'loaded':
    case 'completed':
      return 'text-green-600 bg-green-100';
    case 'failed':
    case 'error':
      return 'text-red-600 bg-red-100';
    case 'pending':
    case 'processing':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};