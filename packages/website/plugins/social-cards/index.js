const fs = require('fs');
const path = require('path');

/**
 * Docusaurus Social Cards Plugin
 * Generates dynamic social media cards at build time
 */
module.exports = function socialCardsPlugin(context, options) {
  return {
    name: 'social-cards-plugin',
    
    async postBuild({ siteConfig, outDir, routesPaths, plugins }) {
      console.log('🎨 Generating social media cards...');
      
      // Create social cards directory
      const cardsDir = path.join(outDir, 'img', 'social');
      if (!fs.existsSync(cardsDir)) {
        fs.mkdirSync(cardsDir, { recursive: true });
      }

      // Default template for social cards
      const generateCardHTML = (title, description, type = 'page') => {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Social Card</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            width: 1200px;
            height: 630px;
            background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            overflow: hidden;
            position: relative;
        }
        
        /* Background pattern */
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
                radial-gradient(circle at 25% 25%, rgba(255,255,255,0.05) 1px, transparent 1px),
                radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 60px 60px;
            pointer-events: none;
        }
        
        .card {
            text-align: center;
            padding: 80px 60px;
            max-width: 1000px;
            position: relative;
            z-index: 2;
        }
        
        .logo {
            font-size: 28px;
            font-weight: 300;
            color: rgba(255,255,255,0.8);
            margin-bottom: 50px;
            text-transform: uppercase;
            letter-spacing: 4px;
        }
        
        .title {
            font-size: 52px;
            font-weight: 600;
            line-height: 1.1;
            margin-bottom: 35px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            letter-spacing: -0.02em;
        }
        
        .description {
            font-size: 22px;
            font-weight: 400;
            opacity: 0.9;
            line-height: 1.5;
            max-width: 800px;
            margin: 0 auto 60px auto;
        }
        
        .badge {
            display: inline-block;
            background: rgba(255,255,255,0.15);
            padding: 12px 30px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 1px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .stats {
            position: absolute;
            bottom: 40px;
            left: 60px;
            display: flex;
            gap: 40px;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-number {
            font-size: 24px;
            font-weight: 600;
            opacity: 0.8;
        }
        
        .stat-label {
            font-size: 12px;
            opacity: 0.6;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">Castmill</div>
        <div class="title">${title || 'Digital Signage Platform'}</div>
        <div class="description">${description || 'Open source solution for creating, managing and deploying digital signage content'}</div>
        <div class="badge">${type}</div>
    </div>
    <div class="stats">
        <div class="stat">
            <div class="stat-number">100%</div>
            <div class="stat-label">Open Source</div>
        </div>
        <div class="stat">
            <div class="stat-number">5+</div>
            <div class="stat-label">Platforms</div>
        </div>
        <div class="stat">
            <div class="stat-number">∞</div>
            <div class="stat-label">Possibilities</div>
        </div>
    </div>
</body>
</html>`;
      };

      // Generate cards for main routes and dynamically discovered routes
      const cards = [
        {
          route: '/',
          title: 'Your Digital Signage Partner',
          description: 'Open source solution for creating, managing and deploying digital signage content across any device or platform',
          type: 'Homepage'
        },
        {
          route: '/docs/intro',
          title: 'Getting Started',
          description: 'Complete guide to building digital signage solutions with Castmill',
          type: 'Documentation'
        },
        {
          route: '/docs/player',
          title: 'Player Documentation',
          description: 'Learn how to set up and configure Castmill players across different platforms',
          type: 'Player Guide'
        },
        {
          route: '/docs/widgets',
          title: 'Widget Development',
          description: 'Create custom widgets for your digital signage displays',
          type: 'Developer Guide'
        },
        {
          route: '/docs/api',
          title: 'API Reference',
          description: 'Complete API documentation for integrating with Castmill',
          type: 'API Docs'
        }
      ];

      // Add dynamic routes if available
      if (routesPaths && routesPaths.length > 0) {
        routesPaths.forEach(route => {
          if (route.startsWith('/docs/') && !cards.some(card => card.route === route)) {
            const routeName = route.replace('/docs/', '').replace(/[-_]/g, ' ');
            const title = routeName.charAt(0).toUpperCase() + routeName.slice(1);
            
            cards.push({
              route,
              title,
              description: `Learn about ${title.toLowerCase()} in the Castmill documentation`,
              type: 'Documentation'
            });
          }
        });
      }

      // Create HTML files for each card
      for (const card of cards) {
        const fileName = card.route === '/' ? 'home.html' : 
                        card.route.replace(/\//g, '-').replace(/^-/, '') + '.html';
        
        const filePath = path.join(cardsDir, fileName);
        const html = generateCardHTML(card.title, card.description, card.type);
        
        fs.writeFileSync(filePath, html);
        console.log(`✅ Generated social card: ${fileName}`);
      }

      // Generate a README with instructions
      const readmeContent = `# Castmill Social Media Cards

This directory contains HTML templates for generating social media cards.

## Generated Cards
${cards.map(card => {
        const fileName = card.route === '/' ? 'home.html' : 
                        card.route.replace(/\//g, '-').replace(/^-/, '') + '.html';
        return `- **${card.title}** (${card.route}): ${fileName}`;
      }).join('\n')}

## Creating Images

### Option 1: Manual Screenshots
1. Open each HTML file in a browser
2. Resize browser window to exactly 1200x630 pixels
3. Take a screenshot
4. Save as JPG in static/img/social/

### Option 2: Automated (Recommended)
Use a headless browser tool like Puppeteer:

\`\`\`bash
npm install puppeteer
\`\`\`

Then create a script to generate all images automatically.

### Option 3: Online Tools
- Use services like htmlcsstoimage.com
- Upload the HTML files to generate images

## Usage in Docusaurus

Update your page frontmatter to use the generated cards:

\`\`\`markdown
---
image: /img/social/docs-intro.jpg
---
\`\`\`

Cards are automatically generated during the build process.
`;

      fs.writeFileSync(path.join(cardsDir, 'README.md'), readmeContent);

      console.log('🎉 Social media cards generated successfully!');
      console.log(`📊 Generated ${cards.length} card templates`);
      console.log('📋 Next steps:');
      console.log('   1. Check build/img/social/ directory');
      console.log('   2. Open HTML files to preview');
      console.log('   3. Generate JPG images (1200x630px)');
      console.log('   4. Copy images to static/img/social/');
    },

    configureWebpack(config, isServer) {
      // No webpack configuration needed for this plugin
      return {};
    },
  };
};
