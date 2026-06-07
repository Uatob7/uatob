// src/App/UaTob/Admin/components/Drawer.jsx
import { DrawerOverlay } from '@/App/Admin/DrawerOverlay';
import { DrawerHeader } from '@/App/Admin/DrawerHeader';
import { DrawerNav } from '@/App/Admin/DrawerNav';
import { DrawerFooter } from '@/App/Admin/DrawerFooter';

export function Drawer({ useriders, rideUids, open, onClose, onNavigate, supportUnread = 0 }) {
  if (!open) return null;

  return (
    <>
      <DrawerOverlay onClick={onClose} />
      <div className="drawer">
        <DrawerHeader onClose={onClose} />
        <DrawerNav useriders={useriders} rideUids={rideUids} onNavigate={onNavigate} onClose={onClose} supportUnread={supportUnread} />
        <DrawerFooter />
      </div>
    </>
  );
}