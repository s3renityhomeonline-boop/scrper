import { Actor } from 'apify';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin
chromium.use(StealthPlugin());

await Actor.main(async () => {
    const input = await Actor.getInput();

    const {
        startUrls = [{ url: 'https://www.cargurus.ca/Cars/l-Used-SUV-Crossover-bg7' }],
        maxConcurrency = 1,
        maxResults = 10,
    } = input;

    console.log('🚀 Starting CarGurus Stealth Scraper...');
    console.log(`📊 Max results: ${maxResults}`);

    // Launch browser with stealth
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
        ],
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-CA',
        timezoneId: 'America/Toronto',
        geolocation: { longitude: -79.3832, latitude: 43.6532 }, // Toronto
        permissions: ['geolocation'],
    });

    // NETWORK INTERCEPTION - This is the secret sauce!
    const apiResponses = [];

    context.on('response', async (response) => {
        const url = response.url();

        // Intercept API calls that return car data
        if (url.includes('inventorylisting') ||
            url.includes('search') ||
            url.includes('listing') ||
            url.includes('api.cargurus')) {

            try {
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const data = await response.json();
                    console.log(`📡 Intercepted API call: ${url.substring(0, 100)}...`);
                    apiResponses.push({
                        url,
                        data,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (e) {
                // Ignore non-JSON responses
            }
        }
    });

    const page = await context.newPage();

    // Process start URLs
    for (const { url } of startUrls) {
        console.log(`\n🌐 Visiting: ${url}`);

        try {
            // Navigate with realistic timing
            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 90000
            });

            console.log('⏳ Waiting for page to load...');
            await page.waitForTimeout(5000);

            // Simulate human behavior
            console.log('🖱️ Simulating human behavior...');
            await page.mouse.move(100, 200);
            await page.waitForTimeout(500);
            await page.mouse.move(300, 400);
            await page.waitForTimeout(500);

            // Scroll to trigger lazy loading
            console.log('📜 Scrolling to load content...');
            for (let i = 0; i < 3; i++) {
                await page.evaluate((offset) => {
                    window.scrollTo({
                        top: offset,
                        behavior: 'smooth'
                    });
                }, (i + 1) * 1000);
                await page.waitForTimeout(2000);
            }

            // Wait for any pending network requests
            console.log('⏳ Waiting for network requests...');
            await page.waitForTimeout(3000);

            // Extract car links from page
            const carLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="vdp.action"]'));
                return [...new Set(links.map(a => a.href))];
            });

            console.log(`🚗 Found ${carLinks.length} car links on page`);

            // Check intercepted API responses
            console.log(`📡 Intercepted ${apiResponses.length} API responses`);

            if (apiResponses.length > 0) {
                console.log('💾 Saving intercepted API data...');
                for (const apiResp of apiResponses) {
                    await Actor.pushData({
                        type: 'api_response',
                        url: apiResp.url,
                        data: apiResp.data,
                        timestamp: apiResp.timestamp
                    });
                }
            }

            // Visit car detail pages
            const linksToVisit = carLinks.slice(0, Math.min(10, maxResults));
            console.log(`📋 Will visit ${linksToVisit.length} car detail pages`);

            for (const carUrl of linksToVisit) {
                console.log(`\n🔍 Visiting car: ${carUrl}`);

                try {
                    const carPage = await context.newPage();

                    // Clear previous API responses
                    const carApiResponses = [];

                    carPage.on('response', async (response) => {
                        const url = response.url();
                        if (url.includes('listing') || url.includes('vdp')) {
                            try {
                                const contentType = response.headers()['content-type'] || '';
                                if (contentType.includes('application/json')) {
                                    const data = await response.json();
                                    carApiResponses.push({ url, data });
                                }
                            } catch (e) {
                                // Ignore
                            }
                        }
                    });

                    await carPage.goto(carUrl, {
                        waitUntil: 'networkidle',
                        timeout: 60000
                    });

                    await carPage.waitForTimeout(4000);

                    // Extract car data from page
                    const carData = await carPage.evaluate(() => {
                        const preflight = window.__PREFLIGHT__ || {};
                        const listing = preflight.listing || {};

                        // Find VIN
                        let vin = listing.vin || null;
                        if (!vin && listing.specs) {
                            const vinSpec = listing.specs.find(s =>
                                s.label && s.label.toLowerCase() === 'vin'
                            );
                            if (vinSpec) vin = vinSpec.value;
                        }

                        const titleEl = document.querySelector('h1');
                        const title = titleEl ? titleEl.textContent.trim() : '';

                        return {
                            vin,
                            title: title || preflight.listingTitle,
                            price: preflight.listingPriceValue || listing.price,
                            priceString: preflight.listingPriceString || listing.priceString,
                            year: listing.year || preflight.listingYear,
                            make: listing.make || preflight.listingMake,
                            model: listing.model || preflight.listingModel,
                            trim: listing.trim,
                            mileage: listing.mileage || listing.odometer,
                            dealerName: listing.dealerName || preflight.listingSellerName,
                            dealerCity: listing.dealerCity || preflight.listingSellerCity,
                            dealRating: listing.dealRating || listing.dealBadge,
                            bodyType: listing.bodyType,
                            url: window.location.href,
                            hasPreflight: !!window.__PREFLIGHT__,
                            hasListing: !!(window.__PREFLIGHT__ && window.__PREFLIGHT__.listing)
                        };
                    });

                    console.log(`  VIN: ${carData.vin || 'NOT FOUND'}`);
                    console.log(`  Title: ${carData.title || 'NOT FOUND'}`);
                    console.log(`  Price: ${carData.priceString || 'NOT FOUND'}`);
                    console.log(`  PREFLIGHT: ${carData.hasPreflight}, LISTING: ${carData.hasListing}`);

                    // Save car data
                    if (carData.vin || carData.title) {
                        await Actor.pushData({
                            type: 'car_listing',
                            ...carData,
                            scrapedAt: new Date().toISOString()
                        });
                        console.log(`  ✅ Saved to dataset`);
                    } else {
                        console.log(`  ⚠️ No data found - skipping`);
                    }

                    // Save intercepted API responses for this car
                    if (carApiResponses.length > 0) {
                        await Actor.pushData({
                            type: 'car_api_response',
                            url: carUrl,
                            apiResponses: carApiResponses,
                            timestamp: new Date().toISOString()
                        });
                    }

                    await carPage.close();

                    // Random delay between cars
                    await page.waitForTimeout(2000 + Math.random() * 3000);

                } catch (error) {
                    console.error(`❌ Error processing car ${carUrl}:`, error.message);
                }
            }

        } catch (error) {
            console.error(`❌ Error processing ${url}:`, error.message);
        }
    }

    await browser.close();
    console.log('\n✅ Scraping complete!');
});
