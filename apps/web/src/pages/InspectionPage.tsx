import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CarFront, CheckCircle2, ChevronRight, Cloud, CloudUpload, FileCheck2, Save, ShieldAlert } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { InspectionAnswer, TemplateItem } from '@jianjian/contracts';
import { completionCount, getInspectionAlerts, validateInspection } from '@jianjian/templates';
import { api, ApiError, compressPhoto } from '../api';
import { ErrorMessage, StatusBadge } from '../components/Common';
import { InspectionItemRow } from '../components/InspectionItem';
import { LoadingPage } from '../components/Layout';
import type { Inspection, Order } from '../types';

export function InspectionPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [answers, setAnswers] = useState<Record<string, InspectionAnswer>>({});
  const [activeSection, setActiveSection] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const answersRef = useRef(answers);
  const inspectionRef = useRef(inspection);
  answersRef.current = answers;
  inspectionRef.current = inspection;

  const load = useCallback(async () => {
    const [orderData, inspectionData] = await Promise.all([api<Order>(`/api/v1/orders/${orderId}`), api<Inspection>(`/api/v1/orders/${orderId}/inspection/current`)]);
    setOrder(orderData);
    setInspection(inspectionData);
    setAnswers(Object.fromEntries(inspectionData.answers.map((answer) => [answer.itemKey, answer])));
    setActiveSection((current) => current || inspectionData.template.sections[0]?.key || '');
  }, [orderId]);

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, [load]);

  const persist = useCallback(async () => {
    const current = inspectionRef.current;
    if (!current || current.status !== 'DRAFT') return current;
    setSaving(true);
    setError('');
    try {
      const saved = await api<Inspection>(`/api/v1/orders/${orderId}/inspection/draft`, { method: 'PUT', body: JSON.stringify({ lockVersion: current.lockVersion, answers: Object.values(answersRef.current) }) });
      setInspection(saved);
      setDirty(false);
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '草稿保存失败。');
      throw cause;
    } finally { setSaving(false); }
  }, [orderId]);

  useEffect(() => {
    if (!dirty || inspection?.status !== 'DRAFT') return;
    const timer = window.setTimeout(() => { persist().catch(() => undefined); }, 1000);
    return () => window.clearTimeout(timer);
  }, [answers, dirty, inspection?.status, persist]);

  const answerList = useMemo(() => Object.values(answers), [answers]);
  const alerts = useMemo(() => inspection ? getInspectionAlerts(inspection.template, answerList) : null, [inspection, answerList]);
  const alertKey = `${alerts?.accidentCount}-${alerts?.waterCount}-${alerts?.fireCount}`;
  useEffect(() => {
    if (!alerts) return;
    const message = alerts.accident ? `事故车提示：发现 ${alerts.accidentCount} 项大于阈值的关键结构损伤` : alerts.water ? `泡水车提示：${alerts.waterCount} 个重点项目发现水渍泥沙` : alerts.fire ? '火烧车提示：发现烧蚀、熏黑碳化或炙烤融化' : '';
    if (!message) return;
    setToast(message);
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [alertKey]);

  if (!order || !inspection) return <LoadingPage />;
  const section = inspection.template.sections.find((entry) => entry.key === activeSection) ?? inspection.template.sections[0];
  const readOnly = inspection.status !== 'DRAFT';
  const total = inspection.template.sections.reduce((sum, entry) => sum + entry.items.length, 0);
  const completed = completionCount(inspection.template, answerList);

  function updateAnswer(answer: InspectionAnswer) {
    setAnswers((current) => ({ ...current, [answer.itemKey]: answer }));
    setDirty(true);
  }

  async function upload(item: TemplateItem, file: File) {
    setUploading(item.key);
    setError('');
    try {
      await persist();
      const compressed = await compressPhoto(file);
      const data = new FormData();
      data.append('file', compressed);
      data.append('orderId', orderId);
      data.append('itemKey', item.key);
      await api('/api/v1/media/upload', { method: 'POST', body: data });
      const refreshed = await api<Inspection>(`/api/v1/orders/${orderId}/inspection/current`);
      setInspection(refreshed);
      setAnswers(Object.fromEntries(refreshed.answers.map((answer) => [answer.itemKey, answer])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '照片上传失败，请重试。');
    } finally { setUploading(''); }
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const saved = await persist();
      const currentAnswers = Object.values(answersRef.current);
      const issues = validateInspection(saved!.template, currentAnswers, Object.fromEntries(saved!.evidence.map((entry) => [entry.id, entry.status === 'READY' ? 'READY' : 'UPLOADING'])));
      if (issues.length) {
        setActiveSection(issues[0].sectionKey);
        setError(issues[0].message);
        setTimeout(() => document.getElementById(`item-${issues[0].itemKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        return;
      }
      await api(`/api/v1/orders/${orderId}/inspection/submit`, { method: 'POST', body: JSON.stringify({ lockVersion: saved!.lockVersion }) });
      navigate(`/reviews/${orderId}`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.details?.issues?.length) {
        const issue = cause.details.issues[0];
        setActiveSection(issue.sectionKey);
        setError(issue.message);
      } else setError(cause instanceof Error ? cause.message : '提交审核失败。');
    } finally { setSubmitting(false); }
  }

  return <div className="inspection-page">
    {toast && <div className="alert-toast" role="alert"><ShieldAlert size={23} /><div><strong>{toast.split('：')[0]}</strong><span>{toast.split('：')[1] ?? '请复核相关检测项目与照片。'}</span></div></div>}
    <header className="inspection-header"><div><Link to="/orders" className="back-link"><ArrowLeft size={17} />检测订单</Link><div className="inspection-title"><span className="eyebrow">{order.orderNo}</span><h1>{order.standard === 'NATIONAL' ? '国标' : '团标'} · {order.packageName}</h1></div></div><div className="inspection-header-actions"><StatusBadge status={order.status} /><Link to={`/orders/${order.id}/vehicle`} className="secondary-button"><CarFront size={16} />车辆资料</Link></div></header>
    <div className="inspection-progress"><div><span>检测进度</span><strong>{completed}<small> / {total} 项</small></strong></div><div className="progress-track"><span style={{ width: `${total ? completed / total * 100 : 0}%` }} /></div><span className={`save-state ${saving ? 'saving' : ''}`}>{saving ? <CloudUpload size={16} /> : <Cloud size={16} />}{saving ? '正在保存' : dirty ? '等待自动保存' : '草稿已保存'}</span></div>
    {alerts && (alerts.accident || alerts.water || alerts.fire) && <div className="persistent-alert"><AlertTriangle size={20} /><div>{alerts.accident && <strong>事故车提示：{alerts.accidentCount} 项关键决定项损伤大于30cm×30cm</strong>}{alerts.water && <strong>泡水车提示：{alerts.waterCount} 个重点项目选择水渍泥沙</strong>}{alerts.fire && <strong>火烧车提示：发现火烧相关异常结果</strong>}<span>请复核检测结果并确保异常项目已附现场照片。</span></div></div>}
    {error && <ErrorMessage message={error} />}
    <div className="inspection-layout">
      <aside className="chapter-nav"><div className="chapter-nav-title">检测章节<span>{inspection.template.sections.length} 个模块</span></div>{inspection.template.sections.map((entry, index) => {
        const count = entry.items.filter((item) => {
          const answer = answers[item.key];
          return answer?.value && (!item.requiresSizeWhenAbnormal || answer.value === '正常' || answer.size);
        }).length;
        return <button key={entry.key} className={activeSection === entry.key ? 'active' : ''} onClick={() => setActiveSection(entry.key)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{entry.title}</strong><small>{count} / {entry.items.length} 项</small></div><ChevronRight size={15} /></button>;
      })}</aside>
      <section className="chapter-content">
        <div className="chapter-heading"><div><span className="eyebrow">SECTION {String(inspection.template.sections.indexOf(section) + 1).padStart(2, '0')}</span><h2>{section.title}</h2><p>{section.guidance ?? '请按现场实际情况逐项检查，异常结果须添加对应照片。'}</p></div><span>{section.items.length} 项</span></div>
        <div className="inspection-table"><div className="inspection-table-head"><span>检测项目</span><span>检查结果</span><span>现场照片</span></div>{section.items.map((item, index) => <InspectionItemRow key={item.key} item={item} sectionKey={section.key} index={index} answer={answers[item.key]} evidence={inspection.evidence} readOnly={readOnly} uploading={uploading === item.key} onChange={updateAnswer} onUpload={(file) => void upload(item, file)} />)}</div>
        <div className="chapter-footer"><span><CheckCircle2 size={16} />本章节 {section.items.filter((item) => answers[item.key]?.value).length} / {section.items.length} 项已填写</span><span>模板版本 V{inspection.template.revisionNumber} · 检测修订 V{inspection.revisionNumber}</span></div>
      </section>
    </div>
    {!readOnly && <div className="submit-bar"><div><FileCheck2 size={20} /><span>提交后当前版本将冻结，仅机构管理员可审核。</span></div><button className="secondary-button" disabled={saving || submitting} onClick={() => void persist()}><Save size={17} />保存草稿</button><button className="primary-button" disabled={saving || submitting} onClick={() => void submit()}>{submitting ? '正在校验提交…' : '提交机构审核'}<ChevronRight size={17} /></button></div>}
  </div>;
}
