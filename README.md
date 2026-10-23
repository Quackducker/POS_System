# POS_System
Project For Midterms

## Student enrollments

Before using the enrollment form, run `supabase/migrations/202610230001_create_enrollments.sql` in the Supabase SQL Editor. If the table already exists, run `supabase/migrations/202610230002_allow_public_enrollments.sql` instead. The public `anon` role can view and add enrollment records without signing in. This exposes student names and College IDs to anyone with access to the app.
