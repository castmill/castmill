// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const path = require('path');
const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Castmill',
  tagline: 'Open Source Digital Signage',
  favicon: 'img/castmill_favicon.png',

  // Set the production url of your site here
  url: 'https://docs.castmill.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'castmill', // Usually your GitHub org/user name.
  projectName: 'castmill', // Usually your repo name.

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
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
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/castmill/castmill/tree/main/packages/website/',
        },
        blog: false,
        /*
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        */
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
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/social/home.jpg',
      metadata: [
        { name: 'keywords', content: 'digital signage, open source, castmill, content management, media player, widgets' },
        { name: 'description', content: 'Open source digital signage solution for creating, managing and deploying content across any device or platform' },
        { property: 'og:title', content: 'Castmill - Your Digital Signage Partner' },
        { property: 'og:description', content: 'Open source solution for creating, managing and deploying digital signage content across any device or platform' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Castmill - Your Digital Signage Partner' },
        { name: 'twitter:description', content: 'Open source solution for creating, managing and deploying digital signage content across any device or platform' },
      ],
      navbar: {
        logo: {
          alt: 'Castmill Logo',
          src: 'img/logo.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Tutorial',
          },
          // {to: '/blog', label: 'Blog', position: 'left'},
          {
            href: 'https://github.com/castmill/castmill',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial',
                to: '/docs/intro',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/castmill',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/castmill',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                href: 'https://castmill.com/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/castmill/castmill',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Castmill AB. AGPL Licensed. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
