import { Building2, ChevronRight, CircleHelp, FileText, LogOut, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { PageHeader } from '../components/Layout';

export function MyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return <div className="page narrow-page"><PageHeader eyebrow="PROFILE / 个人工作空间" title="我的" description="管理个人资料、机构工作空间与历史报告。" />
    <section className="profile-card"><span className="profile-avatar">{user?.displayName.slice(0, 1)}</span><div><h2>{user?.displayName}</h2><p>{user?.email}</p><span>{user?.role === 'ORG_ADMIN' ? '机构管理员' : '检测师'}</span></div></section>
    <div className="settings-list"><div><Building2 size={20} /><span><strong>所属机构</strong><small>{user?.tenantName}</small></span></div><Link to="/reports"><FileText size={20} /><span><strong>历史报告</strong><small>查看正式报告与分享状态</small></span><ChevronRight size={17} /></Link><div><ShieldCheck size={20} /><span><strong>账号与数据安全</strong><small>会话由服务端验证，权限按机构隔离</small></span></div><div><CircleHelp size={20} /><span><strong>使用帮助</strong><small>现场检测 → 提交审核 → 报告分享</small></span></div></div>
    <button className="logout-button" onClick={() => { logout(); navigate('/login'); }}><LogOut size={17} />退出当前账号</button>
  </div>;
}
