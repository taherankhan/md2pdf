import { FC, useLayoutEffect, useState } from 'react';
import LandingHeader from './LandingHeader';
import { hideSplashScreen } from '../../../utils/hideSplashScreen';
import LandingBackground from './components/LandingBackground';
import HeroSection from './sections/HeroSection';
import FeaturesSection from './sections/FeaturesSection';
import MermaidShowcaseSection from './sections/MermaidShowcaseSection';
import PageSetupSection from './sections/PageSetupSection';
import CloudSyncSection from './sections/CloudSyncSection';
import ComparisonSection from './sections/ComparisonSection';
import WorkflowSection from './sections/WorkflowSection';
import UseCasesSection from './sections/UseCasesSection';
import ThemesSection from './sections/ThemesSection';
import FaqSection from './sections/FaqSection';
import LandingFooter from './sections/LandingFooter';
import { THEMES } from './landingData';
import { useScrollReveal } from './hooks/useScrollReveal';
import { useLandingBodyTheme } from './hooks/useLandingBodyTheme';
import './LandingPage.css';
import './LandingSections.css';

const LandingPage: FC = () => {
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);

  useLayoutEffect(() => {
    hideSplashScreen();
  }, []);

  useLandingBodyTheme();
  useScrollReveal();

  return (
    <div className="lp-root app-container">
      <LandingBackground />
      <LandingHeader />

      <HeroSection selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} />
      <FeaturesSection />

      <div className="lp-divider" />
      <MermaidShowcaseSection />

      <div className="lp-divider" />
      <PageSetupSection />

      <div className="lp-divider" />
      <CloudSyncSection />

      <div className="lp-divider" />
      <ComparisonSection />

      <div className="lp-divider" />
      <WorkflowSection />

      <div className="lp-divider" />
      <UseCasesSection />

      <div className="lp-divider" />
      <ThemesSection selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} />

      <div className="lp-divider" />
      <FaqSection />

      <div className="lp-divider" />
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
