import AppointmentWorkspace from './AppointmentWorkspace';
import type { PreviewRole } from './repository';

export function PatientAppointmentWorkspace() {
  return <AppointmentWorkspace role="patient" allowRolePreview={false} />;
}

export function MedicalAppointmentWorkspace() {
  return <AppointmentWorkspace role="medical" allowRolePreview={false} />;
}

export function StaffAppointmentWorkspace() {
  return <AppointmentWorkspace role="staff_admin" allowRolePreview={false} />;
}

export type { PreviewRole };
