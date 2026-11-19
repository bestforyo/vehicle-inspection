import { useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { request, showError } from '../../api';
import type { PublicReport } from '../../types';

interface InternalReport { id: string; snapshot: PublicReport; shares: Array<{ id: string; status: string; expiresAt: string }> }

export default function ReportPage() {
  const router = useRouter();
  const token = router.params.token;
  const orderId = router.params.orderId;
  const [report, setReport] = useState<PublicReport>();
  const [shareUrl, setShareUrl] = useState('');
  const [internal, setInternal] = useState<InternalReport>();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (token) request<PublicReport>(`/public/v1/reports/${token}`).then(setReport).catch(showError);
    else if (orderId) {
      request<InternalReport[]>(`/api/v1/orders/${orderId}/reports`).then((reports) => {
        if (reports[0]) {
          setReport(reports[0].snapshot);
          setInternal(reports[0]);
        }
      }).catch(showError);
      request<{ role: string }>('/api/v1/auth/me').then((user) => setIsAdmin(user.role === 'ORG_ADMIN')).catch(() => undefined);
    }
  }, [token, orderId]);
  async function share() {
    if (!orderId) { if (shareUrl) Taro.setClipboardData({ data: shareUrl }); return; }
    try {
      const reports = await request<InternalReport[]>(`/api/v1/orders/${orderId}/reports`);
      if (!reports[0]) return;
      const result = await request<{ url: string }>(`/api/v1/reports/${reports[0].id}/shares`, 'POST', { expiresInDays: 30 });
      setShareUrl(result.url);
      await Taro.setClipboardData({ data: result.url });
      Taro.showModal({ title: '分享链接已复制', content: '委托人无需登录即可在30天内查看只读报告。', showCancel: false });
    } catch (cause) { showError(cause); }
  }
  async function revoke(shareId: string) {
    if (!internal) return;
    const choice = await Taro.showModal({ title: '撤销分享', content: '撤销后公开报告和照片将立即无法访问。' });
    if (!choice.confirm) return;
    try {
      await request(`/api/v1/reports/${internal.id}/shares/${shareId}/revoke`, 'POST', {});
      setInternal({ ...internal, shares: internal.shares.map((share) => share.id === shareId ? { ...share, status: 'REVOKED' } : share) });
      Taro.showToast({ title: '分享已撤销', icon: 'success' });
    } catch (cause) { showError(cause); }
  }
  if (!report) return <View className='empty'>正在核验并加载正式报告…</View>;
  const answers = Object.fromEntries(report.answers.map((answer) => [answer.itemKey, answer]));
  return <View className='page'><View className='report-cover'><Text className='eyebrow'>VEHICLE INSPECTION REPORT</Text><Text className='report-title'>{report.title}</Text><Text>{report.vehicle.brand} {report.vehicle.model} · {report.vehicle.plate}</Text><View className='report-no'>报告编号：{report.reportNo} · V{report.versionNumber}.0</View></View>{(report.alerts.accident || report.alerts.water || report.alerts.fire) && <View className='alert'>{report.alerts.accident ? '事故车提示 ' : ''}{report.alerts.water ? '泡水车提示 ' : ''}{report.alerts.fire ? '火烧车提示' : ''}，请结合检测明细复核。</View>}<View className='report-section'><Text className='report-section-title'>签发与车辆信息</Text><View className='report-line'><Text className='report-line-label'>签发机构</Text><Text className='report-line-value'>{report.organization.name}</Text></View><View className='report-line'><Text className='report-line-label'>标准版本</Text><Text className='report-line-value'>{report.template.standardTitle} {report.template.standardVersion}</Text></View><View className='report-line'><Text className='report-line-label'>检测师 / 审核人</Text><Text className='report-line-value'>{report.inspectorName} / {report.reviewerName}</Text></View><View className='report-line'><Text className='report-line-label'>车架号</Text><Text className='report-line-value'>{report.vehicle.vin}</Text></View><View className='report-line'><Text className='report-line-label'>表显里程</Text><Text className='report-line-value'>{report.vehicle.mileage ?? '未登记'} 公里</Text></View></View>{report.template.sections.map((section) => <View className='report-section' key={section.key}><Text className='report-section-title'>{section.title}</Text>{section.items.map((item) => <View className='report-line' key={item.key}><Text className='report-line-label'>{item.title}</Text><Text className={`report-line-value ${answers[item.key]?.value === '正常' ? 'normal-text' : 'abnormal-text'}`}>{answers[item.key]?.value || '未检查'}{answers[item.key]?.size ? ` · ${answers[item.key].size === 'GREATER_THAN_30' ? '大于' : '小于'}30cm×30cm` : ''}</Text></View>)}</View>)}<View className='notice'>{report.disclaimer}</View>{orderId && <Button className='primary full-button' onClick={share}>创建并复制只读分享链接</Button>}{isAdmin && internal?.shares.length ? <View className='card'><Text className='card-title'>分享管理</Text>{internal.shares.map((share) => <View className='row' key={share.id}><Text className='card-desc'>{share.status === 'ACTIVE' ? `有效至 ${new Date(share.expiresAt).toLocaleDateString('zh-CN')}` : '已撤销'}</Text>{share.status === 'ACTIVE' && <Button className='danger' onClick={() => revoke(share.id)}>撤销</Button>}</View>)}</View> : null}</View>;
}
