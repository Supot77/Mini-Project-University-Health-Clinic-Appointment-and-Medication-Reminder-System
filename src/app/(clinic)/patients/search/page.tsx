import { requireRole } from '@/lib/requireRole';
import PatientSearchContent from '@/components/patients/PatientSearchContent';

export default async function PatientSearchPage() {
await requireRole(['staff_admin', 'medical']);  
return <PatientSearchContent />;
}
