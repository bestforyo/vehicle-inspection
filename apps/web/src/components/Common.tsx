import { AlertCircle, CheckCircle2, ChevronRight, Clock3, LoaderCircle, RotateCcw, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@jianjian/contracts';
import type { Order } from '../types';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const icons = {
    PENDING_INSPECTION: Clock3,
    INSPECTING: Clock3,
    REVIEW_PENDING: LoaderCircle,
    NEEDS_MODIFICATION: RotateCcw,
    PUBLISHED: CheckCircle2,
    CANCELLED: XCircle,
  };
  const Icon = icons[status];
  return <span className={`status-badge status-${status.toLowerCase()}`}><Icon size={14} />{ORDER_STATUS_LABELS[status]}</span>;
}

export function OrderCard({ order }: { order: Order }) {
  const target = order.status === 'PUBLISHED' ? `/reports?orderId=${order.id}` : order.status === 'REVIEW_PENDING' ? `/reviews/${order.id}` : `/orders/${order.id}/inspect`;
  return <Link to={target} className="order-card">
    <div className="order-card-top"><span className="order-number">{order.orderNo}</span><StatusBadge status={order.status} /></div>
    <div className="order-main"><div className="car-symbol">{order.vehicle.kind === 'MOTORCYCLE' ? '摩' : '车'}</div><div><h3>{order.vehicle.brand || '待完善车辆'} {order.vehicle.model}</h3><p>{order.vehicle.plate || '未登记车牌'} · {order.standard === 'NATIONAL' ? '国标' : '团标'} / {order.packageName}</p></div></div>
    <div className="order-card-foot"><span>{new Date(order.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><span>{order.status === 'INSPECTING' || order.status === 'NEEDS_MODIFICATION' ? '继续检测' : '查看详情'}<ChevronRight size={15} /></span></div>
  </Link>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><AlertCircle size={28} /><h3>{title}</h3><p>{description}</p></div>;
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="error-message" role="alert"><AlertCircle size={18} /><span>{message}</span></div>;
}
