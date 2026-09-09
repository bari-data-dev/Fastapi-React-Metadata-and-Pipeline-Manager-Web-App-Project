SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'[bronze_so].[distributor]', N'U') IS NULL
    BEGIN
        CREATE TABLE [bronze_so].[distributor] (
            [iddistributor] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [Kode_Dist] NVARCHAR(MAX) NULL,
            [Kode_Dist_Grup] NVARCHAR(MAX) NULL,
            [Nama_Dist] NVARCHAR(MAX) NULL,
            [Nama_Dist_Grup] NVARCHAR(MAX) NULL,
            [Tgl_Gabung] NVARCHAR(MAX) NULL,
            [Tgl_Data_Pertama] NVARCHAR(MAX) NULL,
            [status] NVARCHAR(MAX) NULL
        );
    END
    ELSE IF
        COLUMNPROPERTY(
            OBJECT_ID(N'[bronze_so].[distributor]'),
            N'iddistributor',
            'IsIdentity'
        ) = 1
        AND (
            SELECT COUNT(*)
            FROM sys.columns
            WHERE [object_id] = OBJECT_ID(N'[bronze_so].[distributor]')
        ) = 8
        AND COL_LENGTH(N'bronze_so.distributor', N'Kode_Dist') IS NOT NULL
        AND COL_LENGTH(N'bronze_so.distributor', N'Kode_Dist_Grup') IS NOT NULL
        AND COL_LENGTH(N'bronze_so.distributor', N'Nama_Dist') IS NOT NULL
        AND COL_LENGTH(N'bronze_so.distributor', N'Nama_Dist_Grup') IS NOT NULL
        AND COL_LENGTH(N'bronze_so.distributor', N'Tgl_Gabung') IS NOT NULL
        AND COL_LENGTH(N'bronze_so.distributor', N'Tgl_Data_Pertama') IS NOT NULL
        AND COL_LENGTH(N'bronze_so.distributor', N'status') IS NOT NULL
    BEGIN
        PRINT 'bronze_so.distributor sudah menggunakan struktur baru. Tidak ada perubahan.';
    END
    ELSE
    BEGIN
        IF COL_LENGTH(N'bronze_so.distributor', N'iddistributor') IS NULL
            THROW 50001, 'Kolom iddistributor tidak ditemukan pada bronze_so.distributor.', 1;

        IF EXISTS (
            SELECT 1
            FROM [bronze_so].[distributor]
            WHERE NULLIF(LTRIM(RTRIM([iddistributor])), N'') IS NULL
               OR TRY_CONVERT(INT, LTRIM(RTRIM([iddistributor]))) IS NULL
               OR TRY_CONVERT(INT, LTRIM(RTRIM([iddistributor]))) <= 0
        )
            THROW 50002, 'Migration dibatalkan: iddistributor legacy harus numeric, positif, dan tidak NULL.', 1;

        IF EXISTS (
            SELECT TRY_CONVERT(INT, LTRIM(RTRIM([iddistributor])))
            FROM [bronze_so].[distributor]
            GROUP BY TRY_CONVERT(INT, LTRIM(RTRIM([iddistributor])))
            HAVING COUNT(*) > 1
        )
            THROW 50003, 'Migration dibatalkan: terdapat iddistributor legacy duplikat.', 1;

        IF OBJECT_ID(N'[bronze_so].[distributor_new]', N'U') IS NOT NULL
            THROW 50004, 'Tabel bronze_so.distributor_new sudah ada. Hapus/cek tabel tersebut sebelum migration.', 1;

        CREATE TABLE [bronze_so].[distributor_new] (
            [iddistributor] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [Kode_Dist] NVARCHAR(MAX) NULL,
            [Kode_Dist_Grup] NVARCHAR(MAX) NULL,
            [Nama_Dist] NVARCHAR(MAX) NULL,
            [Nama_Dist_Grup] NVARCHAR(MAX) NULL,
            [Tgl_Gabung] NVARCHAR(MAX) NULL,
            [Tgl_Data_Pertama] NVARCHAR(MAX) NULL,
            [status] NVARCHAR(MAX) NULL
        );

        SET IDENTITY_INSERT [bronze_so].[distributor_new] ON;

        INSERT INTO [bronze_so].[distributor_new] (
            [iddistributor],
            [Kode_Dist],
            [Kode_Dist_Grup],
            [Nama_Dist],
            [Nama_Dist_Grup],
            [Tgl_Gabung],
            [Tgl_Data_Pertama],
            [status]
        )
        SELECT
            TRY_CONVERT(INT, LTRIM(RTRIM([iddistributor]))),
            [Kode_Dist],
            [Kode_Dist_Grup],
            [Nama_Dist],
            [Nama_Dist_Grup],
            [Tgl_Gabung],
            [Tgl_Data_Pertama],
            [status]
        FROM [bronze_so].[distributor];

        SET IDENTITY_INSERT [bronze_so].[distributor_new] OFF;

        DROP TABLE [bronze_so].[distributor];
        EXEC sys.sp_rename N'bronze_so.distributor_new', N'distributor';
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
