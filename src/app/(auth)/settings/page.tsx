import { requireRole } from "@/lib/requireRole";
import SettingsContent from "@/components/settings/SettingsContent";

export default async function SettingsPage() {
  await requireRole(["patient", "staff_admin", "medical"]);

  return <SettingsContent />;
}