SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_app_users_role'
      AND [parent_object_id] = OBJECT_ID(N'[tools].[app_users]')
)
BEGIN
    ALTER TABLE [tools].[app_users]
    DROP CONSTRAINT [CK_app_users_role];
END;

UPDATE [tools].[app_users]
SET
    [role] = CASE
        WHEN [role] IN (N'PARSER', N'PARSER-TEAM') THEN N'TEAM'
        WHEN [role] = N'PARSER-INTERN' THEN N'INTERN'
        ELSE [role]
    END,
    [updated_at] = CASE
        WHEN [role] IN (N'PARSER', N'PARSER-TEAM', N'PARSER-INTERN')
            THEN SYSDATETIME()
        ELSE [updated_at]
    END
WHERE [role] IN (N'PARSER', N'PARSER-TEAM', N'PARSER-INTERN');

ALTER TABLE [tools].[app_users] WITH CHECK
ADD CONSTRAINT [CK_app_users_role]
CHECK ([role] IN (N'ADMIN', N'TEAM', N'MANAGER', N'INTERN'));

ALTER TABLE [tools].[app_users]
CHECK CONSTRAINT [CK_app_users_role];

COMMIT TRANSACTION;
