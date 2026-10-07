import { PanelDialogProvider } from './ui/panel-dialog';
export default function AdminLayout({children}:{children:React.ReactNode}) { return <PanelDialogProvider>{children}</PanelDialogProvider>; }
