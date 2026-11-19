import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, RotateCcw, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorMessage, StatusBadge } from '../components/Common';
import { InspectionItemRow } from '../components/InspectionItem';
import { LoadingPage } from '../components/Layout';
import type { Inspection, Order } from '../types';

interface ReviewRecord {
  id: string;
  decision: string;
  comment?: string;
  createdAt: string;
}

export function ReviewDetailPage() {
  const { orderId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [history, setHistory] = useState<ReviewRecord[]>([]);
  const [activeSection, setActiveSection] = useState('');
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const [orderResult, inspectionResult, historyResult] = await Promise.all([api<Order>(`/api/v1/orders/${orderId}`), api<Inspection>(`/api/v1/orders/${orderId}/inspection/current`), api<ReviewRecord[]>(`/api/v1/orders/${orderId}/reviews`)]);
    setOrder(orderResult);
    setInspection(inspectionResult);
    setHistory(historyResult);
    setActiveSection((current) => current || inspectionResult.template.sections[0]?.key || '');
  }, [orderId]);
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, [load]);
  const answers = useMemo(() => Object.fromEntries(inspection?.answers.map((answer) => [answer.itemKey, answer]) ?? []), [inspection]);
  if (!order || !inspection) return <LoadingPage />;
  const admin = user?.role === 'ORG_ADMIN';
  const section = inspection.template.sections.find((entry) => entry.key === activeSection) ?? inspection.template.sections[0];
  const items = section.items.filter((item) => !onlyAbnormal || (answers[item.key] && !['正常', '无故障码', '数据正常', '未配备', '此项检测无此服务'].includes(answers[item.key].value)));

  async function approve() {
    if (!window.confirm('确认审核通过并生成正式报告？发布后内容不可直接修改。')) return;
    setProcessing(true);
    setError('');
    try {
      await api(`/api/v1/orders/${orderId}/reviews/${inspection!.id}/approve`, { method: 'POST', body: '{}' });
      navigate(`/reports?orderId=${orderId}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '审核发布失败。'); } finally { setProcessing(false); }
  }

  async function returnOrder() {
    if (!comment.trim()) { setError('请填写明确的退回修改意见。'); return; }
    if (!window.confirm('确认退回此检测版本？检测师将收到意见并创建新修订。')) return;
    setProcessing(true);
    setError('');
    try {
      await api(`/api/v1/orders/${orderId}/reviews/${inspection!.id}/return`, { method: 'POST', body: JSON.stringify({ comment }) });
      navigate('/reviews');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '退回失败。'); } finally { setProcessing(false); }
  }

  return <div className="page review-detail-page"><Link to="/reviews" className="back-link"><ArrowLeft size={17} />返回{admin ? '审核中心' : '审核进度'}</Link><div className="review-detail-header"><div><span className="eyebrow">{order.orderNo} / REVISION V{inspection.revisionNumber}</span><h1>{order.vehicle.brand || '车辆'} {order.vehicle.model} · {order.packageName}</h1><p>{order.vehicle.plate || '未登记车牌'} · {order.vehicle.mileage ?? 0} 公里 · {inspection.template.standardTitle} {inspection.template.standardVersion}</p></div><StatusBadge status={order.status} /></div>
    {order.status === 'NEEDS_MODIFICATION' && history.find((record) => record.decision === 'RETURNED') && <div className="return-comment"><RotateCcw size={20} /><div><strong>机构退回意见</strong><p>{history.find((record) => record.decision === 'RETURNED')?.comment}</p></div><Link to={`/orders/${orderId}/inspect`} className="primary-button">修改并重新提交<ChevronRight size={16} /></Link></div>}
    {error && <ErrorMessage message={error} />}
    <div className="review-meta"><div><span>提交时间</span><strong>{inspection.submittedAt ? new Date(inspection.submittedAt).toLocaleString('zh-CN') : '尚未提交'}</strong></div><div><span>检测模板</span><strong>V{inspection.template.revisionNumber} 锁定快照</strong></div><div><span>检测项目</span><strong>{inspection.answers.length} 项已填写</strong></div><div><span>现场影像</span><strong>{inspection.evidence.length} 张照片</strong></div></div>
    <div className="review-layout"><aside className="chapter-nav"><div className="chapter-nav-title">报告章节</div>{inspection.template.sections.map((entry, index) => <button key={entry.key} className={activeSection === entry.key ? 'active' : ''} onClick={() => setActiveSection(entry.key)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{entry.title}</strong><small>{entry.items.length} 项</small></div><ChevronRight size={15} /></button>)}</aside>
      <section className="chapter-content"><div className="chapter-heading"><div><span className="eyebrow">READ ONLY INSPECTION</span><h2>{section.title}</h2></div><label className="abnormal-filter"><input type="checkbox" checked={onlyAbnormal} onChange={(event) => setOnlyAbnormal(event.target.checked)} />仅看异常</label></div>
        <div className="inspection-table"><div className="inspection-table-head"><span>检测项目</span><span>检查结果</span><span>现场照片</span></div>{items.map((item, index) => <InspectionItemRow key={item.key} item={item} sectionKey={section.key} index={index} answer={answers[item.key]} evidence={inspection.evidence} readOnly uploading={false} onChange={() => undefined} onUpload={() => undefined} />)}</div>
      </section></div>
    {admin && order.status === 'REVIEW_PENDING' && <div className="review-action-panel"><div><ShieldCheck size={23} /><div><strong>机构审核决定</strong><p>请确认检测项目、尺寸判定和异常照片完整。不能审核本人提交的版本。</p></div></div><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="退回原因（退回时必填），可注明需补充的照片和检测项目。" /><div><button className="danger-button" disabled={processing} onClick={() => void returnOrder()}><AlertTriangle size={17} />填写意见并退回</button><button className="primary-button" disabled={processing} onClick={() => void approve()}><CheckCircle2 size={17} />{processing ? '处理中…' : '审核通过并发布'}</button></div></div>}
  </div>;
}
