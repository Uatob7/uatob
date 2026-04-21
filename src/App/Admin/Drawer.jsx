// src/App/UaTob/Admin/components/Drawer.jsx
import { DrawerOverlay } from '@/App/Admin/DrawerOverlay';
import { DrawerHeader } from '@/App/Admin/DrawerHeader';
import { DrawerNav } from '@/App/Admin/DrawerNav';
import { DrawerFooter } from '@/App/Admin/DrawerFooter';

export function Drawer({ useriders, open, onClose, onNavigate }) {
  if (!open) return null;

  return (
    <>
      <DrawerOverlay onClick={onClose} />
      <div className="drawer">
        <DrawerHeader onClose={onClose} />
        <DrawerNav useriders={useriders} onNavigate={onNavigate} onClose={onClose} />
        <DrawerFooter />
      </div>
    </>
  );
}