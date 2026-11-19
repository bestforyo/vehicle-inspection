import { useEffect, useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { request, showError } from '../../api';
import type { Order } from '../../types';

export default function VehiclePage() {
  const router = useRouter();
  const orderId = router.params.orderId ?? '';
  const [order, setOrder] = useState<Order>();
  const [form, setForm] = useState({ plate: '', vin: '', brand: '', model: '', year: '', mileage: '', firstRegisteredAt: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { request<Order>(`/api/v1/orders/${orderId}`).then((result) => { setOrder(result); setForm({ plate: result.vehicle.plate, vin: result.vehicle.vin, brand: result.vehicle.brand, model: result.vehicle.model, year: result.vehicle.year?.toString() ?? '', mileage: result.vehicle.mileage?.toString() ?? '', firstRegisteredAt: result.vehicle.firstRegisteredAt?.slice(0, 10) ?? '' }); }).catch(showError); }, [orderId]);
  function field(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function save() {
    setSaving(true);
    try { await request(`/api/v1/orders/${orderId}/vehicle`, 'PATCH', { ...form, year: Number(form.year) || undefined, mileage: Number(form.mileage) || 0 }); Taro.showToast({ title: '车辆资料已保存', icon: 'success' }); setTimeout(() => Taro.navigateBack(), 600); } catch (cause) { showError(cause); } finally { setSaving(false); }
  }
  if (!order) return <View className='empty'>正在加载车辆资料…</View>;
  return <View className='page'><Text className='eyebrow'>VEHICLE PROFILE</Text><Text className='page-title'>车辆资料</Text><Text className='page-desc'>车辆信息独立于逐项检测章节维护。</Text>{([['plate', '车牌号码'], ['vin', '车架号 VIN'], ['brand', '品牌'], ['model', '车型'], ['year', '款型年份'], ['mileage', '表显里程（公里）'], ['firstRegisteredAt', '首次上牌日期']] as const).map(([key, label]) => <View className='form-field' key={key}><Text className='form-label'>{label}</Text><Input className='input' value={form[key]} placeholder={`请输入${label}`} onInput={(event) => field(key, event.detail.value)} /></View>)}<Button className='primary full-button' loading={saving} onClick={save}>保存车辆资料</Button></View>;
}
