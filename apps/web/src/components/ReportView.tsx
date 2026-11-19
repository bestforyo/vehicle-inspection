import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CalendarDays, CheckCircle2, FileCheck2, ImageOff, Printer, ShieldCheck } from 'lucide-react';
import type { InspectionAnswer } from '@jianjian/contracts';
import { api } from '../api';
import type { PublicReport } from '../types';

export function ReportView({ report, token }: { report: PublicReport; token?: string }) {
  const [toast, setToast] = useState('');
  const answers = useMemo(() => Object.fromEntries(report.answers.map((answer) => [answer.itemKey, answer])), [report.answers]);
  useEffect(() => {
    const message = report.alerts.accident ? `事故车提示：${report.alerts.accidentCount} 项关键结构损伤大于阈值` : report.alerts.water ? `泡水车提示：${report.alerts.waterCount} 个重点项目发现水渍泥沙` : report.alerts.fire ? '火烧车提示：发现火烧相关异常结果' : '';
    if (!message) return;
    setToast(message);
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [report]);
  return <div className="report-document">
    {toast && <div className="alert-toast report-alert" role="alert"><AlertTriangle size={22} /><strong>{toast}</strong></div>}
    <section className="report-cover">
      <div className="report-cover-brand"><span className="brand-mark">鉴</span><div><strong>鉴见</strong><small>INSPECTION STUDIO</small></div></div>
      <div className="report-cover-title"><span className="eyebrow">VEHICLE INSPECTION REPORT</span><h1>{report.title}</h1><p>{report.template.standardTitle} · {report.template.packageName}</p></div>
      <div className="report-cover-vehicle"><span>检测车辆</span><h2>{report.vehicle.brand || '未登记品牌'} {report.vehicle.model}</h2><p>{report.vehicle.plate}</p></div>
      <div className="report-cover-bottom"><div><span>报告编号</span><strong>{report.reportNo}</strong></div><div><span>报告版本</span><strong>V{report.versionNumber}.0</strong></div><div className="report-stamp"><ShieldCheck size={26} /><span>机构审核<br />正式发布</span></div></div>
      <span className="report-orbit" />
    </section>
    <section className="report-org-strip"><div className="report-org-logo">{report.organization.logoText}</div><div><strong>{report.organization.name}</strong><span>{report.organization.displayName} · 签发机构</span></div><div><CheckCircle2 size={17} />已审核发布</div></section>
    <main className="report-body">
      {(report.alerts.accident || report.alerts.water || report.alerts.fire) && <section className="report-conclusions"><span className="eyebrow">INSPECTION NOTICE</span><h2>检测异常提示</h2><div className="report-alert-grid">{report.alerts.accident && <div><AlertTriangle size={20} /><strong>事故车提示</strong><p>{report.alerts.accidentCount} 个关键决定项的非正常结果尺寸大于30cm×30cm，请结合明细复核。</p></div>}{report.alerts.water && <div><AlertTriangle size={20} /><strong>泡水车提示</strong><p>{report.alerts.waterCount} 个重点泡水项目选择“水渍泥沙”，请结合明细与现场影像复核。</p></div>}{report.alerts.fire && <div><AlertTriangle size={20} /><strong>火烧车提示</strong><p>发现烧蚀、熏黑碳化或炙烤融化结果，请结合明细与现场影像复核。</p></div>}</div></section>}
      <section className="report-section"><div className="report-section-heading"><span>01</span><div><span className="eyebrow">INSPECTION PROFILE</span><h2>检测信息</h2></div></div><div className="report-info-grid"><Info label="检测日期" value={new Date(report.publishedAt).toLocaleDateString('zh-CN')} /><Info label="检测套餐" value={`${report.template.standard === 'NATIONAL' ? '国标' : '团标'} / ${report.template.packageName}`} /><Info label="标准及版本" value={`${report.template.standardTitle} ${report.template.standardVersion}`} /><Info label="检测师" value={report.inspectorName} /><Info label="审核人" value={report.reviewerName} /><Info label="签发时间" value={new Date(report.publishedAt).toLocaleString('zh-CN')} /></div></section>
      <section className="report-section"><div className="report-section-heading"><span>02</span><div><span className="eyebrow">VEHICLE PROFILE</span><h2>车辆信息</h2></div></div><div className="report-info-grid"><Info label="车辆类型" value={report.vehicle.kind === 'MOTORCYCLE' ? '摩托车' : '乘用车'} /><Info label="品牌 / 车型" value={`${report.vehicle.brand || '未登记'} ${report.vehicle.model}`} /><Info label="车牌号码" value={report.vehicle.plate} /><Info label="车架号 VIN" value={report.vehicle.vin} /><Info label="款型年份" value={report.vehicle.year ? `${report.vehicle.year} 年` : '未登记'} /><Info label="表显里程" value={report.vehicle.mileage !== undefined ? `${report.vehicle.mileage.toLocaleString()} 公里` : '未登记'} /><Info label="首次上牌" value={report.vehicle.firstRegisteredAt ? new Date(report.vehicle.firstRegisteredAt).toLocaleDateString('zh-CN') : '未登记'} /></div><p className="privacy-note">车辆识别信息已按机构公开策略脱敏，里程以检测时仪表或读取数据为准。</p></section>
      <section className="report-section"><div className="report-section-heading"><span>03</span><div><span className="eyebrow">INSPECTION RESULTS</span><h2>检测结果</h2></div></div><div className="report-chapters">{report.template.sections.map((section, sectionIndex) => <article className="report-chapter" key={section.key}><div className="report-chapter-title"><span>{String(sectionIndex + 1).padStart(2, '0')}</span><h3>{section.title}</h3><small>{section.items.length} 项</small></div><div className="report-result-list">{section.items.map((item, index) => {
        const answer = answers[item.key] as InspectionAnswer | undefined;
        const abnormal = answer?.value && !['正常', '无故障码', '数据正常', '未配备', '此项检测无此服务'].includes(answer.value);
        return <div className="report-result-item" key={item.key}><span className="report-item-index">{String(index + 1).padStart(2, '0')}</span><div className="report-item-name">{item.title}{answer?.note && <p>{item.noteLabel ?? '车况说明'}：{answer.note}</p>}{answer?.photoIds?.map((assetId) => <ReportPhoto key={assetId} token={token} assetId={assetId} itemName={item.title} />)}</div><div className={`report-result-value ${abnormal ? 'abnormal' : 'normal'}`}><strong>{answer?.value || '未检查'}</strong>{answer?.size && <small>{answer.size === 'GREATER_THAN_30' ? '大于30cm×30cm' : '小于30cm×30cm'}</small>}</div></div>;
      })}</div></article>)}</div></section>
      <section className="report-section report-disclaimer"><div className="report-section-heading"><span>04</span><div><span className="eyebrow">STATEMENT & LIMITATION</span><h2>补充说明</h2></div></div><p>{report.disclaimer}</p><p>本报告仅覆盖当次模板版本列明的检测项目，不包含未拆检、未配备或无法判定部分的延伸承诺。委托人或车辆使用人提供的信息由其自行负责，检测照片与结果对应报告签发时的记录。</p><div className="report-standard-ref"><FileCheck2 size={19} /><span>本次选用标准及版本：<strong>{report.template.standardTitle} / {report.template.standardVersion}</strong>。标准原文默认不作为公开附件。</span></div></section>
      <section className="report-issue"><div className="report-org-logo">{report.organization.logoText}</div><div><Building2 size={17} /><strong>{report.organization.name}</strong><span>报告编号：{report.reportNo} · 版本 V{report.versionNumber}.0</span></div><div><CalendarDays size={17} /><span>{new Date(report.publishedAt).toLocaleString('zh-CN')}</span></div></section>
    </main>
    <footer className="report-footer"><span>鉴见 INSPECTION STUDIO</span><span>专业检测 · 清晰留痕 · 只读报告</span><button onClick={() => window.print()}><Printer size={15} />打印 / 保存 PDF</button></footer>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function ReportPhoto({ token, assetId, itemName }: { token?: string; assetId: string; itemName: string }) {
  const [url, setUrl] = useState(token ? `${import.meta.env.VITE_API_BASE_URL ?? ''}/public/v1/reports/${token}/assets/${assetId}/preview` : '');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (token) return;
    api<{ url: string }>(`/api/v1/media/${assetId}/preview-url`).then((result) => setUrl(`${import.meta.env.VITE_API_BASE_URL ?? ''}${result.url}`)).catch(() => setFailed(true));
  }, [assetId, token]);
  return <figure className="report-photo">{url && !failed ? <img src={url} alt={`${itemName}现场照片`} loading="lazy" width="720" height="480" onError={() => setFailed(true)} /> : <div><ImageOff size={20} /><span>照片暂不可用</span></div>}<figcaption>{itemName} · 现场影像</figcaption></figure>;
}
