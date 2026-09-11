import StaffEditPatientForm from '@/components/staff/StaffEditPatientForm';
import { requireRole } from '@/lib/requireRole';

interface EditPatientPageProps {
  params: Promise<{
    patientId: string;
  }>;
}

export default async function EditPatientPage({
  params,
}: EditPatientPageProps) {
  // อนุญาตให้เปิดหน้านี้เฉพาะ staff_admin
  await requireRole(['staff_admin']);

  // Next.js 16 ส่ง params มาเป็น Promise
  const { patientId } = await params;

  return (
    <StaffEditPatientForm patientId={patientId} />
  );
}