/* =========================================================
   ACTIVITY REPORT - GENERIC AUDIT TRAIL
   Database : MSSQL 2019
   Schema   : tools
   Table    : activity_audit_log

   Purpose:
   - Menyimpan history INSERT / UPDATE / DELETE non-parsing.
   - Dipakai oleh Produk Distributor, ARTBST, User Management,
     dan master berikutnya.
   - Terpisah dari tools.odists_parsing_audit_log.
   ========================================================= */

IF OBJECT_ID(N'[tools].[activity_audit_log]', N'U') IS NULL
BEGIN
    CREATE TABLE [tools].[activity_audit_log] (
        [activity_id] BIGINT IDENTITY(1,1) NOT NULL,
        [batch_id] UNIQUEIDENTIFIER NOT NULL,
        [module_key] NVARCHAR(100) NOT NULL,
        [module_label] NVARCHAR(150) NOT NULL,
        [table_name] NVARCHAR(256) NOT NULL,
        [record_id] NVARCHAR(100) NOT NULL,
        [record_label] NVARCHAR(500) NULL,
        [action] NVARCHAR(20) NOT NULL,
        [actor_user_id] INT NULL,
        [actor_username] NVARCHAR(100) NOT NULL,
        [actor_full_name] NVARCHAR(191) NOT NULL,
        [changed_fields] NVARCHAR(MAX) NOT NULL,
        [old_values] NVARCHAR(MAX) NOT NULL,
        [new_values] NVARCHAR(MAX) NOT NULL,
        [activity_source] NVARCHAR(50) NOT NULL
            CONSTRAINT [DF_activity_audit_log_source]
            DEFAULT N'WEBAPP',
        [changed_at] DATETIME2 NOT NULL
            CONSTRAINT [DF_activity_audit_log_changed_at]
            DEFAULT SYSDATETIME(),

        CONSTRAINT [PK_activity_audit_log]
            PRIMARY KEY ([activity_id]),

        CONSTRAINT [CK_activity_audit_log_action]
            CHECK ([action] IN (N'INSERT', N'UPDATE', N'DELETE')),

        CONSTRAINT [CK_activity_audit_log_changed_fields_json]
            CHECK (ISJSON([changed_fields]) = 1),

        CONSTRAINT [CK_activity_audit_log_old_values_json]
            CHECK (ISJSON([old_values]) = 1),

        CONSTRAINT [CK_activity_audit_log_new_values_json]
            CHECK (ISJSON([new_values]) = 1)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_activity_audit_log_changed_at'
      AND [object_id] = OBJECT_ID(N'[tools].[activity_audit_log]')
)
BEGIN
    CREATE INDEX [IX_activity_audit_log_changed_at]
        ON [tools].[activity_audit_log]
           ([changed_at] DESC, [activity_id] DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_activity_audit_log_module_action'
      AND [object_id] = OBJECT_ID(N'[tools].[activity_audit_log]')
)
BEGIN
    CREATE INDEX [IX_activity_audit_log_module_action]
        ON [tools].[activity_audit_log]
           ([module_key], [action], [changed_at] DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_activity_audit_log_actor'
      AND [object_id] = OBJECT_ID(N'[tools].[activity_audit_log]')
)
BEGIN
    CREATE INDEX [IX_activity_audit_log_actor]
        ON [tools].[activity_audit_log]
           ([actor_user_id], [changed_at] DESC);
END;
GO
