import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, FileCheck2, Leaf, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PackageCode } from '@jianjian/contracts';
import { api } from '../api';
import { ErrorMessage } from '../components/Common';
import { LoadingPage, PageHeader } from '../components/Layout';
import type { Order } from '../types';

interface TemplateSummary {
  packageCode: PackageCode;
  packageName: string;
  available: boolean;
  unavailableReason?: string;
  templateRevisionId?: string;
  sectionCount: number;
  itemCount: number;
}

const descriptions: Record<PackageCode, string> = {
  THREE_NON: '事故、泡水、火烧专项排查，覆盖漆面与关键结构。',
  FOUR_NON: '在三非排查基础上，增加车辆里程数据读取。',
  FULL: '从外观到结构、内饰、诊断和底盘的完整现场检测。',
  NEW_CAR: '新车交付核验，包含车况功能性与款型年份核对。',
  NEW_ENERGY: '新能源专项检测能力正在建设中。',
};

export function CreatePage() {
  const { standard } = useParams<{ standard?: string }>();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(standard));
  const [creating, setCreating] = useState<PackageCode | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (standard !== 'NATIONAL' && standard !== 'GROUP') return;
    setLoading(true);
    api<TemplateSummary[]>(`/api/v1/templates?standard=${standard}`).then(setTemplates).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  }, [standard]);

  async function create(template: TemplateSummary) {
    if (!template.available || !template.templateRevisionId) return;
    setCreating(template.packageCode);
    setError('');
    try {
      const order = await api<Order>('/api/v1/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ kind: 'PASSENGER_CAR', templateRevisionId: template.templateRevisionId }),
      });
      navigate(`/orders/${order.id}/inspect`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '订单创建失败，请重试。');
      setCreating(null);
    }
  }

  if (!standard) return <div className="page create-page"><Link to="/" className="back-link"><ArrowLeft size={17} />返回首页</Link><PageHeader eyebrow="NEW INSPECTION / STEP 01" title="选择检测标准" description="根据委托需求选择本次检测采用的标准配置。" /><StepIndicator current={1} />
    <div className="standard-grid">
      <Link to="/create/NATIONAL" className="standard-card"><span className="standard-icon"><ShieldCheck size={34} /></span><span className="eyebrow">NATIONAL STANDARD</span><h2>按国家标准配置的检测模板</h2><p>使用国标重大事故专属清单，其他模块按配置复用。</p><div><span>4 种可用检测类型</span><ArrowRight size={20} /></div></Link>
      <Link to="/create/GROUP" className="standard-card"><span className="standard-icon"><FileCheck2 size={34} /></span><span className="eyebrow">GROUP STANDARD</span><h2>按团体标准配置的检测模板</h2><p>使用团标重大事故清单及完整车况功能检测配置。</p><div><span>4 种可用检测类型</span><ArrowRight size={20} /></div></Link>
    </div><div className="form-disclaimer">模板清单为产品示范配置，正式业务使用前须由机构和专业人员审核发布。</div>
  </div>;

  if (loading) return <LoadingPage />;
  return <div className="page create-page"><Link to="/create" className="back-link"><ArrowLeft size={17} />重新选择标准</Link><PageHeader eyebrow="NEW INSPECTION / STEP 02" title="选择检测类型" description={`当前选择：${standard === 'NATIONAL' ? '国家标准配置' : '团体标准配置'}。选择后立即创建订单并开始检测。`} /><StepIndicator current={2} />
    {error && <ErrorMessage message={error} />}
    <div className="package-list">{templates.map((template, index) => {
      const Icon = [ClipboardCheck, ShieldCheck, FileCheck2, Sparkles, Leaf][index];
      return <button key={template.packageCode} className={`package-card ${!template.available ? 'disabled' : ''}`} disabled={!template.available || Boolean(creating)} onClick={() => void create(template)}>
        <span className="package-index">0{index + 1}</span><span className="package-icon"><Icon size={28} /></span><span className="package-copy"><span className="package-title">{template.packageName}{!template.available && <small>{template.unavailableReason}</small>}</span><span>{descriptions[template.packageCode]}</span>{template.available && <span className="package-meta">{template.sectionCount} 个检测模块 · {template.itemCount} 个检测项目</span>}</span><span className="package-action">{creating === template.packageCode ? '正在创建…' : template.available ? <><span>立即开始</span><ArrowRight size={20} /></> : <span>暂不可用</span>}</span>
      </button>;
    })}</div><div className="form-disclaimer"><Check size={15} />创建订单时将固定当前模板版本，后续模板调整不会影响本订单。</div>
  </div>;
}

function StepIndicator({ current }: { current: 1 | 2 }) {
  return <div className="step-indicator"><div className="step active"><span>{current > 1 ? <Check size={16} /> : '1'}</span><div><strong>选择标准</strong><small>国标 / 团标</small></div></div><i /><div className={`step ${current === 2 ? 'active' : ''}`}><span>2</span><div><strong>选择类型</strong><small>创建并开始检测</small></div></div></div>;
}
