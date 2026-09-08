import {
  MedicalAppointmentWorkspace,
  PatientAppointmentWorkspace,
  StaffAppointmentWorkspace,
} from '@/features/pai/appointments/RoleAppointmentWorkspaces';
import { requireRole } from '@/lib/requireRole';

export default async function AppointmentsPage() {
  const { role } = await requireRole(['patient', 'medical', 'staff_admin']);
  if (role === 'patient') return <PatientAppointmentWorkspace />;
  if (role === 'medical') return <MedicalAppointmentWorkspace />;
  return <StaffAppointmentWorkspace />;
}
