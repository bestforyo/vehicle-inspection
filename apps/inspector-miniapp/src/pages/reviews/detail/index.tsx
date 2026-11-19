import { useCallback, useEffect, useState } from 'react';
import { Button, Text, Textarea, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { request, showError } from '../../../api';
import type { Inspection, Order, User } from '../../../types';

export default function ReviewDetailPage() {
  const router = useRouter();
  const orderId = router.params.orderId ?? '';
  const [order, setOrder] = useState<Order>();
  const [inspection, setInspection] = useState<Inspection>();
  const [user, setUser] = useState<User>();
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const load = useCallback(() => { Promise.all([request<Order>(`/api/v1/orders/${orderId}`), request<Inspection>(`/api/v1/orders/${orderId}/inspection/current`), request<User>('/api/v1/auth/me')]).then(([orderData, inspectionData, me]) => { setOrder(orderData); setInspection(inspectionData); setUser(me); }).catch(showError); }, [orderId]);
  useEffect(() => { load(); }, [load]);
  async function decide(action: 'approve' | 'return') {
    if (action === 'return' && !comment.trim()) { Taro.showToast({ title: '请填写退回意见', icon: 'none' }); return; }
    const choice = await Taro.showModal({ title: action === 'approve' ? '审核通过并发布' : '退回检测版本', content: action === 'approve' ? '发布后将生成不可变正式报告，是否继续？' : '检测师将看到退回意见并创建新修订。' });
    if (!choice.confirm) return;
    setProcessing(true);
    try { await request(`/api/v1/orders/${orderId}/reviews/${inspection?.id}/${action}`, 'POST', action === 'return' ? { comment } : {}); Taro.showToast({ title: action === 'approve' ? '报告已发布' : '已退回', icon: 'success' }); setTimeout(() => Taro.switchTab({ url: '/pages/reviews/index' }), 700); } catch (cause) { showError(cause); } finally { setProcessing(false); }
  }
  if (!order || !inspection) return <View className='empty'>正在加载审核版本…</View>;
  const answerMap = Object.fromEntries(inspection.answers.map((answer) => [answer.itemKey, answer]));
  return <View className='page'><Text className='eyebrow'>{order.orderNo} / V{inspection.revisionNumber}</Text><Text className='page-title'>{order.packageName}审核</Text><Text className='page-desc'>{order.vehicle.brand} {order.vehicle.model} · {order.vehicle.plate}</Text><View className='notice'>当前为只读提交版本，共 {inspection.answers.length} 项结果、{inspection.evidence.length} 张照片。审核人不能是提交人本人。</View>{inspection.template.sections.map((section) => <View className='report-section' key={section.key}><Text className='report-section-title'>{section.title}</Text>{section.items.map((item) => <View className='report-line' key={item.key}><Text className='report-line-label'>{item.title}</Text><Text className={`report-line-value ${answerMap[item.key]?.value === '正常' ? 'normal-text' : 'abnormal-text'}`}>{answerMap[item.key]?.value || '未检查'}{answerMap[item.key]?.size ? ` · ${answerMap[item.key].size === 'GREATER_THAN_30' ? '大于' : '小于'}30cm×30cm` : ''}</Text></View>)}</View>)}{user?.role === 'ORG_ADMIN' && order.status === 'REVIEW_PENDING' && <View className='card'><Text className='card-title'>机构审核决定</Text><Textarea className='textarea' value={comment} placeholder='退回原因（退回时必填）' onInput={(event) => setComment(event.detail.value)} /><Button className='danger full-button' disabled={processing} onClick={() => decide('return')}>填写意见并退回</Button><Button className='primary full-button' loading={processing} onClick={() => decide('approve')}>审核通过并发布</Button></View>}</View>;
}
