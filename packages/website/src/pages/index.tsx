import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Icon, { type IconName } from '@site/src/components/Icon';
import HomeShowcase from '@site/src/components/HomeShowcase';
import styles from './index.module.css';

interface Path {
  icon: IconName;
  title: string;
  description: string;
  href: string;
  cta: string;
}

const PATHS: Path[] = [
  {
    icon: 'monitor',
    title: 'Manage screens',
    description:
      'Upload media, build playlists and layouts, schedule channels and keep an eye on every device.',
    href: '/docs/dashboard/overview',
    cta: 'Open the user guide',
  },
  {
    icon: 'rocket',
    title: 'Install a player',
    description:
      'Turn a browser, Android device, LG webOS display or desktop computer into a Castmill screen.',
    href: '/docs/players/overview',
    cta: 'Choose a player',
  },
  {
    icon: 'server',
    title: 'Run your own server',
    description:
      'Deploy Castmill with Docker, configure storage and email, and manage networks, plans and quotas.',
    href: '/docs/administration/self-hosting',
    cta: 'Self-host Castmill',
  },
  {
    icon: 'code',
    title: 'Build on Castmill',
    description:
      'Write template widgets, push data through feeds, call the REST API or connect AI agents over MCP.',
    href: '/docs/developers/overview',
    cta: 'Read the developer guide',
  },
];

interface Feature {
  icon: IconName;
  title: string;
  description: string;
  href: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'playlist',
    title: 'Playlists and layouts',
    description:
      'Sequence images, video and widgets, or split the screen into zones that each run their own playlist.',
    href: '/docs/dashboard/playlists',
  },
  {
    icon: 'calendar',
    title: 'Scheduling',
    description:
      'Channels map playlists to a weekly calendar in the timezone of each location.',
    href: '/docs/dashboard/channels',
  },
  {
    icon: 'zap',
    title: 'Automations',
    description:
      'Interrupt normal programming at set times. Occurrences are synced ahead so they run offline.',
    href: '/docs/dashboard/automations',
  },
  {
    icon: 'widget',
    title: 'Template widgets',
    description:
      'Describe a widget in JSON with data bindings and animations. Weather, RSS, QR codes and more are built in.',
    href: '/docs/dashboard/widgets',
  },
  {
    icon: 'rss',
    title: 'Data feeds',
    description:
      'Push JSON from any system over a token-protected API and bind it to widgets on screen.',
    href: '/docs/dashboard/feeds',
  },
  {
    icon: 'wifiOff',
    title: 'Offline playback',
    description:
      'Players cache media, widgets and schedules locally and keep playing through network outages.',
    href: '/docs/players/offline-and-caching',
  },
  {
    icon: 'users',
    title: 'Teams and roles',
    description:
      'Seven organization roles, team grouping and passkey sign-in keep large deployments organized.',
    href: '/docs/concepts/users-and-teams',
  },
  {
    icon: 'bot',
    title: 'AI agents',
    description:
      'Give an assistant scoped, revocable access to an organization through the built-in MCP server.',
    href: '/docs/dashboard/ai-agents',
  },
];

const FLOW: { icon: IconName; title: string; text: string }[] = [
  { icon: 'image', title: 'Upload', text: 'Images, video and widgets' },
  { icon: 'playlist', title: 'Arrange', text: 'Playlists and layouts' },
  { icon: 'calendar', title: 'Schedule', text: 'Channels by time of week' },
  { icon: 'monitor', title: 'Play', text: 'Registered devices' },
];

function Hero(): React.JSX.Element {
  return (
    <header className={styles.hero}>
      <div className={styles.heroBackdrop} aria-hidden="true" />
      <div className={clsx('container', styles.heroInner)}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Open-source digital signage</span>
          <Heading as="h1" className={styles.heroTitle}>
            Every screen, <span className="text-gradient">one dashboard.</span>
          </Heading>
          <p className={styles.heroSubtitle}>
            Castmill is a self-hostable platform for running digital signage at
            any scale. Plan content once, schedule it per location and play it
            on browsers, Android, LG webOS and desktop players.
          </p>
          <div className={styles.heroActions}>
            <Link
              className="button button--primary button--lg"
              to="/docs/getting-started/quick-start"
            >
              Get started
            </Link>
            <Link
              className={clsx('button button--lg', styles.secondaryButton)}
              to="/docs/intro"
            >
              Read the docs
            </Link>
          </div>
          <ul className={styles.heroFacts}>
            <li>AGPL-3.0 licensed</li>
            <li>Docker deployment</li>
            <li>Offline-capable players</li>
          </ul>
        </div>
        <div className={styles.heroVisual}>
          <HomeShowcase />
        </div>
      </div>
    </header>
  );
}

function Paths(): React.JSX.Element {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">Start where you are</Heading>
          <p>
            The documentation is organized around what you want to do. Pick a
            starting point.
          </p>
        </div>
        <div className={styles.pathGrid}>
          {PATHS.map((path) => (
            <Link key={path.title} to={path.href} className={styles.pathCard}>
              <span className={styles.pathIcon}>
                <Icon name={path.icon} />
              </span>
              <Heading as="h3">{path.title}</Heading>
              <p>{path.description}</p>
              <span className={styles.pathCta}>{path.cta} →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Flow(): React.JSX.Element {
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">From upload to screen</Heading>
          <p>
            Content moves through four steps. Each one is a separate building
            block, so you can reuse a playlist on many channels and a channel on
            many devices.
          </p>
        </div>
        <ol className={styles.flow}>
          {FLOW.map((step, index) => (
            <li key={step.title} className={styles.flowStep}>
              <span className={styles.flowIcon}>
                <Icon name={step.icon} />
              </span>
              <span className={styles.flowIndex}>Step {index + 1}</span>
              <strong>{step.title}</strong>
              <span className={styles.flowText}>{step.text}</span>
            </li>
          ))}
        </ol>
        <div className={styles.center}>
          <Link
            className={clsx('button button--lg', styles.secondaryButton)}
            to="/docs/getting-started/first-screen"
          >
            Follow the first-screen tutorial
          </Link>
        </div>
      </div>
    </section>
  );
}

function Features(): React.JSX.Element {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">What Castmill does</Heading>
          <p>The main capabilities, each with its own chapter.</p>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <Link
              key={feature.title}
              to={feature.href}
              className={styles.feature}
            >
              <span className={styles.featureIcon}>
                <Icon name={feature.icon} />
              </span>
              <Heading as="h3">{feature.title}</Heading>
              <p>{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CallToAction(): React.JSX.Element {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.cta}>
          <div>
            <Heading as="h2">Run it on your own infrastructure</Heading>
            <p>
              One Docker Compose file starts PostgreSQL, the backend and the
              dashboard. No other services are required.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <Link
              className="button button--primary button--lg"
              to="/docs/getting-started/quick-start"
            >
              Quick start
            </Link>
            <Link
              className={clsx('button button--lg', styles.ctaSecondary)}
              href="https://github.com/castmill/castmill"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.JSX.Element {
  return (
    <Layout
      title="Open-source digital signage"
      description="Castmill is an open-source, self-hostable digital signage platform with players for browsers, Android, LG webOS and desktop."
    >
      <Hero />
      <main>
        <Paths />
        <Flow />
        <Features />
        <CallToAction />
      </main>
    </Layout>
  );
}
