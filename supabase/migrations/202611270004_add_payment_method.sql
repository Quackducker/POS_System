alter table public.payments
  add column if not exists payment_method text;

notify pgrst, 'reload schema';
