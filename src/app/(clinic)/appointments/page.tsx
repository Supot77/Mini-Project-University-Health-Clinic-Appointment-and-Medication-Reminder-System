import {
  MedicalAppointmentWorkspace,
  PatientAppointmentWorkspace,
  StaffAppointmentWorkspace,
} from '@/features/pai/appointments/RoleAppointmentWorkspaces';
import { requireRole } from '@/lib/requireRole';

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { role } = await requireRole(['patient', 'medical', 'staff_admin']);
  const params = await searchParams;
  const initialSlotId = typeof params.slotId === 'string' ? params.slotId : undefined;
  if (role === 'patient') return <PatientAppointmentWorkspace initialSlotId={initialSlotId} />;
  if (role === 'medical') return <MedicalAppointmentWorkspace />;
  return <StaffAppointmentWorkspace />;
}
