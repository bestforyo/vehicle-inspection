import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@jianjian/contracts';
import { api } from '../api';
import { EmptyState, OrderCard } from '../components/Common';
import { LoadingPage, PageHeader } from '../components/Layout';
import type { Order } from '../types';

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  useEffect(() => { api<{ items: Order[] }>('/api/v1/orders').then((result) => setOrders(result.items)).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => orders.filter((order) => (filter === 'ALL' || order.status === filter) && `${order.orderNo}${order.vehicle.plate}${order.vehicle.brand}${order.vehicle.model}`.toLowerCase().includes(query.toLowerCase())), [orders, filter, query]);
  if (loading) return <LoadingPage />;
  return <div className="page"><PageHeader eyebrow="ORDERS / 检测管理" title="检测订单" description="查看检测进度，继续未完成的现场工作。" action={<Link to="/create" className="primary-button"><Plus size={17} />新建检测</Link>} />
    <div className="list-toolbar"><div className="filter-tabs">{['ALL', 'INSPECTING', 'REVIEW_PENDING', 'NEEDS_MODIFICATION', 'PUBLISHED'].map((status) => <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'ALL' ? '全部' : ORDER_STATUS_LABELS[status as OrderStatus]}</button>)}</div><label className="search-field"><Search size={17} /><input placeholder="搜索订单、车牌或车型" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
    {filtered.length ? <div className="order-grid order-list-grid">{filtered.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <EmptyState title="没有匹配的订单" description="调整筛选条件，或创建一份新的检测订单。" />}
  </div>;
}
