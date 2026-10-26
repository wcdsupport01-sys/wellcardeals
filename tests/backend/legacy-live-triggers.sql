-- Reviewed 2026-10-26 from the deployed schema. No customer rows or credentials.

-- Install before v2/v3 to exercise the legacy inspection, bid and outbox rules.

CREATE OR REPLACE FUNCTION public.log_car_price_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status is distinct from old.status
     or new.reserve_price is distinct from old.reserve_price
     or new.buy_now_price is distinct from old.buy_now_price
  then
    insert into public.car_price_status_history (
      car_id, changed_by, old_status, new_status,
      old_reserve_price, new_reserve_price,
      old_buy_now_price, new_buy_now_price
    ) values (
      new.id, auth.uid(), old.status, new.status,
      old.reserve_price, new.reserve_price,
      old.buy_now_price, new.buy_now_price
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_bid_amount()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_highest_bid NUMERIC;
BEGIN
    SELECT COALESCE(MAX(amount), 0) INTO current_highest_bid
    FROM car_bids
    WHERE car_id = NEW.car_id;

    IF NEW.amount < (current_highest_bid + 5000) THEN
        RAISE EXCEPTION 'Bid amount must be at least ₹5000 higher than the current highest bid.';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_cars_master_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_id UUID;
  v_agent_name TEXT;
BEGIN
  -- Look up assigned agent via car_auction_requests table
  SELECT r.assigned_agent_id
    INTO v_agent_id
  FROM public.car_auction_requests r
  WHERE r.car_id = NEW.id
  ORDER BY r.updated_at DESC
  LIMIT 1;

  IF v_agent_id IS NOT NULL THEN
    SELECT full_name INTO v_agent_name FROM public.profiles WHERE id = v_agent_id;
  END IF;

  INSERT INTO public.sheet_sync_queue (sheet_tab, row_key, payload)
  VALUES (
    'Cars_Master',
    NEW.id::text,
    jsonb_build_object(
      'car_id', NEW.id,
      'make_model_year', CONCAT_WS(' ', NEW.brand_id, NEW.model_id, NEW.year),
      'seller_info', NEW.created_by,
      'status', NEW.status,
      'assigned_agent_id', v_agent_id,
      'assigned_agent_name', v_agent_name,
      'final_price', COALESCE(NEW.buy_now_price, NEW.reserve_price),
      'listing_type', NEW.listing_type,
      'listing_date', NEW.created_at,
      'sold_date', CASE WHEN NEW.status = 'sold' THEN NOW() ELSE NULL END
    )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_cars_master_sync_on_agent_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_car public.cars;
  v_agent_name TEXT;
BEGIN
  IF NEW.car_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
    SELECT * INTO v_car FROM public.cars WHERE id = NEW.car_id;
    IF v_car.id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT full_name INTO v_agent_name FROM public.profiles WHERE id = NEW.assigned_agent_id;

    INSERT INTO public.sheet_sync_queue (sheet_tab, row_key, payload)
    VALUES (
      'Cars_Master',
      v_car.id::text,
      jsonb_build_object(
        'car_id', v_car.id,
        'make_model_year', CONCAT_WS(' ', v_car.brand_id, v_car.model_id, v_car.year),
        'seller_info', v_car.created_by,
        'status', v_car.status,
        'assigned_agent_id', NEW.assigned_agent_id,
        'assigned_agent_name', v_agent_name,
        'final_price', COALESCE(v_car.buy_now_price, v_car.reserve_price),
        'listing_type', v_car.listing_type,
        'listing_date', v_car.created_at,
        'sold_date', CASE WHEN v_car.status = 'sold' THEN NOW() ELSE NULL END
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_agents_directory_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'agent' THEN
    INSERT INTO public.sheet_sync_queue (sheet_tab, row_key, payload)
    VALUES (
      'Agents_Directory',
      NEW.id::text,
      jsonb_build_object(
        'agent_id', NEW.id,
        'full_name', NEW.full_name,
        'phone', NEW.phone,
        'email', NEW.email,
        'id_proof_ref', NEW.license_url,
        'account_created', NEW.created_at,
        'active_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_admin_audit_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_name TEXT;
BEGIN
  SELECT full_name INTO v_admin_name FROM public.profiles WHERE id = NEW.changed_by;

  INSERT INTO public.sheet_sync_queue (sheet_tab, row_key, payload)
  VALUES (
    'Admin_Audit_Logs',
    NEW.id::text,
    jsonb_build_object(
      'timestamp', NEW.created_at,
      'admin_id', NEW.changed_by,
      'admin_name', COALESCE(v_admin_name, 'System'),
      'action', FORMAT('Status %s -> %s on car %s', NEW.old_status, NEW.new_status, NEW.car_id),
      'previous_status', NEW.old_status,
      'new_status', NEW.new_status,
      'price_change', jsonb_build_object(
        'reserve_before', NEW.old_reserve_price, 'reserve_after', NEW.new_reserve_price,
        'buy_now_before', NEW.old_buy_now_price, 'buy_now_after', NEW.new_buy_now_price
      )
    )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_sales_log_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'sold' AND OLD.status IS DISTINCT FROM 'sold' THEN
    INSERT INTO public.sheet_sync_queue (sheet_tab, row_key, payload)
    VALUES (
      'Sales_Log',
      NEW.id::text,
      jsonb_build_object(
        'car_id', NEW.id,
        'buyer_details', COALESCE(NEW.highest_bidder_name_dealer, NEW.highest_bidder_name_buyer),
        'final_sale_price', COALESCE(NEW.buy_now_price, NEW.current_bid_dealer, NEW.current_bid_buyer),
        'sale_type', CASE WHEN NEW.listing_type = 'buy_now_only' THEN 'Buy Now' ELSE 'Auction Won' END,
        'closing_date', NOW(),
        'commission_margin', NULL
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_non_admin_price_tampering()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_is_admin boolean;
begin
  -- service_role / migrations / Edge Functions using service_role have no
  -- auth.uid() and already bypass RLS — trust them, they do their own admin
  -- check before calling. Checking auth.role() too makes this bypass work
  -- even in the odd case auth.uid() isn't cleanly NULL for a service_role
  -- session.
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  select exists(
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager')
  ) into v_is_admin;

  if v_is_admin then
    return new; -- admins/managers can change anything
  end if;

  -- Non-admin (agent, dealer, buyer, team_lead, or anyone else
  -- authenticated): block any change to pricing, listing type, access
  -- type, or status.
  if new.reserve_price is distinct from old.reserve_price
     or new.buy_now_price is distinct from old.buy_now_price
     or new.starting_bid is distinct from old.starting_bid
     or new.base_price_buyer is distinct from old.base_price_buyer
     or new.base_price_dealer is distinct from old.base_price_dealer
     or new.listing_type is distinct from old.listing_type
     or new.access_type is distinct from old.access_type
     or new.status is distinct from old.status
  then
    raise exception 'Only an admin or manager can change pricing, listing type, or status of a car.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_car_inspection()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  k text;
  v jsonb;
begin
  if not (new.inspection ?& array['engine_transmission','body_paint','interior','electricals','tyres_suspension']) then
    raise exception 'inspection must include all 5 categories (engine_transmission, body_paint, interior, electricals, tyres_suspension).';
  end if;

  for k, v in select * from jsonb_each(new.inspection) loop
    if v is not null and v::text <> 'null' then
      if jsonb_typeof(v) <> 'object' or not (v ? 'status') or (v ->> 'status') not in ('good', 'fair', 'poor') then
        raise exception 'inspection.% must be null or {"status": "good"|"fair"|"poor", "note": "..."}', k;
      end if;
    end if;
  end loop;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_role text;
begin
  -- No auth.uid() means this write is coming from a service_role
  -- connection (an Edge Function), which has already done its own
  -- admin/manager check before touching this table. Let it through.
  if auth.uid() is null then
    return new;
  end if;

  select role into caller_role from public.profiles where id = auth.uid();

  -- Admins can change anything (role, status, whatever).
  if caller_role = 'admin' then
    return new;
  end if;

  -- Managers may change a dealer's status (approve / reject / suspend) as
  -- long as the row is a dealer both before and after — never its role.
  if caller_role = 'manager' and old.role = 'dealer' and new.role = 'dealer' then
    return new;
  end if;

  -- Everyone else: block any role or status change (covers self-update,
  -- and a manager/team_lead touching a row this trigger hasn't
  -- specifically allowed above).
  if new.role <> old.role then
    raise exception 'Only an admin can change a role.';
  end if;
  if new.status <> old.status then
    raise exception 'Only an admin can change status.';
  end if;
  return new;
end;
$function$;

CREATE TRIGGER trg_prevent_non_admin_price_tampering BEFORE UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION prevent_non_admin_price_tampering();

CREATE TRIGGER trg_log_car_price_status_change AFTER UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION log_car_price_status_change();

CREATE TRIGGER check_minimum_bid BEFORE INSERT ON public.car_bids FOR EACH ROW EXECUTE FUNCTION validate_bid_amount();

CREATE TRIGGER cars_set_updated_at BEFORE UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sell_requests_set_updated_at BEFORE UPDATE ON public.sell_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_enqueue_cars_master_sync AFTER INSERT OR UPDATE OF status, buy_now_price, reserve_price, listing_type ON public.cars FOR EACH ROW EXECUTE FUNCTION enqueue_cars_master_sync();

CREATE TRIGGER trg_enqueue_cars_master_sync_on_agent_assignment AFTER UPDATE OF assigned_agent_id ON public.car_auction_requests FOR EACH ROW EXECUTE FUNCTION enqueue_cars_master_sync_on_agent_assignment();

CREATE TRIGGER trg_enqueue_agents_directory_sync AFTER INSERT OR UPDATE OF full_name, phone, email, license_url, status ON public.profiles FOR EACH ROW EXECUTE FUNCTION enqueue_agents_directory_sync();

CREATE TRIGGER trg_enqueue_admin_audit_sync AFTER INSERT ON public.car_price_status_history FOR EACH ROW EXECUTE FUNCTION enqueue_admin_audit_sync();

CREATE TRIGGER trg_enqueue_sales_log_sync AFTER UPDATE OF status ON public.cars FOR EACH ROW EXECUTE FUNCTION enqueue_sales_log_sync();

CREATE TRIGGER trg_validate_car_inspection BEFORE INSERT OR UPDATE OF inspection ON public.cars FOR EACH ROW EXECUTE FUNCTION validate_car_inspection();

CREATE TRIGGER trg_prevent_self_privilege_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_self_privilege_escalation();
