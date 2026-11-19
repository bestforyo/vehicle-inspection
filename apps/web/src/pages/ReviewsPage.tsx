import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { EmptyState, OrderCard } from '../components/Common';
import { LoadingPage, PageHeader } from '../components/Layout';
import type { Order } from '../types';

export function ReviewsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => { api<Order[]>('/api/v1/reviews').then(setOrders); }, []);
  if (!orders) return <LoadingPage />;
  const admin = user?.role === 'ORG_ADMIN';
  return <div className="page"><PageHeader eyebrow="REVIEW / 质量复核" title={admin ? '审核中心' : '审核进度'} description={admin ? '复核检测版本、异常项目与现场证据，完成报告签发。' : '查看已提交检测的审核状态和机构修改意见。'} />
    <div className="review-summary"><span><ClipboardCheck size={22} /></span><div><strong>{orders.filter((order) => order.status === 'REVIEW_PENDING').length} 份报告等待处理</strong><p>{admin ? '审核通过后将生成不可变正式报告，审核人不能是提交人本人。' : '待审核版本已锁定，退回后可根据意见创建修订版本。'}</p></div></div>
    {orders.length ? <div className="order-grid order-list-grid">{orders.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <EmptyState title="暂无审核记录" description="现场检测提交后，审核进度会显示在这里。" />}
  </div>;
}
