-- BergLabs bills customers via manual invoices outside the app.
-- All organizations are active by default; Stripe fields remain for
-- optional future use but are no longer required for access.

alter table public.organizations
  alter column subscription_status set default 'active';

update public.organizations
set subscription_status = 'active'
where subscription_status in ('inactive', 'incomplete', 'incomplete_expired');
