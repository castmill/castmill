const fs = require('fs');
const path = require('path');

/**
 * Generates /llms.txt (https://llmstxt.org) at build time from the docs
 * sidebar, so the index always matches the published chapters and pages.
 */
function collectSections(items, docsById, siteUrl) {
  const sections = [];
  const rootLinks = [];

  const linkFor = (docId) => {
    const doc = docsById.get(docId);
    if (!doc) return null;
    const description = doc.description ? `: ${doc.description}` : '';
    return `- [${doc.title}](${siteUrl}${doc.permalink})${description}`;
  };

  const walk = (entries, links) => {
    for (const item of entries) {
      if (item.type === 'doc' || item.type === 'ref') {
        const link = linkFor(item.id);
        if (link) links.push(link);
      } else if (item.type === 'category') {
        if (item.link && item.link.type === 'doc') {
          const link = linkFor(item.link.id);
          if (link) links.push(link);
        }
        walk(item.items, links);
      }
    }
  };

  for (const item of items) {
    if (item.type === 'category') {
      const links = [];
      walk([item], links);
      if (links.length > 0) sections.push({ label: item.label, links });
    } else {
      walk([item], rootLinks);
    }
  }

  return { rootLinks, sections };
}

function buildLlmsTxt({ siteConfig, docs, sidebar, options }) {
  const siteUrl = siteConfig.url.replace(/\/$/, '');
  const docsById = new Map(docs.map((doc) => [doc.id, doc]));
  const { rootLinks, sections } = collectSections(sidebar, docsById, siteUrl);

  const lines = [`# ${siteConfig.title}`, '', `> ${options.summary}`, ''];
  if (options.details) {
    lines.push(options.details, '');
  }
  if (rootLinks.length > 0) {
    lines.push('## Start here', '', ...rootLinks, '');
  }
  for (const section of sections) {
    lines.push(`## ${section.label}`, '', ...section.links, '');
  }
  return lines.join('\n');
}

module.exports = function llmsTxtPlugin(context, options = {}) {
  return {
    name: 'llms-txt-plugin',

    async postBuild({ siteConfig, outDir, plugins }) {
      const docsPlugin = plugins.find(
        (plugin) => plugin.name === 'docusaurus-plugin-content-docs'
      );
      const version = docsPlugin?.content?.loadedVersions?.[0];
      if (!version) return;

      const sidebarId = options.sidebarId || 'docsSidebar';
      const sidebar = version.sidebars[sidebarId] || [];
      const content = buildLlmsTxt({
        siteConfig,
        docs: version.docs,
        sidebar,
        options: {
          summary: options.summary || siteConfig.tagline,
          details: options.details,
        },
      });

      fs.writeFileSync(path.join(outDir, 'llms.txt'), content);
    },
  };
};

module.exports.buildLlmsTxt = buildLlmsTxt;
