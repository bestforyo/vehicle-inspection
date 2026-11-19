import { Building2, CarFront, ClipboardCheck, ClipboardList, FileText, LayoutDashboard, LogOut, Settings, UserRound } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const navigation = [
  { to: '/', label: '首页', icon: LayoutDashboard, end: true },
  { to: '/orders', label: '检测订单', icon: ClipboardList },
  { to: '/reviews', label: '审核进度', icon: ClipboardCheck },
  { to: '/reports', label: '历史报告', icon: FileText },
  { to: '/my', label: '我的', icon: UserRound },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const inspectionMode = location.pathname.includes('/inspect');
  const isPlatform = user?.role.startsWith('PLATFORM');
  const items = isPlatform ? [{ to: '/platform', label: '平台运营', icon: Building2, end: true }] : navigation;
  return (
    <div className={`app-shell ${inspectionMode ? 'inspection-mode' : ''}`}>
      <aside className="sidebar">
        <NavLink to={isPlatform ? '/platform' : '/'} className="brand" aria-label="鉴见首页">
          <span className="brand-mark">鉴</span>
          <span><strong>鉴见</strong><small>INSPECTION STUDIO</small></span>
        </NavLink>
        <div className="workspace-label">工作空间</div>
        <div className="workspace-card"><span>{isPlatform ? '平' : user?.tenantName?.slice(0, 1)}</span><div><strong>{isPlatform ? '鉴见平台运营中心' : user?.tenantName}</strong><small>{isPlatform ? '平台运营工作台' : user?.role === 'ORG_ADMIN' ? '机构管理员工作台' : '检测师工作台'}</small></div></div>
        <nav className="side-nav" aria-label="主导航">
          {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={19} /><span>{label === '审核进度' && user?.role === 'ORG_ADMIN' ? '审核中心' : label}</span></NavLink>)}
          {user?.role === 'ORG_ADMIN' && <NavLink to="/settings"><Settings size={19} /><span>机构管理</span></NavLink>}
        </nav>
        <div className="sidebar-foot">
          <div className="user-card"><span className="avatar">{user?.displayName.slice(0, 1)}</span><div><strong>{user?.displayName}</strong><small>{user?.email}</small></div></div>
          <button className="icon-button" title="退出登录" onClick={() => { logout(); navigate('/login'); }}><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><span className="eyebrow">JIANJIAN / WORKSPACE</span><strong>{isPlatform ? '鉴见平台运营中心' : user?.tenantName}</strong></div><span className="secure-badge"><span /> 数据已加密连接</span></header>
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="移动端主导航">
        {items.filter((item) => item.to !== '/reports').map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={21} /><span>{label === '审核进度' && user?.role === 'ORG_ADMIN' ? '审核' : label === '检测订单' ? '订单' : label}</span></NavLink>)}
      </nav>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

export function LoadingPage() {
  return <div className="loading-state"><CarFront size={30} /><span>正在加载工作数据…</span></div>;
}
