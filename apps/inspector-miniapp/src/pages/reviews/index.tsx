import { useState } from 'react';
import { Text, View } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { request, requireLogin, showError } from '../../api';
import { OrderCards } from '../../components/OrderCards';
import type { Order, User } from '../../types';

export default function ReviewsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User>();
  useDidShow(() => { if (requireLogin()) Promise.all([request<Order[]>('/api/v1/reviews'), request<User>('/api/v1/auth/me')]).then(([result, me]) => { setOrders(result); setUser(me); }).catch(showError); });
  return <View className='page page-with-tab'><Text className='eyebrow'>QUALITY REVIEW</Text><Text className='page-title'>{user?.role === 'ORG_ADMIN' ? '审核中心' : '审核进度'}</Text><Text className='page-desc'>{user?.role === 'ORG_ADMIN' ? '复核检测明细和照片，签发正式报告。' : '查看机构审核状态与退回意见。'}</Text><OrderCards orders={orders} review /></View>;
}
