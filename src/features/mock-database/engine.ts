import { createClinicMockTables, type ClinicMockTables } from '@/mocks/clinicDatabase';

export interface MockPostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

export type DataResult<T> = { data: T; error: null } | { data: null; error: MockPostgrestError };
export type MockTableName = keyof ClinicMockTables;

const ok = <T>(data: T): DataResult<T> => ({ data, error: null });
const fail = <T>(message: string, code: string, details = ''): DataResult<T> => ({
  data: null,
  error: { message, code, details, hint: '' },
});

export class ClinicMockDatabase {
  private tables = createClinicMockTables();
  private revision = 0;

  constructor(private readonly latencyMs = 80) {}

  getRevision() { return this.revision; }

  snapshot(): ClinicMockTables { return structuredClone(this.tables); }

  async select<K extends MockTableName>(table: K): Promise<DataResult<ClinicMockTables[K]>> {
    await this.delay();
    return ok(structuredClone(this.tables[table]));
  }

  async findById<K extends MockTableName>(table: K, id: string): Promise<DataResult<ClinicMockTables[K][number]>> {
    await this.delay();
    const row = this.tables[table].find((item) => item.id === id);
    return row ? ok(structuredClone(row) as ClinicMockTables[K][number]) : fail('ไม่พบข้อมูล', 'PGRST116', `${table}.${id}`);
  }

  async updateById<K extends MockTableName>(table: K, id: string, changes: Partial<ClinicMockTables[K][number]>): Promise<DataResult<ClinicMockTables[K][number]>> {
    await this.delay();
    const rows = this.tables[table] as Array<{ id: string }>;
    const index = rows.findIndex((item) => item.id === id);
    if (index < 0) return fail('ไม่พบข้อมูล', 'PGRST116', `${table}.${id}`);
    const next = { ...rows[index], ...structuredClone(changes), id };
    rows[index] = next;
    this.revision += 1;
    return ok(structuredClone(next) as ClinicMockTables[K][number]);
  }

  async deleteById<K extends MockTableName>(table: K, id: string): Promise<DataResult<boolean>> {
    await this.delay();
    const rows = this.tables[table] as Array<{ id: string }>;
    const index = rows.findIndex((item) => item.id === id);
    if (index < 0) return fail('ไม่พบข้อมูล', 'PGRST116', `${table}.${id}`);
    rows.splice(index, 1);
    this.revision += 1;
    return ok(true);
  }

  async transaction<T>(expectedRevision: number, command: (draft: ClinicMockTables) => DataResult<T>): Promise<DataResult<T>> {
    await this.delay();
    if (expectedRevision !== this.revision) return fail('ข้อมูลถูกเปลี่ยนโดยคำสั่งอื่น', 'MOCK_CONFLICT');
    const draft = this.snapshot();
    const result = command(draft);
    if (result.error) return result;
    this.tables = draft;
    this.revision += 1;
    return structuredClone(result);
  }

  private delay() {
    return this.latencyMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs)) : Promise.resolve();
  }
}

export const mockResult = { ok, fail };
