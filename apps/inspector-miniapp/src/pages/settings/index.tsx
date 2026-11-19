import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { TenantRole, TemplateRevision } from '@jianjian/contracts';
import { request, showError } from '../../api';

interface Tenant { id: string; name: string; displayName: string; logoText: string; planName: string; settings: { disclaimer?: string } }
interface Member { id: string; role: TenantRole; status: string; user: { id: string; email: string; displayName: string; status: string } }
interface TemplateRecord { id: string; packageName: string; standardCode: string; packageCode: string; revisions: Array<{ id: string; revisionNumber: number; status: string; schema: TemplateRevision }> }
interface Audit { id: string; action: string; resourceType: string; actorId?: string; createdAt: string }
type Tab = 'profile' | 'members' | 'templates' | 'audit';

const tabNames: Array<[Tab, string]> = [['profile', '机构资料'], ['members', '成员角色'], ['templates', '检测模板'], ['audit', '操作审计']];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  return <View className='page'><Text className='eyebrow'>ORGANIZATION ADMIN</Text><Text className='page-title'>机构管理</Text><View className='chapter-scroll'>{tabNames.map(([key, name]) => <Button key={key} className={`chapter-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{name}</Button>)}</View>{tab === 'profile' && <ProfileSettings />}{tab === 'members' && <MemberSettings />}{tab === 'templates' && <TemplateSettings />}{tab === 'audit' && <AuditSettings />}</View>;
}

function ProfileSettings() {
  const [form, setForm] = useState({ name: '', displayName: '', logoText: '', disclaimer: '' });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { request<Tenant>('/api/v1/admin/tenant').then((tenant) => { setForm({ name: tenant.name, displayName: tenant.displayName, logoText: tenant.logoText, disclaimer: tenant.settings.disclaimer ?? '' }); setLoaded(true); }).catch(showError); }, []);
  async function save() {
    try { await request('/api/v1/admin/tenant', 'PATCH', form); Taro.showToast({ title: '机构资料已保存', icon: 'success' }); } catch (cause) { showError(cause); }
  }
  if (!loaded) return <View className='empty'>正在加载机构资料…</View>;
  return <View className='card'><Text className='card-title'>机构资料与报告品牌</Text><Text className='card-desc'>历史报告保留签发时快照，不受后续修改影响。</Text>{([['name', '机构全称'], ['displayName', '品牌显示名'], ['logoText', '报告标记文字']] as const).map(([key, label]) => <View className='form-field' key={key}><Text className='form-label'>{label}</Text><Input className='input' value={form[key]} onInput={(event) => setForm({ ...form, [key]: event.detail.value })} /></View>)}<View className='form-field'><Text className='form-label'>报告免责声明</Text><Textarea className='textarea' value={form.disclaimer} onInput={(event) => setForm({ ...form, disclaimer: event.detail.value })} /></View><Button className='primary full-button' onClick={save}>保存机构资料</Button></View>;
}

function MemberSettings() {
  const [members, setMembers] = useState<Member[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', displayName: '', password: '', role: 'INSPECTOR' as TenantRole });
  const load = useCallback(() => { request<Member[]>('/api/v1/admin/members').then(setMembers).catch(showError); }, []);
  useEffect(() => { load(); }, [load]);
  async function invite() {
    try { await request('/api/v1/admin/members/invitations', 'POST', form); setShowInvite(false); setForm({ email: '', displayName: '', password: '', role: 'INSPECTOR' }); load(); } catch (cause) { showError(cause); }
  }
  async function update(member: Member, patch: { role?: TenantRole; status?: string }) {
    try { await request(`/api/v1/admin/members/${member.id}`, 'PATCH', patch); load(); } catch (cause) { showError(cause); }
  }
  return <View><Button className='primary full-button' onClick={() => setShowInvite(!showInvite)}>{showInvite ? '取消邀请' : '邀请机构成员'}</Button>{showInvite && <View className='card'><Text className='card-title'>创建成员账号</Text><View className='form-field'><Text className='form-label'>姓名</Text><Input className='input' value={form.displayName} onInput={(event) => setForm({ ...form, displayName: event.detail.value })} /></View><View className='form-field'><Text className='form-label'>工作邮箱</Text><Input className='input' value={form.email} onInput={(event) => setForm({ ...form, email: event.detail.value })} /></View><View className='form-field'><Text className='form-label'>初始密码（至少10位）</Text><Input className='input' password value={form.password} onInput={(event) => setForm({ ...form, password: event.detail.value })} /></View><Picker mode='selector' range={['检测师', '机构管理员']} onChange={(event) => setForm({ ...form, role: Number(event.detail.value) === 1 ? 'ORG_ADMIN' : 'INSPECTOR' })}><View className='picker-input'>业务角色：{form.role === 'ORG_ADMIN' ? '机构管理员' : '检测师'}</View></Picker><Button className='primary full-button' onClick={invite}>确认创建</Button></View>}{members.map((member) => <View className='card' key={member.id}><View className='row'><View><Text className='card-title'>{member.user.displayName}</Text><Text className='card-desc'>{member.user.email}</Text></View><Text className='status'>{member.status === 'ACTIVE' ? '正常' : '已停用'}</Text></View><Picker mode='selector' range={['检测师', '机构管理员']} value={member.role === 'ORG_ADMIN' ? 1 : 0} onChange={(event) => update(member, { role: Number(event.detail.value) === 1 ? 'ORG_ADMIN' : 'INSPECTOR' })}><View className='picker-input'>角色：{member.role === 'ORG_ADMIN' ? '机构管理员' : '检测师'}</View></Picker><Button className={member.status === 'ACTIVE' ? 'danger full-button' : 'secondary full-button'} onClick={() => update(member, { status: member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}>{member.status === 'ACTIVE' ? '停用成员' : '恢复成员'}</Button></View>)}</View>;
}

function TemplateSettings() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [editor, setEditor] = useState<{ template: TemplateRecord; revisionId: string; text: string } | null>(null);
  const load = useCallback(() => { request<TemplateRecord[]>('/api/v1/admin/templates').then(setTemplates).catch(showError); }, []);
  useEffect(() => { load(); }, [load]);
  async function clone(template: TemplateRecord) {
    try { await request(`/api/v1/admin/templates/${template.id}/revisions`, 'POST', {}); load(); } catch (cause) { showError(cause); }
  }
  async function transition(template: TemplateRecord, revisionId: string, action: 'submit' | 'publish') {
    try {
      if (action === 'publish') {
        const choice = await Taro.showModal({ title: '确认专业复核', content: '发布前须确认检查清单、判定规则和报告用语已经专业人员复核。' });
        if (!choice.confirm) return;
      }
      await request(`/api/v1/admin/templates/${template.id}/revisions/${revisionId}/${action}`, 'POST', action === 'publish' ? { professionalApprovalConfirmed: true } : {});
      load();
    } catch (cause) { showError(cause); }
  }
  async function saveSchema() {
    if (!editor) return;
    try {
      const schema = JSON.parse(editor.text) as TemplateRevision;
      await request(`/api/v1/admin/templates/${editor.template.id}/revisions/${editor.revisionId}/schema`, 'PUT', { schema });
      setEditor(null);
      load();
    } catch (cause) { showError(cause); }
  }
  return <View>{templates.map((template) => {
    const latest = template.revisions[0];
    return <View className='card' key={template.id}><Text className='eyebrow'>{template.standardCode} / {template.packageCode}</Text><Text className='card-title'>{template.packageName}</Text><Text className='card-desc'>V{latest.revisionNumber} · {latest.schema.sections.length} 章节 · {latest.schema.sections.reduce((sum, section) => sum + section.items.length, 0)} 项 · {latest.status}</Text><Button className='secondary full-button' onClick={() => clone(template)}>复制新修订</Button>{latest.status === 'DRAFT' && <><Button className='secondary full-button' onClick={() => setEditor({ template, revisionId: latest.id, text: JSON.stringify(latest.schema, null, 2) })}>编辑 Schema</Button><Button className='primary full-button' onClick={() => transition(template, latest.id, 'submit')}>提交专业复核</Button></>}{latest.status === 'PROFESSIONAL_REVIEW' && <Button className='primary full-button' onClick={() => transition(template, latest.id, 'publish')}>确认复核并发布</Button>}</View>;
  })}{editor && <View className='card'><Text className='card-title'>编辑模板 Schema</Text><Text className='card-desc'>项目键须唯一，每项至少两个选项；发布后的历史订单不受影响。</Text><Textarea className='textarea' style={{ height: '500px', fontSize: '20px' }} value={editor.text} onInput={(event) => setEditor({ ...editor, text: event.detail.value })} /><Button className='primary full-button' onClick={saveSchema}>保存草稿 Schema</Button><Button className='secondary full-button' onClick={() => setEditor(null)}>取消编辑</Button></View>}</View>;
}

function AuditSettings() {
  const [audits, setAudits] = useState<Audit[]>([]);
  useEffect(() => { request<Audit[]>('/api/v1/admin/audit-events').then(setAudits).catch(showError); }, []);
  return <View><View className='notice'>审计记录仅追加，不提供编辑或删除。</View>{audits.map((audit) => <View className='card' key={audit.id}><Text className='card-title'>{audit.action}</Text><Text className='card-desc'>{audit.resourceType} · {audit.actorId?.slice(0, 8) ?? '公开访问'}</Text><Text className='card-meta'>{new Date(audit.createdAt).toLocaleString('zh-CN')}</Text></View>)}</View>;
}
