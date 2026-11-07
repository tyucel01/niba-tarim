import { AdminSession } from './admin-session';
import { PanelDialogProvider } from './ui/panel-dialog';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminSession><PanelDialogProvider>{children}</PanelDialogProvider></AdminSession>;
}
