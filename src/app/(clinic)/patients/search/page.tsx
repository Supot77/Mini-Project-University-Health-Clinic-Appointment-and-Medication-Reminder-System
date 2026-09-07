import { requireRole } from '@/lib/requireRole';
import PatientSearchContent from '@/components/patients/PatientSearchContent';

export default async function PatientSearchPage() {
requireRole(["staff_admin"])
return <PatientSearchContent />;
}