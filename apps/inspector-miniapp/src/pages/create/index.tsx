import { useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import type { PackageCode, StandardCode } from '@jianjian/contracts';
import { request, showError } from '../../api';
import type { Order } from '../../types';

interface Summary { packageCode: PackageCode; packageName: string; available: boolean; unavailableReason?: string; templateRevisionId?: string; sectionCount: number; itemCount: number }

export default function CreatePage() {
  const router = useRouter();
  const standard = router.params.standard as StandardCode | undefined;
  const [templates, setTemplates] = useState<Summary[]>([]);
  const [creating, setCreating] = useState('');
  useEffect(() => { if (standard) request<Summary[]>(`/api/v1/templates?standard=${standard}`).then(setTemplates).catch(showError); }, [standard]);
  async function create(template: Summary) {
    if (!template.templateRevisionId) return;
    setCreating(template.packageCode);
    try {
      const order = await request<Order>('/api/v1/orders', 'POST', { kind: 'PASSENGER_CAR', templateRevisionId: template.templateRevisionId }, { 'Idempotency-Key': `${Date.now()}-${Math.random().toString(36).slice(2)}` });
      Taro.redirectTo({ url: `/pages/inspection/index?orderId=${order.id}` });
    } catch (cause) { showError(cause); setCreating(''); }
  }
  if (!standard) return <View className='page'><Text className='eyebrow'>STEP 01 / 选择标准</Text><Text className='page-title'>本次检测采用哪套标准？</Text><Text className='page-desc'>选择后进入检测类型页面，不使用弹窗确认方案。</Text><View className='card' onClick={() => Taro.navigateTo({ url: '/pages/create/index?standard=NATIONAL' })}><Text className='eyebrow'>NATIONAL STANDARD</Text><Text className='card-title'>按国家标准配置的检测模板</Text><Text className='card-desc'>国标重大事故专属清单 · 4 种检测类型</Text><Text className='card-meta'>选择国标 →</Text></View><View className='card' onClick={() => Taro.navigateTo({ url: '/pages/create/index?standard=GROUP' })}><Text className='eyebrow'>GROUP STANDARD</Text><Text className='card-title'>按团体标准配置的检测模板</Text><Text className='card-desc'>团标重大事故清单 · 4 种检测类型</Text><Text className='card-meta'>选择团标 →</Text></View></View>;
  return <View className='page'><Text className='eyebrow'>STEP 02 / {standard === 'NATIONAL' ? '国家标准' : '团体标准'}</Text><Text className='page-title'>选择检测类型</Text><Text className='page-desc'>选择后立即创建订单并开始检测，创建时锁定当前模板版本。</Text>{templates.map((template) => <Button key={template.packageCode} className='card' disabled={!template.available || Boolean(creating)} onClick={() => create(template)}><Text className='card-title'>{template.packageName}</Text><Text className='card-desc'>{template.available ? `${template.sectionCount} 个检测模块 · ${template.itemCount} 个检测项目` : template.unavailableReason}</Text><Text className='card-meta'>{creating === template.packageCode ? '正在创建…' : template.available ? '立即开始 →' : '暂不可用'}</Text></Button>)}</View>;
}
