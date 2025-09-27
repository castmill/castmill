import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: React.JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Template-Based Widgets',
    icon: 'template',
    description: (
      <>
        Create stunning digital signage content without coding. Use our flexible 
        template system to build widgets for any use case - from menu boards to 
        real estate displays.
      </>
    ),
  },
  {
    title: 'Multi-Platform Player',
    icon: 'devices',
    description: (
      <>
        Deploy anywhere with our lightweight HTML5 player. Works on web browsers, 
        embedded devices, Android, webOS TVs, and Electron desktop applications.
      </>
    ),
  },
  {
    title: 'Enterprise-Ready Architecture',
    icon: 'enterprise',
    description: (
      <>
        Built for reliability with offline operation, low memory usage, and 
        modular design. Includes dashboard, player, server, and device management.
      </>
    ),
  },
];

function Feature({ title, icon, description }: FeatureItem) {
  const iconMap = {
    template: (
      <svg
        className={styles.featureSvg}
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="20" y="20" width="160" height="120" rx="12" stroke="currentColor" strokeWidth="3" fill="none"/>
        <rect x="30" y="30" width="50" height="30" rx="6" fill="currentColor" opacity="0.3"/>
        <rect x="90" y="30" width="80" height="8" rx="4" fill="currentColor" opacity="0.2"/>
        <rect x="90" y="45" width="60" height="8" rx="4" fill="currentColor" opacity="0.2"/>
        <rect x="30" y="70" width="140" height="8" rx="4" fill="currentColor" opacity="0.2"/>
        <rect x="30" y="85" width="100" height="8" rx="4" fill="currentColor" opacity="0.2"/>
        <rect x="30" y="100" width="120" height="8" rx="4" fill="currentColor" opacity="0.2"/>
        <circle cx="100" cy="165" r="8" fill="currentColor" opacity="0.4"/>
        <circle cx="120" cy="165" r="8" fill="currentColor" opacity="0.2"/>
        <circle cx="80" cy="165" r="8" fill="currentColor" opacity="0.2"/>
      </svg>
    ),
    devices: (
      <svg
        className={styles.featureSvg}
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="30" y="40" width="80" height="50" rx="6" stroke="currentColor" strokeWidth="3" fill="none"/>
        <rect x="60" y="90" width="20" height="8" fill="currentColor"/>
        <rect x="50" y="98" width="40" height="4" rx="2" fill="currentColor"/>
        <rect x="130" y="30" width="40" height="60" rx="8" stroke="currentColor" strokeWidth="3" fill="none"/>
        <circle cx="150" cy="82" r="3" fill="currentColor"/>
        <rect x="90" y="120" width="25" height="45" rx="6" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <circle cx="102.5" cy="158" r="2" fill="currentColor"/>
        <rect x="130" y="115" width="50" height="35" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
        <rect x="148" y="150" width="14" height="6" fill="currentColor"/>
        <rect x="140" y="156" width="30" height="3" rx="1.5" fill="currentColor"/>
        <path d="M70 65 Q100 75 150 50" stroke="currentColor" strokeWidth="2" strokeDasharray="4,4" opacity="0.4" fill="none"/>
        <path d="M70 75 Q90 100 102 130" stroke="currentColor" strokeWidth="2" strokeDasharray="4,4" opacity="0.4" fill="none"/>
        <path d="M110 75 Q125 90 155 115" stroke="currentColor" strokeWidth="2" strokeDasharray="4,4" opacity="0.4" fill="none"/>
      </svg>
    ),
    enterprise: (
      <svg
        className={styles.featureSvg}
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="50" y="40" width="100" height="120" rx="8" stroke="currentColor" strokeWidth="3" fill="none"/>
        <rect x="60" y="55" width="80" height="15" rx="3" fill="currentColor" opacity="0.3"/>
        <rect x="60" y="75" width="80" height="15" rx="3" fill="currentColor" opacity="0.2"/>
        <rect x="60" y="95" width="80" height="15" rx="3" fill="currentColor" opacity="0.3"/>
        <rect x="60" y="115" width="80" height="15" rx="3" fill="currentColor" opacity="0.2"/>
        <rect x="60" y="135" width="80" height="15" rx="3" fill="currentColor" opacity="0.3"/>
        <circle cx="130" cy="62" r="2" fill="#22C55E"/>
        <circle cx="130" cy="82" r="2" fill="#22C55E"/>
        <circle cx="130" cy="102" r="2" fill="#EAB308"/>
        <circle cx="130" cy="122" r="2" fill="#22C55E"/>
        <circle cx="130" cy="142" r="2" fill="#22C55E"/>
        <circle cx="100" cy="25" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M92 17 Q100 10 108 17" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M88 13 Q100 3 112 13" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M30 80 Q30 70 40 70 Q50 70 50 80 L50 100 Q50 110 40 110 Q30 110 30 100 Z" fill="currentColor" opacity="0.4"/>
        <path d="M35 85 L38 88 L45 78" stroke="white" strokeWidth="2" fill="none"/>
      </svg>
    ),
  };

  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {iconMap[icon as keyof typeof iconMap]}
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): React.JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
