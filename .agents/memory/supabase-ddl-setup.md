---
name: Supabase schema setup
description: The connected Supabase REST connector can read and write known tables but cannot run arbitrary DDL.
---

The shared app schema must be initialized outside the REST connector, using the checked-in SQL schema or a database-management integration.

**Why:** PostgREST access returns missing-table errors for an uncreated table, while Supabase project introspection and arbitrary CREATE TABLE statements are not available through the app connector.

**How to apply:** Before testing shared-state sync, run the repository's Supabase schema SQL once in the connected project's SQL Editor, then verify the API state endpoint and seed behavior.