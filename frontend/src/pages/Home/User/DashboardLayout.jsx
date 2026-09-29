import { Outlet } from 'react-router-dom';
import UserHeader from '../../../components/UserHeader';
export default function DashboardLayout() {
  return <div className="user-shell"><UserHeader/><main className="user-content"><Outlet/></main></div>;
}
