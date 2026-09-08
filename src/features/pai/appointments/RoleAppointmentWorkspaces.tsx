import AppointmentPage from '../runtime/AppointmentPage';
import type { PreviewRole } from './repository';

export function PatientAppointmentWorkspace() {
  return <AppointmentPage role="patient" />;
}

export function MedicalAppointmentWorkspace() {
  return <AppointmentPage role="medical" />;
}

export function StaffAppointmentWorkspace() {
  return <AppointmentPage role="staff_admin" />;
}

export type { PreviewRole };
