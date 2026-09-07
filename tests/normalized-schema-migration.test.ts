import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/03_normalized_transactions.sql');
const baseSchema = readFileSync(resolve(process.cwd(), 'supabase/migrations/01_schema.sql'), 'utf8');
const migration = readFileSync(migrationPath, 'utf8');
const broadcastTypeUpgrade = readFileSync(resolve(process.cwd(), 'supabase/migrations/04_broadcast_notification_type.sql'), 'utf8');
const broadcastRecipientUpgrade = readFileSync(resolve(process.cwd(), 'supabase/migrations/05_simplify_broadcast_recipients.sql'), 'utf8');
const roleUpgrade = readFileSync(resolve(process.cwd(), 'supabase/migrations/06_consolidate_roles.sql'), 'utf8');
const contractFieldsUpgrade = readFileSync(resolve(process.cwd(), 'supabase/migrations/07_add_contract_fields.sql'), 'utf8');
const patientSearchRlsUpgrade = readFileSync(resolve(process.cwd(), 'supabase/migrations/08_allow_medical_patient_search.sql'), 'utf8');

const normalizedTables = [
  'reschedule_proposals',
  'prescription_items',
  'dispensing_events',
  'dispensing_items',
  'stock_reservations',
  'prescription_changes',
  'medication_log_changes',
  'email_jobs',
  'broadcasts',
] as const;

describe('normalized transaction migration', () => {
  it('persists TypeScript contract fields in the base and additive schemas', () => {
    const contractFields = [
      'patient_type text',
      'employee_id text',
      'organization text',
      'allergy_status text',
      'chronic_disease_status text',
      'is_active boolean',
      'permission_version integer',
      'dispensing_item_id uuid',
      'performed_by uuid',
      'idempotency_key text',
      'created_by uuid',
      'confirmed_by uuid',
      'confirmed_at timestamp with time zone',
      'locked_at timestamp with time zone',
      'email_pause_until timestamp with time zone',
      'record_deadline timestamp with time zone',
      'revision integer',
      'event_key text',
      'broadcast_id uuid',
      'read_at timestamp with time zone',
      'deleted_at timestamp with time zone',
    ];

    for (const field of contractFields) {
      expect(baseSchema).toContain(field);
      expect(contractFieldsUpgrade).toContain(`ADD COLUMN IF NOT EXISTS ${field}`);
    }
  });

  it('keeps the contract-field migration additive and outside the mock runtime', () => {
    expect(contractFieldsUpgrade).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im);
    expect(contractFieldsUpgrade).not.toMatch(/service_role|\.env\.local/i);
  });

  it('consolidates legacy roles and constrains new profiles to the three active roles', () => {
    expect(roleUpgrade).toContain("WHEN 'doctor' THEN 'medical'");
    expect(roleUpgrade).toContain("WHEN 'pharmacist' THEN 'medical'");
    expect(roleUpgrade).toContain("WHEN 'staff' THEN 'staff_admin'");
    expect(roleUpgrade).toContain("WHEN 'admin' THEN 'staff_admin'");
    expect(roleUpgrade).toContain("CHECK (role IN ('patient', 'medical', 'staff_admin'))");
  });

  it('allows medical users to read patient profiles in existing databases', () => {
    expect(patientSearchRlsUpgrade).toContain('DROP POLICY IF EXISTS "Staff/Admin can view all profiles"');
    expect(patientSearchRlsUpgrade).toContain("public.get_user_role() IN ('staff_admin', 'medical')");
    expect(patientSearchRlsUpgrade).not.toMatch(/^\s*(TRUNCATE|DELETE|UPDATE|INSERT)\b/im);
  });

  it('creates every approved transaction table and enables default-deny RLS', () => {
    for (const table of normalizedTables) {
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(`));
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('contains the required integrity and idempotency contracts', () => {
    expect(migration).toContain("response_deadline = sent_at + interval '24 hours'");
    expect(migration).toContain('prescribed_quantity > 0');
    expect(migration).toContain('quantity > 0');
    expect(migration).toContain('idempotency_key text NOT NULL UNIQUE');
    expect(migration).toContain('UNIQUE (broadcast_id, user_id)');
    expect(migration).toContain('UNIQUE (dispensing_event_id, prescription_item_id)');
    expect(migration).toContain('ON DELETE RESTRICT');
  });

  it('is additive and contains no data mutation or seed commands', () => {
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im);
    expect(migration).not.toMatch(/service_role|\.env\.local/i);
  });

  it('keeps legacy JSONB while declaring normalized prescription storage', () => {
    expect(migration).not.toMatch(/DROP\s+COLUMN\s+prescribed_medications/i);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.prescription_items');
  });

  it('stores the Broadcast topic for new and existing databases', () => {
    expect(migration).toContain("notification_type text NOT NULL DEFAULT 'broadcast'");
    expect(migration).toContain('broadcasts_notification_type_check');
    expect(broadcastTypeUpgrade).toContain('ADD COLUMN IF NOT EXISTS notification_type');
    expect(broadcastTypeUpgrade).toContain('broadcasts_notification_type_check');
    expect(broadcastTypeUpgrade).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im);
  });

  it('stores frozen Broadcast recipients directly in notifications', () => {
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS public.broadcast_recipients');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS broadcast_id uuid');
    expect(migration).toContain('UNIQUE (broadcast_id, user_id)');
    expect(migration).toContain("NOT (audience ? 'userIds')");
    expect(broadcastRecipientUpgrade).toContain('SET broadcast_id = recipient.broadcast_id');
    expect(broadcastRecipientUpgrade).toContain('DROP TABLE IF EXISTS public.broadcast_recipients');
  });
});
