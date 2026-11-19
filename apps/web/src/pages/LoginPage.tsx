import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ErrorMessage } from '../components/Common';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('platform@demo.jianjian.cn');
  const [password, setPassword] = useState('Platform123!');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败。');
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="login-page">
    <section className="login-story">
      <div className="login-brand"><span className="brand-mark">鉴</span><span><strong>鉴见</strong><small>INSPECTION STUDIO</small></span></div>
      <div className="story-copy"><span className="eyebrow">PROFESSIONAL VEHICLE INSPECTION</span><h1>每一处细节，<br />都有据可循。</h1><p>连接现场检测、机构复核与正式报告，让专业判断清晰留痕。</p></div>
      <div className="story-points"><span><CheckCircle2 size={17} />动态检测模板</span><span><ShieldCheck size={17} />多租户数据隔离</span><span><LockKeyhole size={17} />审核版本不可篡改</span></div>
      <div className="story-orbit orbit-one" /><div className="story-orbit orbit-two" />
    </section>
    <section className="login-form-panel">
      <form onSubmit={submit} className="login-form">
        <span className="eyebrow">PLATFORM OPERATIONS</span><h2>平台运营后台</h2><p>仅限平台运营和平台超级管理员登录</p>
        {error && <ErrorMessage message={error} />}
        <label>工作账号<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>登录密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="primary-button login-button" disabled={submitting}>{submitting ? '正在登录…' : <>进入工作台<ArrowRight size={18} /></>}</button>
        <div className="demo-accounts"><strong>平台运营演示账号</strong><button type="button" onClick={() => { setEmail('platform@demo.jianjian.cn'); setPassword('Platform123!'); }}>平台运营</button><small>检测师和机构管理员请使用微信小程序。演示数据均为虚构。</small></div>
      </form>
    </section>
  </main>;
}
