-- Runs once, the first time the Postgres container starts with an empty volume.
-- The main database (taskmaster) is created by the POSTGRES_DB variable;
-- this adds the separate database used by the automated tests.
CREATE DATABASE taskmaster_test OWNER taskmaster;
