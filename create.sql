BEGIN TRANSACTION;
CREATE TABLE [logs] (
   [docsDevEvFirstTime] TEXT,
   [docsDevEvLastTime] TEXT,
   [docsDevEvCounts] INTEGER,
   [docsDevEvLevel] TEXT,
   [docsDevEvId] INTEGER,
   [docsDevEvText] TEXT,
   PRIMARY KEY (docsDevEvFirstTime, docsDevEvLastTime, docsDevEvCounts, docsDevEvLevel, docsDevEvId, docsDevEvText)
);
COMMIT;
