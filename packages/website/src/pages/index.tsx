import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className={styles.heroBackground}>
        <div className={styles.heroPattern}></div>
        <div className={styles.heroGradient}></div>
      </div>
      <div className="container">
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              <span className={styles.heroTitleMain}>Your Digital Signage</span>
              <span className={styles.heroTitleAccent}>Partner</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Open source solution for creating, managing and deploying 
              digital signage content across any device or platform
            </p>
            <div className={styles.heroStats}>
              <div className={styles.stat}>
                <div className={styles.statNumber}>100%</div>
                <div className={styles.statLabel}>Open Source</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statNumber}>5+</div>
                <div className={styles.statLabel}>Platforms</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statNumber}>∞</div>
                <div className={styles.statLabel}>Possibilities</div>
              </div>
            </div>
          </div>
          <div className={styles.heroActions}>
            <Link
              className={clsx('button', 'button--primary', 'button--lg', styles.heroButton, styles.heroPrimaryButton)}
              to="/docs/intro">
              Get Started →
            </Link>
            <Link
              className={clsx('button', 'button--secondary', 'button--lg', styles.heroButton, styles.heroSecondaryButton)}
              href="https://github.com/castmill/castmill">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="currentColor"
                style={{ marginRight: '8px' }}
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub
            </Link>
          </div>
        </div>
      </div>
      <div className={styles.heroScroll}>
        <div className={styles.scrollIndicator}>
          <span>Scroll to explore</span>
          <div className={styles.scrollArrow}>↓</div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Your Digital Signage Partner`}
      description="Open source solution for creating, managing and deploying digital signage content across any device or platform">
      <Head>
        <meta property="og:image" content="/img/social/home.jpg" />
        <meta name="twitter:image" content="/img/social/home.jpg" />
      </Head>
      <main className={styles.main}>
        <HomepageHeader />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
