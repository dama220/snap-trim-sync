CREATE TABLE public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  state jsonb not null default '{}'::jsonb,
  salon_id uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access" ON public.whatsapp_sessions FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_whatsapp_sessions_phone ON public.whatsapp_sessions(phone);