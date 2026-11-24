-- Cleanup after Steffen's test period (24 Nov 2026, approved by Steffen): all ACTIVITY data goes, everything
-- structural stays – persons, teams, memberships, sessions, events, products, punch card types, badges catalogue,
-- folders/media (Line's photo pack), catalog images, school settings. Order respects foreign keys.
begin;
delete from storage.objects where bucket_id = 'media' and name in (select storage_path from video);
delete from video;
delete from formation_set;
delete from note;
delete from absence;
delete from attendance;
delete from booking;
delete from message_comment;
delete from message_receipt;
delete from message;
delete from thread_read;
delete from thread_message;
delete from thread;
delete from comment;
delete from report;
delete from post;
delete from event_signup;
delete from web_signup;
delete from punch;
delete from punch_card;
delete from "order";
delete from audition_candidate;
update team set audition_sent_at = null, audition_round = 1 where audition_sent_at is not null or audition_round <> 1;
delete from result;
delete from person_badge;
delete from milestone;
delete from feedback;
delete from notification;
delete from mail_log;
-- lesson plans written during tests
update session set lesson_plan = null, lesson_plan_read_at = null, substitute_wanted = false, substitute_id = null where lesson_plan is not null or substitute_wanted or substitute_id is not null;
commit;
select 'chk' as chk, (select count(*) from booking) + (select count(*) from message) + (select count(*) from post) + (select count(*) from "order") + (select count(*) from notification) as left_over,
       (select count(*) from person) as persons, (select count(*) from folder) as folders, (select count(*) from media) as media;
