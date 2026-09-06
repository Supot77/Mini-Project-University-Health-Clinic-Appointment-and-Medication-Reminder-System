import { createRecordsDemoRepository } from './mockRepository';
import type { RecordsDemoRepository } from './contract';

// Composition point for this UI prototype; no database adapter is active.
export function createRecordsPreviewService(): RecordsDemoRepository {
  return createRecordsDemoRepository();
}
