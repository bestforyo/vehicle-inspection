import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout, LoadingPage } from './components/Layout';
import { CreatePage } from './pages/CreatePage';
import { HomePage } from './pages/HomePage';
import { InspectionPage } from './pages/InspectionPage';
import { LoginPage } from './pages/LoginPage';
import { MyPage } from './pages/MyPage';
import { OrdersPage } from './pages/OrdersPage';
import { PlatformPage } from './pages/PlatformPage';
import { PublicReportPage } from './pages/PublicReportPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReviewDetailPage } from './pages/ReviewDetailPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SettingsPage } from './pages/SettingsPage';
import { VehiclePage } from './pages/VehiclePage';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.role.startsWith('PLATFORM')) {
    return <main className="miniapp-required"><span className="brand-mark">鉴</span><h1>请使用微信小程序</h1><p>{user.role === 'ORG_ADMIN' ? '机构管理员的机构管理、审核、模板和报告操作均在小程序内完成。' : '检测师的订单创建、现场检测、审核进度和报告分享均在小程序内完成。'}</p><small>Web 后台仅供平台运营使用；委托人可通过机构分享的只读链接查看报告。</small></main>;
  }
  return children;
}

function HomeRoute() {
  const { user } = useAuth();
  return user?.role.startsWith('PLATFORM') ? <Navigate to="/platform" replace /> : <HomePage />;
}

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/r/:token" element={<PublicReportPage />} />
    <Route element={<Protected><Layout /></Protected>}>
      <Route index element={<HomeRoute />} />
      <Route path="/platform" element={<PlatformPage />} />
      <Route path="/create" element={<CreatePage />} />
      <Route path="/create/:standard" element={<CreatePage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:orderId/inspect" element={<InspectionPage />} />
      <Route path="/orders/:orderId/vehicle" element={<VehiclePage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/reviews/:orderId" element={<ReviewDetailPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/reports/:reportId" element={<ReportDetailPage />} />
      <Route path="/my" element={<MyPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
