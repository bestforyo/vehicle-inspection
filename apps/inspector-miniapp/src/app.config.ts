export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/orders/index',
    'pages/reviews/index',
    'pages/reviews/detail/index',
    'pages/my/index',
    'pages/login/index',
    'pages/create/index',
    'pages/inspection/index',
    'pages/vehicle/index',
    'pages/report/index',
    'pages/settings/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#172E39',
    navigationBarTitleText: '鉴见检测',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F7F5',
  },
  tabBar: {
    color: '#8D999C',
    selectedColor: '#376D57',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/orders/index', text: '订单' },
      { pagePath: 'pages/reviews/index', text: '审核' },
      { pagePath: 'pages/my/index', text: '我的' },
    ],
  },
});
