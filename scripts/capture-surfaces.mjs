import puppeteer from 'puppeteer-core';
import fs from 'fs';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  console.log('Capturing /world-cup...');
  try {
    await page.goto('https://fourcastapp.vercel.app/world-cup', { waitUntil: 'networkidle2', timeout: 25000 });
    await page.screenshot({ path: 'media/capture-worldcup.png' });
    console.log('Saved media/capture-worldcup.png');
  } catch (e) {
    console.error('Failed world-cup:', e.message);
  }

  console.log('Capturing /agent...');
  try {
    await page.goto('https://fourcastapp.vercel.app/agent', { waitUntil: 'networkidle2', timeout: 25000 });
    await page.screenshot({ path: 'media/capture-agent.png' });
    console.log('Saved media/capture-agent.png');
  } catch (e) {
    console.error('Failed agent:', e.message);
  }

  console.log('Capturing /arena...');
  try {
    await page.goto('https://fourcastapp.vercel.app/arena', { waitUntil: 'networkidle2', timeout: 25000 });
    await page.screenshot({ path: 'media/capture-arena.png' });
    console.log('Saved media/capture-arena.png');
  } catch (e) {
    console.error('Failed arena:', e.message);
  }

  await browser.close();
  console.log('Done captures.');
}

capture().catch(console.error);
