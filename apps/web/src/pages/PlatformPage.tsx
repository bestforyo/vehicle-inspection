import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Building2, CheckCircle2, FileText, Plus, Server, ShieldCheck, Store } from 'lucide-react';
import { api } from '../api';
import { ErrorMessage } from '../components/Common';
import { LoadingPage, PageHeader } from '../components/Layout';

interface Tenant { id: string; name: string; code: string; status: string; planName: string; expiresAt?: string; createdAt: string; _count: { memberships: number; orders: number; reports: number } }
interface Stats { tenants: number; activeTenants: number; orders: number; reports: number; service: { api: string; queue: string; objectStorage: string } }

export function PlatformPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    Promise.all([api<Tenant[]>('/api/v1/platform/tenants'), api<Stats>('/api/v1/platform/stats')]).then(([tenantResult, statResult]) => { setTenants(tenantResult); setStats(statResult); }).catch((cause) => setError((cause as Error).message));
  }, []);
  useEffect(() => { load(); }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try { await api('/api/v1/platform/tenants', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) }); setShowCreate(false); load(); } catch (cause) { setError((cause as Error).message); }
  }
  async function transition(tenant: Tenant) {
    const action = tenant.status === 'ACTIVE' ? 'suspend' : 'activate';
    const reason = window.prompt(`请填写${action === 'suspend' ? '停用' : '恢复'}原因或工单号（必填）`);
    if (!reason?.trim()) return;
    try { await api(`/api/v1/platform/tenants/${tenant.id}/${action}`, { method: 'POST', body: JSON.stringify({ reason }) }); load(); } catch (cause) { setError((cause as Error).message); }
  }
  if (!tenants || !stats) return <LoadingPage />;
  return <div className="page"><PageHeader eyebrow="PLATFORM / 运营控制台" title="平台运营" description="机构入驻、首管理员开通、套餐状态与全局服务概览。" action={<button className="primary-button" onClick={() => setShowCreate(!showCreate)}><Plus size={17} />开通检测机构</button>} />
    {error && <ErrorMessage message={error} />}
    <section className="metric-grid"><div className="metric-card"><span className="metric-icon green"><Building2 size={20} /></span><div><strong>{stats.tenants}</strong><span>全部机构</span></div></div><div className="metric-card"><span className="metric-icon mint"><CheckCircle2 size={20} /></span><div><strong>{stats.activeTenants}</strong><span>正常服务机构</span></div></div><div className="metric-card"><span className="metric-icon blue"><Store size={20} /></span><div><strong>{stats.orders}</strong><span>全平台订单量</span></div></div><div className="metric-card"><span className="metric-icon amber"><FileText size={20} /></span><div><strong>{stats.reports}</strong><span>正式报告量</span></div></div></section>
    <div className="platform-health"><Server size={18} /><strong>服务状态</strong><span>API：{stats.service.api}</span><span>异步队列：{stats.service.queue}</span><span>媒体：{stats.service.objectStorage}</span><small>平台列表不展示 VIN、完整车牌、现场照片或报告正文。</small></div>
    {showCreate && <form className="surface-card platform-create-form" onSubmit={create}><div className="settings-section-title"><ShieldCheck size={21} /><div><h2>开通机构与首位管理员</h2><p>系统将创建独立租户并复制示范模板；生产启用前仍需机构专业复核。</p></div></div><div className="form-grid"><label>机构名称<input name="name" required placeholder="检测机构全称" /></label><label>机构唯一编码<input name="code" required pattern="[A-Z0-9_\-]{2,30}" placeholder="例如：ORG001" /></label><label>管理员姓名<input name="adminName" required /></label><label>管理员邮箱<input name="adminEmail" type="email" required /></label><label>初始密码<input name="initialPassword" type="password" minLength={10} required /></label><label>套餐<input name="planName" defaultValue="专业版" /></label><label>到期日期<input name="expiresAt" type="date" /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>取消</button><button className="primary-button">确认开通</button></div></form>}
    <section className="surface-card platform-tenants"><div className="settings-section-title"><Building2 size={21} /><div><h2>机构列表</h2><p>仅显示运营所需统计粒度，敏感操作须记录原因。</p></div></div><div className="tenant-table"><div className="tenant-head"><span>机构</span><span>套餐 / 到期</span><span>成员</span><span>订单 / 报告</span><span>状态</span><span>操作</span></div>{tenants.map((tenant) => <div className="tenant-row" key={tenant.id}><div><strong>{tenant.name}</strong><small>{tenant.code}</small></div><div><strong>{tenant.planName}</strong><small>{tenant.expiresAt ? new Date(tenant.expiresAt).toLocaleDateString('zh-CN') : '未设置'}</small></div><span>{tenant._count.memberships} 人</span><span>{tenant._count.orders} / {tenant._count.reports}</span><span className={`member-status ${tenant.status.toLowerCase()}`}>{tenant.status === 'ACTIVE' ? '正常' : '已停用'}</span><button className={tenant.status === 'ACTIVE' ? 'text-danger' : 'text-link'} onClick={() => void transition(tenant)}>{tenant.status === 'ACTIVE' ? '停用' : '恢复'}</button></div>)}</div></section>
  </div>;
}
