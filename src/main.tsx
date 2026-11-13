import { createRoot } from 'react-dom/client';
import './styles/global.scss';
import 'react-toastify/dist/ReactToastify.css';
import { AppRoutes } from './app/routing/AppRoutes';
import { ToastContainer } from 'react-toastify';
import { hideSplashScreen } from './utils/hideSplashScreen';
import { runWhenIdle } from './utils/deferNonCritical';
import { AuthProvider } from './context/AuthContext';
import { GoogleLoginModal } from './app/modules/auth/components/GoogleLoginModal';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <AuthProvider>
      <ToastContainer />
      <AppRoutes />
      <GoogleLoginModal />
    </AuthProvider>
  );

  runWhenIdle(() => {
    void import('./services/AnalyticsService').then(({ AnalyticsService }) => {
      AnalyticsService.initialize();
      if (import.meta.env.DEV) {
        (window as Window & { AnalyticsService?: typeof AnalyticsService }).AnalyticsService =
          AnalyticsService;
      }
    });
    void import('@vercel/speed-insights').then(({ injectSpeedInsights }) => {
      injectSpeedInsights();
    });
  }, 3000);
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    runWhenIdle(() => hideSplashScreen(), 4000);
  });
}
