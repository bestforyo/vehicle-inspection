import { useEffect, useState } from 'react';
import { ArrowRight, CarFront, CheckCircle2, ClipboardList, Clock3, FileSearch, Gauge, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { EmptyState, OrderCard } from '../components/Common';
import { PageHeader } from '../components/Layout';
import type { Order } from '../types';

export function HomePage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  useEffect(() => { api<{ items: Order[] }>('/api/v1/orders').then((result) => setOrders(result.items)).catch(() => undefined); }, []);
  const inspecting = orders.filter((order) => ['INSPECTING', 'NEEDS_MODIFICATION'].includes(order.status)).length;
  const pending = orders.filter((order) => order.status === 'REVIEW_PENDING').length;
  const published = orders.filter((order) => order.status === 'PUBLISHED').length;
  return <div className="page home-page">
    <PageHeader eyebrow="OVERVIEW / 工作概览" title={`${user?.displayName}，欢迎回来`} description="从现场每一处检查开始，完成可信赖的车辆档案。" />
    <section className="welcome-banner">
      <div><span className="eyebrow">TODAY'S INSPECTION</span><h2>专业检测，清晰留痕</h2><p>标准化流程 · 现场影像 · 机构复核 · 报告分享</p><Link to="/create" className="accent-button">开始新检测<ArrowRight size={18} /></Link></div>
      <div className="banner-graphic"><span className="orbit-ring" /><CarFront strokeWidth={1} size={142} /><span className="graphic-label">EVERY DETAIL MATTERS</span></div>
    </section>
    <section className="metric-grid">
      <div className="metric-card"><span className="metric-icon green"><ClipboardList size={20} /></span><div><strong>{orders.length}</strong><span>全部订单</span></div></div>
      <div className="metric-card"><span className="metric-icon amber"><Clock3 size={20} /></span><div><strong>{inspecting}</strong><span>待继续检测</span></div></div>
      <div className="metric-card"><span className="metric-icon blue"><FileSearch size={20} /></span><div><strong>{pending}</strong><span>审核中</span></div></div>
      <div className="metric-card"><span className="metric-icon mint"><CheckCircle2 size={20} /></span><div><strong>{published}</strong><span>已完成</span></div></div>
    </section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">NEW INSPECTION</span><h2>选择检测车辆</h2></div><span className="section-note">按实际车辆类型进入对应流程</span></div>
      <div className="vehicle-entry-grid">
        <Link to="/create" className="vehicle-entry passenger"><span className="entry-icon"><CarFront size={43} strokeWidth={1.4} /></span><div><span className="entry-tag">已开放</span><h3>乘用车检测</h3><p>国标 / 团标 · 三非 / 四非 / 整车 / 新车</p></div><ArrowRight size={22} /></Link>
        <button className="vehicle-entry motorcycle" disabled><span className="entry-icon"><Gauge size={43} strokeWidth={1.4} /></span><div><span className="entry-tag">建设中</span><h3>摩托车检测</h3><p>正在建设中，敬请期待</p></div><Clock3 size={21} /></button>
      </div>
    </section>
    <section className="query-card"><span className="query-icon"><Search size={24} /></span><div><h3>车辆信息查询</h3><p>通过车架号或车牌辅助核对车辆资料</p></div><button className="secondary-button" onClick={() => setLookupOpen(!lookupOpen)}>进入查询<ArrowRight size={16} /></button>{lookupOpen && <div className="inline-notice">第三方车辆查询接口尚未配置，当前不会发起请求或返回虚构结果。</div>}</section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">RECENT ORDERS</span><h2>最近订单</h2></div><Link to="/orders" className="text-link">全部订单<ArrowRight size={15} /></Link></div>
      {orders.length ? <div className="order-grid">{orders.slice(0, 3).map((order) => <OrderCard key={order.id} order={order} />)}</div> : <EmptyState title="还没有检测订单" description="选择乘用车检测，创建你的第一份检测档案。" />}
    </section>
    <div className="trust-note"><ShieldCheck size={17} />现场数据仅所属机构授权成员可见，正式报告经审核后发布。</div>
  </div>;
}
