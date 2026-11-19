import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { clearSession, request, requireLogin, showError } from '../../api';
import type { User } from '../../types';

export default function MyPage() {
  const [user, setUser] = useState<User>();
  useDidShow(() => { if (requireLogin()) request<User>('/api/v1/auth/me').then(setUser).catch(showError); });
  async function linkWechat() {
    try {
      const login = await Taro.login();
      await request('/api/v1/auth/wechat/link', 'POST', { code: login.code });
      Taro.showToast({ title: '微信关联成功', icon: 'success' });
    } catch (cause) { showError(cause); }
  }
  return <View className='page page-with-tab'><Text className='eyebrow'>MY WORKSPACE</Text><Text className='page-title'>我的</Text><View className='hero'><Text className='hero-title'>{user?.displayName || '检测师'}</Text><Text className='hero-desc'>{user?.tenantName} · {user?.role === 'ORG_ADMIN' ? '机构管理员' : '检测师'}</Text></View><View className='card'><Text className='card-title'>历史报告</Text><Text className='card-desc'>查看正式报告并分享只读链接</Text></View><View className='card'><Text className='card-title'>账号与数据安全</Text><Text className='card-desc'>会话由服务端验证，机构数据按权限隔离</Text></View>{user?.role === 'ORG_ADMIN' && <Button className='primary full-button' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>机构管理</Button>}<Button className='secondary full-button' onClick={linkWechat}>关联当前微信账号</Button><Button className='danger full-button' onClick={() => { clearSession(); Taro.reLaunch({ url: '/pages/login/index' }); }}>退出当前账号</Button></View>;
}
