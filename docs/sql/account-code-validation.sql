/*
  Table type and stored procedure for validating account codes against
  dbo.GRC_JDE_Intra_AccountCatalog.
*/
IF TYPE_ID(N'dbo.AccountCodeValidationList') IS NULL
BEGIN
    CREATE TYPE dbo.AccountCodeValidationList AS TABLE
    (
        acct_code NVARCHAR(20) NOT NULL
    );
END;
GO

CREATE OR ALTER PROCEDURE dbo.GRC_Intra_ValidateAccountCodes
    @codes dbo.AccountCodeValidationList READONLY
AS
BEGIN
    SET NOCOUNT ON;

    WITH normalized_codes AS (
        SELECT DISTINCT
            UPPER(LTRIM(RTRIM(acct_code))) AS acct_code
        FROM @codes
        WHERE acct_code IS NOT NULL
          AND LTRIM(RTRIM(acct_code)) <> N''
    )
    SELECT
        input.acct_code AS acct_code,
        CASE WHEN catalog.full_account IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS isValid,
        COALESCE(catalog.taskcode_description, N'') AS taskcode_description,
        COALESCE(catalog.account_description, N'') AS account_description
    FROM normalized_codes AS input
    LEFT JOIN dbo.GRC_JDE_Intra_AccountCatalog AS catalog
        ON UPPER(LTRIM(RTRIM(catalog.full_account))) = input.acct_code;
END;
GO
