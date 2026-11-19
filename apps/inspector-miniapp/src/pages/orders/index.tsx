import { useState } from 'react';
import { Text, View } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { request, requireLogin, showError } from '../../api';
import { OrderCards } from '../../components/OrderCards';
import type { Order } from '../../types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  useDidShow(() => { if (requireLogin()) request<{ items: Order[] }>('/api/v1/orders').then((result) => setOrders(result.items)).catch(showError); });
  return <View className='page page-with-tab'><Text className='eyebrow'>INSPECTION ORDERS</Text><Text className='page-title'>检测订单</Text><Text className='page-desc'>继续现场检测或查看已提交版本。</Text><OrderCards orders={orders} /></View>;
}
