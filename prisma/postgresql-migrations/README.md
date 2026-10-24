# Archived PostgreSQL migrations

These files preserve the previous PostgreSQL migration history. Prisma does not run them from this directory. The active schema and `prisma/migrations` now target MySQL.

The MySQL initial migration creates the current schema in an empty database; it does not transfer PostgreSQL data or change an existing PostgreSQL database. Keep the previous database and backups if its records are needed, and import records separately before switching the application connection.
