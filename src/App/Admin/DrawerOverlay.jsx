import { C } from '@/App/Admin/Tokens';

export function DrawerOverlay({ onClick }) {
  return (
    <div 
      className="drawer-overlay" 
      onClick={onClick}
    />
  );
}
