-- Forward fix: default btrim only removes ordinary spaces. Match String.trim's
-- full whitespace set so tab/newline/Unicode-only or padded reasons cannot pass.
-- The original applied schema migration and its history remain unchanged.
ALTER TABLE public.verification_logs
  ADD CONSTRAINT verification_logs_reason_whitespace_check CHECK (
    rejection_note IS NULL OR rejection_note = btrim(
      rejection_note,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    )
  );

NOTIFY pgrst, 'reload schema';
