-- Reference backup: exported by the user from production on 2026-10-25.
-- NOT a migration. Do not execute as part of v2 deployment.
CREATE OR REPLACE FUNCTION public.place_dealer_bid(p_car_id uuid, p_amount numeric)
RETURNS cars LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_car public.cars;
  v_profile public.profiles;
  v_current_bid numeric;
  v_min_increment numeric;
  v_min_allowed numeric;
  v_bidder_name text;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'Not signed in.'; end if;
  if v_profile.role <> 'dealer' or v_profile.status <> 'approved' then
    raise exception 'Only approved dealers can place bids.';
  end if;
  select * into v_car from public.cars where id = p_car_id for update;
  if v_car.id is null then raise exception 'Car not found.'; end if;
  if v_car.auction_end is not null and now() > v_car.auction_end then
    raise exception 'This auction has already ended.';
  end if;
  if v_car.status not in ('live', 'upcoming') then raise exception 'This car is not open for bidding.'; end if;
  v_current_bid := coalesce(v_car.current_bid_dealer, v_car.base_price_dealer, v_car.starting_bid, 0);
  v_min_increment := coalesce(v_car.minimum_increment, 5000);
  v_min_allowed := v_current_bid + v_min_increment;
  if p_amount < v_min_allowed then
    raise exception 'Bid must be at least %', to_char(v_min_allowed, 'FM99,99,99,999');
  end if;
  v_bidder_name := coalesce(v_profile.business_name, v_profile.full_name, 'Dealer');
  insert into public.car_bids (car_id, bidder_id, bidder_name, bidder_role, amount, is_custom)
  values (p_car_id, auth.uid(), v_bidder_name, 'dealer', p_amount, true);
  update public.cars
  set current_bid_dealer = p_amount, highest_bidder_id_dealer = auth.uid(), highest_bidder_name_dealer = v_bidder_name
  where id = p_car_id returning * into v_car;
  return v_car;
end;
$function$;
