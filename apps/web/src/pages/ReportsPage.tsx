import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Copy, FileText, Link2, Share2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, ErrorMessage } from '../components/Common';
import { LoadingPage, PageHeader } from '../components/Layout';
import type { Report } from '../types';

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api<Report[]>(orderId ? `/api/v1/orders/${orderId}/reports` : '/api/v1/reports').then(setReports).catch((cause) => setError(cause.message));
  }, [orderId]);
  useEffect(() => { load(); }, [load]);

  async function share(reportId: string) {
    setError('');
    try {
      const result = await api<{ url: string }>(`/api/v1/reports/${reportId}/shares`, { method: 'POST', body: JSON.stringify({ expiresInDays: 30 }) });
      setShareUrl(result.url);
      setCopied(false);
      await navigator.clipboard?.writeText(result.url);
      setCopied(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '分享创建失败。'); }
  }
  if (!reports) return <LoadingPage />;
  return <div className="page"><PageHeader eyebrow="REPORTS / 正式档案" title="历史报告" description="查看经机构审核签发的不可变报告版本，创建或管理只读分享。" />
    {error && <ErrorMessage message={error} />}
    {shareUrl && <div className="share-success"><Link2 size={20} /><div><strong>只读分享链接已创建，30 天内有效</strong><input aria-label="报告分享链接" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /></div><button className="secondary-button" onClick={() => { void navigator.clipboard?.writeText(shareUrl); setCopied(true); }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制' : '复制链接'}</button></div>}
    {reports.length ? <div className="report-card-grid">{reports.map((report) => <article className="report-card" key={report.id}><div className="report-card-icon"><FileText size={26} /></div><span className="eyebrow">PUBLISHED REPORT / V{report.snapshot.versionNumber}.0</span><h2>{report.snapshot.vehicle.brand || '车辆'} {report.snapshot.vehicle.model}</h2><p>{report.snapshot.template.standardTitle} · {report.snapshot.template.packageName}</p><div className="report-number">{report.reportNo}</div><div className="report-card-meta"><span>签发时间</span><strong>{new Date(report.publishedAt).toLocaleString('zh-CN')}</strong></div>{report.shares.length > 0 && <div className="report-share-status"><Link2 size={14} />{report.shares.filter((share) => share.status === 'ACTIVE').length} 个有效分享 · {report.shares.filter((share) => share.status === 'REVOKED').length} 个已撤销</div>}<div className="report-card-actions"><Link to={`/reports/${report.id}`} className="secondary-button">查看报告<ChevronRight size={16} /></Link><button className="primary-button" onClick={() => void share(report.id)}><Share2 size={16} />分享</button></div></article>)}</div> : <EmptyState title="暂无正式报告" description="检测订单审核通过后，正式报告会显示在这里。" />}
  </div>;
}
