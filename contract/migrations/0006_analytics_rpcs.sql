-- booking-crm-kit · 0006 · analytics dashboard RPCs (admin read surface)
-- analytics_events is server-inserted via the service role only and has no read
-- policy (0008 = deny-all). The admin dashboard reads it ONLY through these five
-- SECURITY DEFINER functions, each gated by has_role(auth.uid(),'admin') so a
-- non-admin (or anon) gets nothing back. Day-bucketing uses kit_timezone() (0005).
-- Idempotent.

-- Traffic per day: pageviews + unique visitors.
create or replace function public.analytics_traffic(p_from date, p_to date)
returns table(day date, pageviews bigint, unique_visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (e.occurred_at at time zone public.kit_timezone())::date as day,
    count(*)::bigint as pageviews,
    count(distinct e.visitor_hash)::bigint as unique_visitors
  from public.analytics_events e
  where has_role(auth.uid(), 'admin')
    and e.event_type = 'pageview'
    and (e.occurred_at at time zone public.kit_timezone())::date between p_from and p_to
  group by 1
  order by 1;
$$;

-- Top pages.
create or replace function public.analytics_top_pages(p_from date, p_to date, p_limit int default 20)
returns table(path text, pageviews bigint, unique_visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.path,
    count(*)::bigint as pageviews,
    count(distinct e.visitor_hash)::bigint as unique_visitors
  from public.analytics_events e
  where has_role(auth.uid(), 'admin')
    and e.event_type = 'pageview'
    and (e.occurred_at at time zone public.kit_timezone())::date between p_from and p_to
  group by e.path
  order by pageviews desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Sources: classify referrer_host into a channel; keep host for a top-referrers list.
create or replace function public.analytics_sources(p_from date, p_to date)
returns table(source text, referrer_host text, pageviews bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Brand tokens are anchored to a domain-label boundary ((^|.) before, . or end after)
    -- so they match a real host label, not a substring: combing.com is NOT 'bing',
    -- netflix.com/box.com are NOT 'x.com', att.com is NOT 't.co'.
    case
      when e.referrer_host is null or e.referrer_host = '' then 'direct'
      when e.referrer_host ~* '(^|\.)(google|bing|yahoo|duckduckgo|ecosia)\.' then 'search'
      when e.referrer_host ~* '(^|\.)(facebook|instagram|twitter|linkedin|youtube|whatsapp|tiktok)\.'
        or e.referrer_host ~* '(^|\.)(t\.co|x\.com)(\.|$)' then 'social'
      else 'referral'
    end as source,
    e.referrer_host,
    count(*)::bigint as pageviews
  from public.analytics_events e
  where has_role(auth.uid(), 'admin')
    and e.event_type = 'pageview'
    and (e.occurred_at at time zone public.kit_timezone())::date between p_from and p_to
  group by 1, 2
  order by pageviews desc;
$$;

-- Country breakdown.
create or replace function public.analytics_by_country(p_from date, p_to date)
returns table(country text, pageviews bigint, unique_visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(e.country, ''), 'Unknown') as country,
    count(*)::bigint as pageviews,
    count(distinct e.visitor_hash)::bigint as unique_visitors
  from public.analytics_events e
  where has_role(auth.uid(), 'admin')
    and e.event_type = 'pageview'
    and (e.occurred_at at time zone public.kit_timezone())::date between p_from and p_to
  group by 1
  order by pageviews desc;
$$;

-- Conversions: bookings by status (by booking date) + inquiries split by type
-- (the contract unifies Angel's consultation_submissions + contact_submissions
-- into one `inquiries` table keyed by `type`) + pageviews of the funnel pages.
-- Funnel paths are the reference site's routes; clients adjust if they rename them.
create or replace function public.analytics_conversions(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not has_role(auth.uid(), 'admin') then '{}'::jsonb else
    jsonb_build_object(
      'bookings_by_status', coalesce((
        select jsonb_object_agg(status, n)
        from (
          select b.status, count(*)::int as n
          from public.bookings b
          where b.date between p_from and p_to
          group by b.status
        ) s
      ), '{}'::jsonb),
      'consultation_submissions', (
        select count(*)::int from public.inquiries q
        where q.type = 'consultation'
          and (q.created_at at time zone public.kit_timezone())::date between p_from and p_to
      ),
      'contact_submissions', (
        select count(*)::int from public.inquiries q
        where q.type = 'contact'
          and (q.created_at at time zone public.kit_timezone())::date between p_from and p_to
      ),
      'book_consultation_views', (
        select count(*)::int from public.analytics_events e
        where e.event_type = 'pageview' and e.path = '/book-consultation'
          and (e.occurred_at at time zone public.kit_timezone())::date between p_from and p_to
      ),
      'contact_views', (
        select count(*)::int from public.analytics_events e
        where e.event_type = 'pageview' and e.path = '/contact'
          and (e.occurred_at at time zone public.kit_timezone())::date between p_from and p_to
      )
    )
  end;
$$;

grant execute on function
  public.analytics_traffic(date, date),
  public.analytics_top_pages(date, date, int),
  public.analytics_sources(date, date),
  public.analytics_by_country(date, date),
  public.analytics_conversions(date, date)
to authenticated;
