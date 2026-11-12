// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const path = require('path');
const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/vsDark');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Castmill',
  tagline: 'Open-source digital signage',
  favicon: 'img/castmill_favicon.png',

  url: 'https://docs.castmill.io',
  baseUrl: '/',

  organizationName: 'castmill',
  projectName: 'castmill',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl:
            'https://github.com/castmill/castmill/tree/main/packages/website/',
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        // Whether to index docs pages
        indexDocs: true,
        // Whether to index blog pages
        indexBlog: false,
        // Whether to index static pages
        indexPages: false,
        // language of your documentation
        language: 'en',
      },
    ],
    // Custom social cards plugin
    [
      path.resolve(__dirname, 'plugins/social-cards'),
      {
        // Plugin options can go here
      },
    ],
    [
      path.resolve(__dirname, 'plugins/llms-txt'),
      {
        summary:
          'Castmill is an open source digital signage platform: a server, a web dashboard and players for browsers, Android, LG webOS and Electron.',
        details:
          'Content flows from media and feeds through widgets and playlists to channels, which devices play. Agents can manage Castmill through its MCP server at /mcp; see the MCP server page.',
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/castmill-social-card.png',
      metadata: [
        {
          name: 'keywords',
          content:
            'digital signage, open source, castmill, content management, media player, widgets',
        },
        {
          name: 'description',
          content:
            'Documentation for Castmill, the open-source digital signage platform: user guide, players, self-hosting and developer reference.',
        },
        {
          property: 'og:title',
          content: 'Castmill documentation',
        },
        {
          property: 'og:description',
          content:
            'User guide, player setup, self-hosting and developer reference for the Castmill digital signage platform.',
        },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        {
          name: 'twitter:title',
          content: 'Castmill documentation',
        },
        {
          name: 'twitter:description',
          content:
            'User guide, player setup, self-hosting and developer reference for the Castmill digital signage platform.',
        },
      ],
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true,
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
      navbar: {
        hideOnScroll: false,
        logo: {
          alt: 'Castmill',
          src: 'img/logo.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            to: '/docs/dashboard/overview',
            label: 'User guide',
            position: 'left',
          },
          {
            to: '/docs/players/overview',
            label: 'Players',
            position: 'left',
          },
          {
            to: '/docs/administration/self-hosting',
            label: 'Self-hosting',
            position: 'left',
          },
          {
            to: '/docs/developers/overview',
            label: 'Developers',
            position: 'left',
          },
          {
            href: 'https://github.com/castmill/castmill',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
        ],
      },
      footer: {
        style: 'dark',
        logo: {
          alt: 'Castmill',
          src: 'img/logo.png',
          href: 'https://castmill.io',
          width: 140,
        },
        links: [
          {
            title: 'Get started',
            items: [
              { label: 'Introduction', to: '/docs/intro' },
              { label: 'Quick start', to: '/docs/getting-started/quick-start' },
              {
                label: 'Your first screen',
                to: '/docs/getting-started/first-screen',
              },
              { label: 'Concepts', to: '/docs/concepts/architecture' },
            ],
          },
          {
            title: 'Guides',
            items: [
              { label: 'User guide', to: '/docs/dashboard/overview' },
              { label: 'Players', to: '/docs/players/overview' },
              {
                label: 'Self-hosting',
                to: '/docs/administration/self-hosting',
              },
              { label: 'Developers', to: '/docs/developers/overview' },
            ],
          },
          {
            title: 'Reference',
            items: [
              { label: 'Glossary', to: '/docs/reference/glossary' },
              { label: 'FAQ', to: '/docs/reference/faq' },
              { label: 'llms.txt', href: 'https://docs.castmill.io/llms.txt' },
            ],
          },
          {
            title: 'Project',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/castmill/castmill',
              },
              {
                label: 'Issues',
                href: 'https://github.com/castmill/castmill/issues',
              },
              { label: 'castmill.io', href: 'https://castmill.io' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Castmill AB. Released under the AGPL-3.0 license.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
