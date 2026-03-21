-- Metabase needs its own database for internal application tables
SELECT 'CREATE DATABASE metabase OWNER aris'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'metabase')\gexec
