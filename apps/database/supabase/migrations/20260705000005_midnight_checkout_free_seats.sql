-- Bug: the midnight-checkout cron closed all open attendance but left seats
-- with status='occupied'. Next day those seats show occupied with no open
-- attendance row, so the map renders them as anonymous occupants. Free the
-- occupied seats as part of the same nightly reset.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'midnight-checkout'),
  command := $$
    UPDATE public.attendance
    SET checked_out_at = now()
    WHERE checked_out_at IS NULL;

    UPDATE public.seats
    SET status = 'free'
    WHERE status = 'occupied';
  $$
);
