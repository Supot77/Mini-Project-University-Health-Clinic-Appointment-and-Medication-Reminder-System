import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/03_normalized_transactions.sql');
const migration = readFileSync(migrationPath, 'utf8');
const broadcastTypeUpgrade = readFileSync(resolve(process.cwd(), 'supabase/migrations/04_broadcast_notification_type.sql'), 'utf8');
const broadcastRecipientUpgrade = readFileSync(resolve(process.cwd(), 'supabase/migrations/05_simplify_broadcast_recipients.sql'), 'utf8');

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
