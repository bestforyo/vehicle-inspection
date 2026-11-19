-- Apply after the Prisma migration with a database owner account.
-- The API role must not be a table owner or have BYPASSRLS.
-- Each request transaction sets: SET LOCAL app.tenant_id = '<verified tenant uuid>';
-- Public report access uses a separate, tightly scoped database role/path.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Membership', 'Vehicle', 'VehicleLookupRecord', 'Template', 'TemplateRevision',
    'Order', 'InspectionRevision', 'InspectionAnswer', 'MediaAsset', 'InspectionEvidence',
    'ReviewRecord', 'Report', 'ReportShare', 'AuditEvent', 'IdempotencyKey'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON public.%I USING (%I = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (%I = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
        table_name, 'tenantId', 'tenantId'
      );
    END IF;
  END LOOP;
END $$;
