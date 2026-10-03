import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();

// Helper to fetch URL content
function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
      timeout: 15000,
    }, (res) => {
      // Follow redirect
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, url).toString();
        }
        return resolve(fetchText(redirectUrl, headers));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

// Scrape image candidates from Bing Images HTML (which renders direct murl links)
async function searchWebImages(query: string): Promise<string[]> {
  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
    const html = await fetchText(searchUrl);
    
    // Bing images JSON embeds image URLs inside murl&quot;:&quot;URL&quot;
    const matches = html.match(/murl&quot;:&quot;(https?:[^&]+?)&quot;/g) || [];
    const urls = matches.map(m => {
      const clean = m.replace(/murl&quot;:&quot;/, '').replace(/&quot;/, '');
      return decodeURIComponent(clean);
    });

    // Filter valid image extensions and exclude obvious generic badges/logos
    const filtered = urls.filter(u => {
      const lower = u.toLowerCase();
      if (lower.includes('logo') || lower.includes('icon') || lower.includes('clipart') || lower.includes('vector')) return false;
      return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.includes('googleusercontent');
    });

    return Array.from(new Set(filtered));
  } catch (err: any) {
    console.warn(`[WARN] Search failed for "${query}":`, err.message);
    return [];
  }
}

// Test image accessibility
function checkImageReachable(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': parsed.origin,
        },
        timeout: 5000,
      }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          const contentType = res.headers['content-type'] || '';
          if (contentType.includes('image') || contentType.includes('octet-stream') || !contentType) {
            return resolve(true);
          }
        }
        resolve(false);
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function main() {
  console.log('🚀 Starting web image scraper for existing turfs...\n');

  const turfs = await prisma.turf.findMany({
    include: {
      city: true,
      images: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${turfs.length} turfs to process.\n`);

  for (const turf of turfs) {
    const cityName = turf.city?.name || 'Madurai';
    console.log(`--------------------------------------------------`);
    console.log(`📍 Processing: "${turf.name}" (${cityName})`);
    console.log(`   Address: ${turf.addressLine}`);

    // Query 1: exact turf name + city + turf/ground
    const queries = [
      `"${turf.name}" ${cityName} turf ground`,
      `${turf.name} ${cityName} sports arena`,
      `"${turf.name}" ${cityName}`,
    ];

    let candidates: string[] = [];
    for (const q of queries) {
      const results = await searchWebImages(q);
      if (results.length > 0) {
        candidates.push(...results);
      }
      if (candidates.length >= 8) break;
      await new Promise(r => setTimeout(r, 600)); // Rate limiting pause
    }

    candidates = Array.from(new Set(candidates));
    console.log(`   Scraped ${candidates.length} candidates.`);

    // Verify which candidates are reachable
    const validImages: string[] = [];
    for (const imgUrl of candidates) {
      const ok = await checkImageReachable(imgUrl);
      if (ok) {
        validImages.push(imgUrl);
      }
      if (validImages.length >= 5) break;
    }

    console.log(`   Reachable valid images found: ${validImages.length}`);

    if (validImages.length === 0) {
      console.log(`   ⚠️ No verified images found for "${turf.name}", keeping current images.`);
      continue;
    }

    const coverUrl = validImages[0];
    const galleryUrls = validImages.slice(1);

    // Update Turf coverImageUrl
    await prisma.turf.update({
      where: { id: turf.id },
      data: { coverImageUrl: coverUrl },
    });
    console.log(`   ✅ Updated cover image: ${coverUrl.substring(0, 80)}...`);

    // Remove old Unsplash turf images and replace with scraped photos
    await prisma.turfImage.deleteMany({
      where: { turfId: turf.id },
    });

    // Insert new cover image
    await prisma.turfImage.create({
      data: {
        turfId: turf.id,
        imageUrl: coverUrl,
        caption: `${turf.name} - Main Ground`,
        displayOrder: 1,
        isCover: true,
      },
    });

    // Insert new gallery images
    let order = 2;
    for (const gUrl of galleryUrls) {
      await prisma.turfImage.create({
        data: {
          turfId: turf.id,
          imageUrl: gUrl,
          caption: `${turf.name} - Arena Photo ${order - 1}`,
          displayOrder: order,
          isCover: false,
        },
      });
      order++;
    }

    console.log(`   ✅ Replaced ${order - 1} images in database.`);
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('\n🎉 Finished scraping and updating all turf images in the database!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
