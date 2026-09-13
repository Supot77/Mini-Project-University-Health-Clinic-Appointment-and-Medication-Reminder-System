import { MedicalRecordsPage, PatientRecordsPage } from '@/features/medical-records';
import { requireRole } from '@/lib/requireRole';

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ appointment?: string }> }) {
  const { role } = await requireRole(['patient', 'medical']);
  const { appointment } = await searchParams;
  return role === 'medical' ? <MedicalRecordsPage selectedId={appointment} /> : <PatientRecordsPage selectedId={appointment} />;
}
