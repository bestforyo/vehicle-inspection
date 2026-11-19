import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { request, requireLogin, showError } from '../../api';
import { OrderCards } from '../../components/OrderCards';
import type { Order, User } from '../../types';

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User>();
  useDidShow(() => {
    if (!requireLogin()) return;
    Promise.all([request<{ items: Order[] }>('/api/v1/orders'), request<User>('/api/v1/auth/me')]).then(([result, me]) => { setOrders(result.items); setUser(me); }).catch(showError);
  });
  return <View className='page page-with-tab'>
    <View className='brand-row'><View className='brand-mark'>鉴</View><View><Text className='brand-name'>鉴见</Text><Text className='brand-en'>INSPECTION STUDIO</Text></View></View>
    <View className='hero'><Text className='eyebrow'>PROFESSIONAL INSPECTION</Text><Text className='hero-title'>{user?.displayName || '检测师'}，欢迎回来</Text><Text className='hero-desc'>每一处细节，都有据可循。</Text><Button className='secondary full-button' onClick={() => Taro.navigateTo({ url: '/pages/create/index' })}>开始新检测 →</Button></View>
    <View className='metric-grid'><View className='metric'><Text className='metric-value'>{orders.length}</Text><Text className='metric-label'>全部订单</Text></View><View className='metric'><Text className='metric-value'>{orders.filter((order) => order.status === 'INSPECTING').length}</Text><Text className='metric-label'>检测中</Text></View><View className='metric'><Text className='metric-value'>{orders.filter((order) => order.status === 'PUBLISHED').length}</Text><Text className='metric-label'>已完成</Text></View></View>
    <View className='entry' onClick={() => Taro.navigateTo({ url: '/pages/create/index' })}><View><Text className='entry-title'>乘用车检测</Text><Text className='entry-desc'>国标 / 团标 · 四种检测类型</Text></View><Text>→</Text></View>
    <View className='entry disabled'><View><Text className='entry-title'>摩托车检测</Text><Text className='entry-desc'>正在建设中，敬请期待</Text></View><Text>·</Text></View>
    <View className='card' onClick={() => Taro.showToast({ title: '第三方查询接口尚未配置', icon: 'none' })}><Text className='card-title'>车辆信息查询</Text><Text className='card-desc'>车架号 / 车牌号辅助核验 · 接口未配置</Text></View>
    <View className='section-title page-desc' style={{ marginTop: '36px' }}>最近订单</View><OrderCards orders={orders.slice(0, 3)} />
  </View>;
}
