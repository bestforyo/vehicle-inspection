import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { ErrorMessage } from '../components/Common';
import { LoadingPage, PageHeader } from '../components/Layout';
import type { Order } from '../types';

export function VehiclePage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api<Order>(`/api/v1/orders/${orderId}`).then(setOrder); }, [orderId]);
  if (!order) return <LoadingPage />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api(`/api/v1/orders/${orderId}/vehicle`, { method: 'PATCH', body: JSON.stringify({
        plate: data.get('plate'), vin: data.get('vin'), brand: data.get('brand'), model: data.get('model'),
        year: Number(data.get('year')) || undefined, mileage: Number(data.get('mileage')) || 0,
        firstRegisteredAt: data.get('firstRegisteredAt') || undefined,
      }) });
      navigate(`/orders/${orderId}/inspect`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败。');
    } finally { setSaving(false); }
  }
  return <div className="page narrow-page"><Link to={`/orders/${orderId}/inspect`} className="back-link"><ArrowLeft size={17} />返回检测订单</Link><PageHeader eyebrow="VEHICLE PROFILE / 车辆档案" title="维护车辆资料" description="车辆资料独立于逐项检测章节保存，审核中或发布后不可直接修改。" />
    <form className="vehicle-form surface-card" onSubmit={submit}>{error && <ErrorMessage message={error} />}<div className="form-grid">
      <label>车牌号码<input name="plate" defaultValue={order.vehicle.plate} placeholder="例如：沪A12345" /></label>
      <label>车架号 VIN<input name="vin" defaultValue={order.vehicle.vin} minLength={17} maxLength={17} placeholder="17位车架号" /></label>
      <label>品牌<input name="brand" defaultValue={order.vehicle.brand} placeholder="例如：奥迪" /></label>
      <label>车型<input name="model" defaultValue={order.vehicle.model} placeholder="例如：A4L 2022款" /></label>
      <label>款型年份<input name="year" type="number" min="1950" max="2100" defaultValue={order.vehicle.year} /></label>
      <label>表显里程（公里）<input name="mileage" type="number" min="0" defaultValue={order.vehicle.mileage} /></label>
      <label>首次上牌日期<input name="firstRegisteredAt" type="date" defaultValue={order.vehicle.firstRegisteredAt?.slice(0, 10)} /></label>
    </div><div className="form-actions"><Link className="secondary-button" to={`/orders/${orderId}/inspect`}>取消</Link><button className="primary-button" disabled={saving}><Save size={17} />{saving ? '保存中…' : '保存车辆资料'}</button></div></form>
  </div>;
}
