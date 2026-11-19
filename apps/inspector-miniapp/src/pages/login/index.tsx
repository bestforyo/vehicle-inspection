import { useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { request, saveSession, showError } from '../../api';

export default function LoginPage() {
  const [email, setEmail] = useState('inspector@demo.jianjian.cn');
  const [password, setPassword] = useState('Inspector123!');
  const [loading, setLoading] = useState(false);
  async function finish(path: string, data?: unknown) {
    setLoading(true);
    try {
      const result = await request<{ accessToken: string; refreshToken: string }>(path, 'POST', data);
      saveSession(result.accessToken, result.refreshToken);
      Taro.reLaunch({ url: '/pages/home/index' });
    } catch (cause) { showError(cause); } finally { setLoading(false); }
  }
  async function wechat() {
    try {
      const result = await Taro.login();
      if (!result.code) throw new Error('未获得微信登录凭据');
      await finish('/api/v1/auth/wechat/session', { code: result.code });
    } catch (cause) { showError(cause); }
  }
  return <View className='page' style={{ paddingTop: '80px' }}><View className='brand-row'><View className='brand-mark'>鉴</View><View><Text className='brand-name'>鉴见</Text><Text className='brand-en'>INSPECTION STUDIO</Text></View></View><Text className='page-title'>检测师工作台</Text><Text className='page-desc'>专业检测，清晰留痕。登录后进入所属机构工作空间。</Text>
    <Button className='primary full-button' loading={loading} onClick={wechat}>微信一键登录</Button>
    <View className='notice'>微信账号须已由机构管理员关联。未配置正式小程序凭据时，可使用下方开发账号验证业务流程。</View>
    <View className='card'><Text className='card-title'>开发环境账号登录</Text><View className='form-field'><Text className='form-label'>工作账号</Text><Input className='input' value={email} onInput={(event) => setEmail(event.detail.value)} /></View><View className='form-field'><Text className='form-label'>密码</Text><Input className='input' password value={password} onInput={(event) => setPassword(event.detail.value)} /></View><Button className='secondary full-button' loading={loading} onClick={() => finish('/api/v1/auth/login', { email, password })}>登录工作台</Button></View>
  </View>;
}
