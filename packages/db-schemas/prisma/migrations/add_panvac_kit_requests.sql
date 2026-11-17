-- PANVAC kit requests: country request -> PANVAC decision -> shipments -> reception.
-- Additive only. A request is either created from a request-form submission of a campaign
-- whose metadata.module = 'panvac_kits' (submission_id set) or imported as history (is_historical).

CREATE TABLE IF NOT EXISTS public.kit_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL,
  submission_id       uuid UNIQUE,
  tenant_id           uuid,
  country_code        varchar(3) NOT NULL,
  product             varchar(30),
  kit_format          varchar(20),
  quantity_requested  integer,
  desired_date        date,
  requested_at        timestamptz NOT NULL,
  requested_by        uuid,
  recipient_id        uuid,
  -- SUBMITTED | APPROVED | PARTIAL | REJECTED | CANCELLED
  status              varchar(20) NOT NULL DEFAULT 'SUBMITTED',
  quantity_approved   integer,
  available_from      date,
  available_to        date,
  decision_comment    text,
  decided_by          uuid,
  decided_at          timestamptz,
  is_historical       boolean NOT NULL DEFAULT false,
  source_ref          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kit_requests_campaign ON public.kit_requests (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_kit_requests_country ON public.kit_requests (country_code);

CREATE TABLE IF NOT EXISTS public.kit_shipments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL,
  request_id          uuid REFERENCES public.kit_requests(id) ON DELETE CASCADE,
  country_code        varchar(3) NOT NULL,
  shipped_at          date NOT NULL,
  quantity            integer NOT NULL,
  kit_format          varchar(20),
  num_samples         integer,
  lot_number          varchar(100),
  expiry_date         date,
  waybill             varchar(100),
  carrier             varchar(100),
  comment             text,
  shipped_by          uuid,
  -- Reception, filled by the requesting country
  received_at         date,
  quantity_received   integer,
  condition           varchar(20),
  reception_comment   text,
  received_by         uuid,
  confirmed_at        timestamptz,
  is_historical       boolean NOT NULL DEFAULT false,
  source_ref          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kit_shipments_request ON public.kit_shipments (request_id);
CREATE INDEX IF NOT EXISTS idx_kit_shipments_campaign ON public.kit_shipments (campaign_id);

-- Timeline / audit trail of every action on a request
CREATE TABLE IF NOT EXISTS public.kit_request_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES public.kit_requests(id) ON DELETE CASCADE,
  action      varchar(30) NOT NULL,
  actor_id    uuid,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kit_request_events_request ON public.kit_request_events (request_id, created_at);
