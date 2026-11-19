import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Building2, Check, ClipboardList, FilePlus2, History, Save, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import type { TenantRole, TemplateRevision } from '@jianjian/contracts';
import { api } from '../api';
import { ErrorMessage } from '../components/Common';
import { LoadingPage, PageHeader } from '../components/Layout';

interface Tenant { id: string; name: string; displayName: string; logoText: string; planName: string; status: string; settings: { disclaimer?: string } }
interface Member { id: string; role: TenantRole; status: string; joinedAt: string; user: { id: string; email: string; displayName: string; status: string } }
interface TemplateRecord { id: string; packageName: string; standardCode: string; packageCode: string; revisions: Array<{ id: string; revisionNumber: number; status: string; schema: TemplateRevision; publishedAt?: string }> }
interface Audit { id: string; action: string; resourceType: string; actorId?: string; result: string; createdAt: string }

const tabs = [{ key: 'profile', label: '机构资料', icon: Building2 }, { key: 'members', label: '成员与角色', icon: UsersRound }, { key: 'templates', label: '检测模板', icon: ClipboardList }, { key: 'audit', label: '操作审计', icon: History }];

export function SettingsPage() {
  const [tab, setTab] = useState('profile');
  const [error, setError] = useState('');
  return <div className="page"><PageHeader eyebrow="ORGANIZATION / 机构管理" title="机构设置" description="机构资料、成员角色、动态模板和操作审计。" /><div className="settings-tabs">{tabs.map(({ key, label, icon: Icon }) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setError(''); }}><Icon size={17} />{label}</button>)}</div>{error && <ErrorMessage message={error} />}{tab === 'profile' && <ProfileSettings onError={setError} />}{tab === 'members' && <MemberSettings onError={setError} />}{tab === 'templates' && <TemplateSettings onError={setError} />}{tab === 'audit' && <AuditSettings />}</div>;
}

function ProfileSettings({ onError }: { onError: (message: string) => void }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api<Tenant>('/api/v1/admin/tenant').then(setTenant).catch((cause) => onError((cause as Error).message)); }, [onError]);
  if (!tenant) return <LoadingPage />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api('/api/v1/admin/tenant', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(data)) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (cause) { onError((cause as Error).message); }
  }
  return <form className="surface-card settings-form" onSubmit={submit}><div className="settings-section-title"><Building2 size={21} /><div><h2>机构资料与报告品牌</h2><p>已签发报告保留原品牌快照，不受后续修改影响。</p></div></div><div className="form-grid"><label>机构全称<input name="name" defaultValue={tenant.name} required /></label><label>品牌显示名<input name="displayName" defaultValue={tenant.displayName} required /></label><label>报告标记文字<input name="logoText" defaultValue={tenant.logoText} maxLength={2} required /></label><label>当前套餐<input value={tenant.planName} disabled /></label></div><label className="stacked-field">报告免责声明<textarea name="disclaimer" defaultValue={tenant.settings.disclaimer ?? '本报告仅反映本次检测范围及检测时车辆状态，不构成交易建议或车辆价值承诺。'} rows={4} /></label><div className="form-actions"><button className="primary-button"><Save size={16} />{saved ? '已保存' : '保存机构资料'}</button></div></form>;
}

function MemberSettings({ onError }: { onError: (message: string) => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const load = useCallback(() => { api<Member[]>('/api/v1/admin/members').then(setMembers).catch((cause) => onError((cause as Error).message)); }, [onError]);
  useEffect(() => { load(); }, [load]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api('/api/v1/admin/members/invitations', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) });
      setShowInvite(false);
      load();
    } catch (cause) { onError((cause as Error).message); }
  }
  async function update(member: Member, patch: { role?: TenantRole; status?: string }) {
    if (patch.status === 'DISABLED' && !window.confirm(`确认停用 ${member.user.displayName}？其会话将立即失效，历史检测记录保留。`)) return;
    try { await api(`/api/v1/admin/members/${member.id}`, { method: 'PATCH', body: JSON.stringify(patch) }); load(); } catch (cause) { onError((cause as Error).message); }
  }
  if (!members) return <LoadingPage />;
  return <section className="surface-card settings-panel"><div className="settings-section-title"><UsersRound size={21} /><div><h2>机构成员</h2><p>业务角色仅包含检测师和机构管理员，所有权限由服务端校验。</p></div><button className="primary-button" onClick={() => setShowInvite(!showInvite)}><UserPlus size={16} />邀请成员</button></div>
    {showInvite && <form className="invite-form" onSubmit={invite}><div className="form-grid"><label>姓名<input name="displayName" required placeholder="成员姓名" /></label><label>工作邮箱<input name="email" type="email" required placeholder="name@example.com" /></label><label>初始密码<input name="password" type="password" minLength={10} required placeholder="至少10位，首次登录后更换" /></label><label>业务角色<select name="role" defaultValue="INSPECTOR"><option value="INSPECTOR">检测师</option><option value="ORG_ADMIN">机构管理员</option></select></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowInvite(false)}>取消</button><button className="primary-button">创建成员账号</button></div></form>}
    <div className="member-list">{members.map((member) => <div className="member-row" key={member.id}><span className="avatar">{member.user.displayName.slice(0, 1)}</span><div className="member-info"><strong>{member.user.displayName}</strong><small>{member.user.email}</small></div><select aria-label={`${member.user.displayName}角色`} value={member.role} onChange={(event) => void update(member, { role: event.target.value as TenantRole })}><option value="INSPECTOR">检测师</option><option value="ORG_ADMIN">机构管理员</option></select><span className={`member-status ${member.status.toLowerCase()}`}>{member.status === 'ACTIVE' ? '正常' : '已停用'}</span>{member.status === 'ACTIVE' ? <button className="text-danger" onClick={() => void update(member, { status: 'DISABLED' })}>停用</button> : <button className="text-link" onClick={() => void update(member, { status: 'ACTIVE' })}>恢复</button>}</div>)}</div>
  </section>;
}

function TemplateSettings({ onError }: { onError: (message: string) => void }) {
  const [templates, setTemplates] = useState<TemplateRecord[] | null>(null);
  const [editor, setEditor] = useState<{ template: TemplateRecord; revisionId: string; text: string } | null>(null);
  const load = useCallback(() => { api<TemplateRecord[]>('/api/v1/admin/templates').then(setTemplates).catch((cause) => onError((cause as Error).message)); }, [onError]);
  useEffect(() => { load(); }, [load]);
  async function action(template: TemplateRecord, revisionId: string, action: 'submit' | 'publish') {
    if (action === 'publish' && !window.confirm('确认已完成专业复核并发布此不可变模板版本？')) return;
    try { await api(`/api/v1/admin/templates/${template.id}/revisions/${revisionId}/${action}`, { method: 'POST', body: JSON.stringify(action === 'publish' ? { professionalApprovalConfirmed: true } : {}) }); load(); } catch (cause) { onError((cause as Error).message); }
  }
  async function clone(template: TemplateRecord) {
    try { await api(`/api/v1/admin/templates/${template.id}/revisions`, { method: 'POST', body: '{}' }); load(); } catch (cause) { onError((cause as Error).message); }
  }
  async function saveSchema() {
    if (!editor) return;
    try {
      const schema = JSON.parse(editor.text) as TemplateRevision;
      await api(`/api/v1/admin/templates/${editor.template.id}/revisions/${editor.revisionId}/schema`, { method: 'PUT', body: JSON.stringify({ schema }) });
      setEditor(null);
      load();
    } catch (cause) { onError(cause instanceof SyntaxError ? '模板 JSON 格式不正确。' : (cause as Error).message); }
  }
  if (!templates) return <LoadingPage />;
  return <section className="settings-panel"><div className="settings-section-title"><ClipboardList size={21} /><div><h2>动态检测模板</h2><p>已发布修订不可编辑；复制新修订后，经专业复核才能发布。</p></div></div><div className="template-admin-grid">{templates.map((template) => {
    const latest = template.revisions[0];
    return <article className="template-admin-card" key={template.id}><span className="eyebrow">{template.standardCode} / {template.packageCode}</span><h3>{template.packageName}</h3><p>V{latest.revisionNumber} · {latest.schema.sections.length} 章节 · {latest.schema.sections.reduce((sum, section) => sum + section.items.length, 0)} 项</p><span className="template-status">{statusLabel(latest.status)}</span><div><button className="secondary-button" onClick={() => void clone(template)}><FilePlus2 size={15} />复制新修订</button>{latest.status === 'DRAFT' && <><button className="secondary-button" onClick={() => setEditor({ template, revisionId: latest.id, text: JSON.stringify(latest.schema, null, 2) })}>编辑 Schema</button><button className="primary-button" onClick={() => void action(template, latest.id, 'submit')}>提交专业复核</button></>}{latest.status === 'PROFESSIONAL_REVIEW' && <button className="primary-button" onClick={() => void action(template, latest.id, 'publish')}><ShieldCheck size={15} />确认复核并发布</button>}</div></article>;
  })}</div>{editor && <div className="schema-editor"><div><h3>编辑 {editor.template.packageName} 模板 Schema</h3><button onClick={() => setEditor(null)}>关闭</button></div><textarea aria-label="模板Schema JSON" value={editor.text} onChange={(event) => setEditor({ ...editor, text: event.target.value })} spellCheck={false} /><p>项目键须唯一，每项至少两个选项。发布后的历史订单仍使用原快照。</p><button className="primary-button" onClick={() => void saveSchema()}><Save size={16} />保存草稿 Schema</button></div>}</section>;
}

function AuditSettings() {
  const [audits, setAudits] = useState<Audit[] | null>(null);
  useEffect(() => { api<Audit[]>('/api/v1/admin/audit-events').then(setAudits); }, []);
  if (!audits) return <LoadingPage />;
  return <section className="surface-card settings-panel"><div className="settings-section-title"><History size={21} /><div><h2>操作审计</h2><p>追加式记录，不提供后台编辑或删除。</p></div></div><div className="audit-table"><div className="audit-head"><span>时间</span><span>操作</span><span>资源</span><span>操作人</span><span>结果</span></div>{audits.map((audit) => <div className="audit-row" key={audit.id}><span>{new Date(audit.createdAt).toLocaleString('zh-CN')}</span><strong>{audit.action}</strong><span>{audit.resourceType}</span><span>{audit.actorId?.slice(0, 8) ?? '公开访问'}</span><span className="audit-success"><Check size={14} />{audit.result}</span></div>)}</div></section>;
}

function statusLabel(status: string) {
  return ({ DRAFT: '草稿', PROFESSIONAL_REVIEW: '待专业复核', PUBLISHED: '已发布', DISABLED: '已停用' } as Record<string, string>)[status] ?? status;
}
