# POS_System
Project For Midterms

## Student enrollments

Before using the enrollment form, run migrations `202610230001`, `202610230002`, and `202610230003` in order in the Supabase SQL Editor. If the enrollment table already exists, run `supabase/migrations/202610230003_enable_public_enrollment_crud.sql` to enable create, read, update, and delete without signing in. The public `anon` role can access student names and College IDs, so this data is visible to anyone with access to the app.
