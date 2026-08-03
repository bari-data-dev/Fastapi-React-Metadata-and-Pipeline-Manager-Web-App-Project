SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'[tools].[odists_parsing_baseline]', N'U') IS NULL
BEGIN
    CREATE TABLE [tools].[odists_parsing_baseline] (
        [odist_id] BIGINT NOT NULL,
        [original_values] NVARCHAR(MAX) NOT NULL,
        [baseline_source] NVARCHAR(50) NOT NULL,
        [baseline_created_at] DATETIME2 NOT NULL
            CONSTRAINT [DF_odists_parsing_baseline_created_at] DEFAULT SYSDATETIME(),
        [baseline_updated_at] DATETIME2 NOT NULL
            CONSTRAINT [DF_odists_parsing_baseline_updated_at] DEFAULT SYSDATETIME(),
        CONSTRAINT [PK_odists_parsing_baseline]
            PRIMARY KEY ([odist_id]),
        CONSTRAINT [CK_odists_parsing_baseline_json]
            CHECK (ISJSON([original_values]) = 1)
    );
END;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[tools].[odists_parsing_baseline]')
      AND name = N'PK_odists_parsing_baseline'
      AND ignore_dup_key = 0
)
BEGIN
    ALTER INDEX [PK_odists_parsing_baseline]
        ON [tools].[odists_parsing_baseline]
        REBUILD WITH (IGNORE_DUP_KEY = ON);
END;

IF COL_LENGTH(N'tools.odists_parsing_audit_log', N'actor_full_name') IS NULL
BEGIN
    ALTER TABLE [tools].[odists_parsing_audit_log]
        ADD [actor_full_name] NVARCHAR(191) NULL;
END;

IF COL_LENGTH(N'tools.odists_parsing_audit_log', N'change_type') IS NULL
BEGIN
    ALTER TABLE [tools].[odists_parsing_audit_log]
        ADD [change_type] NVARCHAR(40) NULL;
END;

IF COL_LENGTH(N'tools.odists_parsing_audit_log', N'apply_status') IS NULL
BEGIN
    ALTER TABLE [tools].[odists_parsing_audit_log]
        ADD [apply_status] NVARCHAR(20) NOT NULL
            CONSTRAINT [DF_odists_parsing_audit_apply_status]
            DEFAULT N'COMMITTED' WITH VALUES;
END;

UPDATE audit_log
SET actor_full_name = COALESCE(NULLIF(LTRIM(RTRIM(app_user.full_name)), N''), audit_log.username)
FROM [tools].[odists_parsing_audit_log] AS audit_log
LEFT JOIN [tools].[app_users] AS app_user
    ON app_user.user_id = audit_log.user_id
WHERE audit_log.actor_full_name IS NULL;

UPDATE audit_log
SET change_type = CASE
    WHEN audit_flags.has_ogal = 1 AND audit_flags.has_revision = 1
        THEN N'PARSING & REVISI DATA'
    WHEN audit_flags.has_ogal = 1
        THEN N'PARSING'
    WHEN audit_flags.has_revision = 1
        THEN N'REVISI DATA'
    ELSE N'LAINNYA'
END
FROM [tools].[odists_parsing_audit_log] AS audit_log
CROSS APPLY (
    SELECT
        MAX(CASE WHEN json_field.[value] = N'ogal_id' THEN 1 ELSE 0 END) AS has_ogal,
        MAX(CASE WHEN json_field.[value] IN (
            N'dist_code', N'cust_code', N'cust_name', N'address',
            N'type_outlet', N'city', N'province', N'kecamatan',
            N'kota', N'provinsi'
        ) THEN 1 ELSE 0 END) AS has_revision
    FROM OPENJSON(
        CASE WHEN ISJSON(audit_log.changed_fields) = 1
             THEN audit_log.changed_fields
             ELSE N'[]'
        END
    ) AS json_field
) AS audit_flags
WHERE audit_log.change_type IS NULL;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[tools].[odists_parsing_audit_log]')
      AND name = N'IX_odists_parsing_audit_change_type'
)
BEGIN
    CREATE INDEX [IX_odists_parsing_audit_change_type]
        ON [tools].[odists_parsing_audit_log] (
            [change_type] ASC,
            [changed_at] DESC
        );
END;

COMMIT TRANSACTION;
GO

CREATE OR ALTER TRIGGER [tools].[trg_odists_parsing_audit_enrich]
ON [tools].[odists_parsing_audit_log]
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE audit_log
    SET
        actor_full_name = COALESCE(
            NULLIF(LTRIM(RTRIM(audit_log.actor_full_name)), N''),
            NULLIF(LTRIM(RTRIM(app_user.full_name)), N''),
            audit_log.username
        ),
        change_type = CASE
            WHEN audit_flags.has_ogal = 1 AND audit_flags.has_revision = 1
                THEN N'PARSING & REVISI DATA'
            WHEN audit_flags.has_ogal = 1
                THEN N'PARSING'
            WHEN audit_flags.has_revision = 1
                THEN N'REVISI DATA'
            ELSE N'LAINNYA'
        END
    FROM [tools].[odists_parsing_audit_log] AS audit_log
    INNER JOIN inserted AS inserted_row
        ON inserted_row.audit_id = audit_log.audit_id
    LEFT JOIN [tools].[app_users] AS app_user
        ON app_user.user_id = audit_log.user_id
    CROSS APPLY (
        SELECT
            MAX(CASE WHEN json_field.[value] = N'ogal_id' THEN 1 ELSE 0 END) AS has_ogal,
            MAX(CASE WHEN json_field.[value] IN (
                N'dist_code', N'cust_code', N'cust_name', N'address',
                N'type_outlet', N'city', N'province', N'kecamatan',
                N'kota', N'provinsi'
            ) THEN 1 ELSE 0 END) AS has_revision
        FROM OPENJSON(
            CASE WHEN ISJSON(audit_log.changed_fields) = 1
                 THEN audit_log.changed_fields
                 ELSE N'[]'
            END
        ) AS json_field
    ) AS audit_flags;
END;
GO
