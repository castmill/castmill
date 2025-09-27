const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Convert HTML social cards to JPG images
 * 
 * Usage:
 * node scripts/generate-social-images.js
 */

async function generateImages() {
  console.log('🚀 Starting social media image generation...');

  const buildSocialDir = path.join(__dirname, '..', 'build', 'img', 'social');
  const staticSocialDir = path.join(__dirname, '..', 'static', 'img', 'social');

  // Ensure output directory exists
  if (!fs.existsSync(staticSocialDir)) {
    fs.mkdirSync(staticSocialDir, { recursive: true });
  }

  // Get all HTML files
  const htmlFiles = fs.readdirSync(buildSocialDir)
    .filter(file => file.endsWith('.html'))
    .filter(file => file !== 'README.md');

  if (htmlFiles.length === 0) {
    console.log('❌ No HTML files found. Run `yarn build` first.');
    return;
  }

  console.log(`📝 Found ${htmlFiles.length} HTML templates to convert`);

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: {
      width: 1200,
      height: 630,
      deviceScaleFactor: 2, // High DPI for better quality
    }
  });

  try {
    for (const htmlFile of htmlFiles) {
      const htmlPath = path.join(buildSocialDir, htmlFile);
      const outputPath = path.join(staticSocialDir, htmlFile.replace('.html', '.jpg'));
      
      console.log(`🎨 Processing ${htmlFile}...`);

      const page = await browser.newPage();
      
      // Load the HTML file
      const fileUrl = `file://${htmlPath}`;
      await page.goto(fileUrl, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      // Take screenshot
      await page.screenshot({
        path: outputPath,
        type: 'jpeg',
        quality: 90,
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: 1200,
          height: 630
        }
      });

      await page.close();
      console.log(`✅ Generated ${path.basename(outputPath)}`);
    }

    console.log('🎉 All social media images generated successfully!');
    console.log(`📂 Images saved to: ${staticSocialDir}`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Verify images in static/img/social/');
    console.log('2. Update page frontmatter to use the images:');
    console.log('   ---');
    console.log('   image: /img/social/home.jpg');
    console.log('   ---');

  } catch (error) {
    console.error('❌ Error generating images:', error);
  } finally {
    await browser.close();
  }
}

// Check if Puppeteer is installed
try {
  require.resolve('puppeteer');
  generateImages().catch(console.error);
} catch (error) {
  console.log('❌ Puppeteer is not installed.');
  console.log('📦 Install it with: npm install puppeteer');
  console.log('');
  console.log('Alternative options:');
  console.log('1. Manual screenshots: Open HTML files and screenshot at 1200x630');
  console.log('2. Online tools: Upload HTML to htmlcsstoimage.com');
  console.log('3. Browser DevTools: Set device emulation to 1200x630');
}
