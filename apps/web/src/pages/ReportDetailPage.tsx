import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Link2, Share2, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorMessage } from '../components/Common';
import { LoadingPage } from '../components/Layout';
import { ReportView } from '../components/ReportView';
import type { Report } from '../types';

export function ReportDetailPage() {
  const { reportId = '' } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api<Report>(`/api/v1/reports/${reportId}`).then(setReport).catch((cause) => setError(cause.message)); }, [reportId]);
  async function createShare() {
    try {
      const result = await api<{ url: string }>(`/api/v1/reports/${reportId}/shares`, { method: 'POST', body: JSON.stringify({ expiresInDays: 30 }) });
      setShareUrl(result.url);
      await navigator.clipboard?.writeText(result.url);
      setCopied(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '分享创建失败。'); }
  }
  async function revoke(shareId: string) {
    if (!window.confirm('确认撤销此分享？撤销后公开报告和照片将立即无法访问。')) return;
    try {
      await api(`/api/v1/reports/${reportId}/shares/${shareId}/revoke`, { method: 'POST', body: '{}' });
      setReport(await api<Report>(`/api/v1/reports/${reportId}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '撤销失败。'); }
  }
  if (!report) return <LoadingPage />;
  return <div className="page report-detail-page"><div className="report-detail-toolbar"><Link to="/reports" className="back-link"><ArrowLeft size={17} />返回历史报告</Link><button className="primary-button" onClick={() => void createShare()}><Share2 size={16} />创建只读分享</button></div>{error && <ErrorMessage message={error} />}{shareUrl && <div className="share-success"><Link2 size={20} /><input aria-label="报告分享链接" readOnly value={shareUrl} /><button className="secondary-button" onClick={() => { void navigator.clipboard?.writeText(shareUrl); setCopied(true); }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制' : '复制链接'}</button></div>}
    {user?.role === 'ORG_ADMIN' && report.shares.length > 0 && <div className="share-management"><strong>分享管理</strong>{report.shares.map((share) => <div key={share.id}><span className={`share-state ${share.status.toLowerCase()}`}>{share.status === 'ACTIVE' ? '有效' : '已撤销'} · 至 {new Date(share.expiresAt).toLocaleDateString('zh-CN')}</span>{share.status === 'ACTIVE' && <button className="icon-danger" onClick={() => void revoke(share.id)}><Trash2 size={15} />撤销</button>}</div>)}</div>}
    <ReportView report={report.snapshot} />
  </div>;
}
