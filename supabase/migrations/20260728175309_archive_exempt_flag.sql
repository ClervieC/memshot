-- Lets an organizer/admin permanently opt an event out of the 30-day
-- auto-archive-and-delete job, independent of Resend delivery status.
alter table public.events
  add column archive_exempt boolean not null default false;

update public.events set archive_exempt = true where id = 'cFFtAnnIR1xkPpRxSwv5';
