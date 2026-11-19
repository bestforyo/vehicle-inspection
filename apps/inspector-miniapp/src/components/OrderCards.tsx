import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { ORDER_STATUS_LABELS } from '@jianjian/contracts';
import type { Order } from '../types';

export function OrderCards({ orders, review = false }: { orders: Order[]; review?: boolean }) {
  if (!orders.length) return <View className='empty'>暂无相关订单，开始一次新的现场检测吧。</View>;
  return <View>{orders.map((order) => {
    const target = order.status === 'PUBLISHED' ? `/pages/report/index?orderId=${order.id}` : review || order.status === 'REVIEW_PENDING' ? `/pages/reviews/detail?orderId=${order.id}` : `/pages/inspection/index?orderId=${order.id}`;
    return <View className='order-card' key={order.id} onClick={() => Taro.navigateTo({ url: target })}><View className='row'><Text className='order-no'>{order.orderNo}</Text><Text className={`status ${order.status === 'REVIEW_PENDING' ? 'status-pending' : order.status === 'NEEDS_MODIFICATION' ? 'status-return' : ''}`}>{ORDER_STATUS_LABELS[order.status]}</Text></View><Text className='order-title'>{order.vehicle.brand || '待完善车辆'} {order.vehicle.model}</Text><Text className='order-info'>{order.vehicle.plate || '未登记车牌'} · {order.standard === 'NATIONAL' ? '国标' : '团标'} / {order.packageName}</Text><View className='card-meta'>{order.status === 'INSPECTING' || order.status === 'NEEDS_MODIFICATION' ? '继续检测 →' : '查看详情 →'}</View></View>;
  })}</View>;
}
