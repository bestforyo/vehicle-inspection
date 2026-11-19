import { useEffect, useState } from 'react';
import { FileX2, ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { ReportView } from '../components/ReportView';
import type { PublicReport } from '../types';

export function PublicReportPage() {
  const { token = '' } = useParams();
  const [report, setReport] = useState<PublicReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    document.title = '车辆检测报告 · 鉴见';
    api<PublicReport>(`/public/v1/reports/${token}`).then((result) => {
      setReport(result);
      document.title = `${result.reportNo} · 车辆检测报告`;
    }).catch((cause) => setError(cause instanceof Error ? cause.message : '报告不可用。')).finally(() => setLoading(false));
  }, [token]);
  if (loading) return <main className="public-report"><div className="loading-state"><ShieldCheck size={28} /><span>正在核验报告有效性与公开权限…</span></div></main>;
  if (error || !report) return <main className="public-report"><div className="report-unavailable"><span className="brand-mark">鉴</span><FileX2 size={42} /><h1>报告暂时不可用</h1><p>{error || '报告链接不存在、已过期或已撤销。'}</p><small>如需查看，请联系出具报告的检测机构获取有效链接。</small></div></main>;
  return <main className="public-report"><div className="public-readonly-banner"><ShieldCheck size={16} />此页面为机构签发的只读报告，无需登录。链接有效期至 {report.expiresAt ? new Date(report.expiresAt).toLocaleDateString('zh-CN') : '机构撤销时'}。</div><ReportView report={report} token={token} /></main>;
}
