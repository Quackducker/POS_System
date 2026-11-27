# POS System

## Laboratories 1-17 Completion

This project implements the construction and integration work through Laboratory 17:

- Development environment and Supabase connection
- POS database tables and relationships
- Product CRUD and inventory monitoring
- Customer management
- Shopping cart and checkout
- Atomic sales processing and stock deduction
- Cash, card, and e-wallet payment handling
- Printable receipts
- Sales history and reports
- POS dashboard
- Input validation and error handling
- Supabase authentication
- Role-based access and complete module integration

Run `supabase/migrations/202611240001_laboratories_1_to_17_pos.sql` in the Supabase SQL Editor before using the POS transaction flow.
Run `supabase/migrations/202611270001_delete_pos_user.sql` afterward to enable secure permanent deletion of Supabase user accounts.
Run `supabase/migrations/202611270002_admin_only_user_deletion.sql` to restrict permanent user deletion to Administrators.

Laboratories 18 onward are intentionally not included.

## Role access

- Administrator: Full system access, including dashboard and user management
- Manager: Products, sales, and reports
- Cashier: Sales and the receipt flow
- Inventory Staff: Products and inventory

Users, customers, sales history, and the dashboard are restricted to Administrators unless included above. Each role is sent to an allowed page after login; direct navigation to restricted pages is denied.

