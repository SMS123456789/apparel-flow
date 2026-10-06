DO $$ DECLARE row record;batch public.cutting_orders;BEGIN
 FOR row IN SELECT * FROM public.isolated_race_orders LOOP
  SELECT * INTO batch FROM public.cutting_orders WHERE id=row.id;
  ASSERT batch.revision=CASE WHEN row.name='dual-start' THEN 4 ELSE 3 END,'Exactly one concurrent mutation wins';
  IF row.name='dual-start' THEN ASSERT batch.status='VERIFIED' AND batch.sewing_started_at IS NOT NULL AND batch.started_by IN('96000000-0000-4000-8000-000000000004'::uuid,'96000000-0000-4000-8000-000000000005'::uuid),'Exactly one attributed assembly start';END IF;
  IF row.name='dual-approve' THEN ASSERT batch.status='VERIFIED','One concurrent approval succeeds';END IF;
  IF batch.status='VERIFIED' THEN
   ASSERT (SELECT count(*) FROM public.verification_logs WHERE order_id=row.id AND decision='APPROVED')=1,'Exactly one complete approval log';
   ASSERT NOT EXISTS(SELECT 1 FROM public.verification_log_items WHERE order_id=row.id AND (actual_qty IS NULL OR actual_qty<expected_qty)),'No approved shortage/mixed evidence';
  ELSIF batch.status='PENDING_VERIFICATION' THEN
   ASSERT row.name='count-approve','Only saved shortage stays pending';
   ASSERT NOT EXISTS(SELECT 1 FROM public.verification_logs WHERE order_id=row.id),'Count winner writes no decision';
   ASSERT EXISTS(SELECT 1 FROM public.verification_items WHERE order_id=row.id AND actual_qty=0 AND status='RED'),'Saved count wins consistently';
  ELSE
   ASSERT batch.status='REJECTED' AND row.name='reject-approve','Only rejection race can reject';
   ASSERT (SELECT count(*) FROM public.verification_logs WHERE order_id=row.id AND decision='REJECTED')=1,'Exactly one rejection log';
  END IF;
 END LOOP;
END $$;
