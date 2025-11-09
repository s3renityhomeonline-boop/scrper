import { Actor } from 'apify';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin
chromium.use(StealthPlugin());

await Actor.main(async () => {
    const input = await Actor.getInput();

    const {
        currentPage = null,      // Manual page override
        maxPages = 73,           // Safety limit
        maxResults = 24,         // Cars per page
        baseUrl = 'https://www.cargurus.ca/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?bodyTypeGroupIds=7&bodyTypeGroupIds=5&zip=H3H&distance=100&sortDir=ASC&sortType=DEAL_SCORE&makeModelTrimPaths=m2&makeModelTrimPaths=m26&makeModelTrimPaths=m1&makeModelTrimPaths=m7&makeModelTrimPaths=m22&makeModelTrimPaths=m191&makeModelTrimPaths=m32&maxMileage=140000&minPrice=35000'
    } = input;

    console.log('🚀 Starting CarGurus Stealth Scraper...');

    // Get or initialize page state
    let pageToScrape = currentPage;
    if (!pageToScrape) {
        // Auto-resume: Get last page from storage
        const state = await Actor.getValue('SCRAPER_STATE') || {};
        pageToScrape = state.nextPage || 1;
    }

    // Safety check
    if (pageToScrape > maxPages) {
        console.log(`✅ All pages scraped! (Last page: ${maxPages})`);
        return;
    }

    console.log(`📄 Scraping page: ${pageToScrape} of ${maxPages}`);
    console.log(`📊 Max results per page: ${maxResults}`);

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

    // Build URL with page number
    const urlToScrape = pageToScrape === 1
        ? baseUrl
        : `${baseUrl}#resultsPage=${pageToScrape}`;

    console.log(`\n🌐 Visiting: ${urlToScrape}`);

    try {
        // Navigate with realistic timing
        await page.goto(urlToScrape, {
            waitUntil: 'domcontentloaded',
            timeout: 90000
        });

        console.log('⏳ Waiting for page to load...');
        await page.waitForTimeout(5000);

        // Debug: Check what page we landed on
        const currentUrl = page.url();
        const pageTitle = await page.title();
        console.log(`📍 Current URL: ${currentUrl}`);
        console.log(`📄 Page title: ${pageTitle}`);

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

        // If no links found, debug the page
        if (carLinks.length === 0) {
            console.log('⚠️ No car links found - debugging page...');

            // Save screenshot
            await Actor.setValue('debug-screenshot.png', await page.screenshot({ fullPage: false }), { contentType: 'image/png' });

            // Check for common blocking indicators
            const pageDebug = await page.evaluate(() => {
                return {
                    bodyText: document.body.innerText.substring(0, 500),
                    h1Text: document.querySelector('h1')?.innerText || 'No H1',
                    hasCaptcha: !!document.querySelector('[class*="captcha"]'),
                    hasBlocking: document.body.innerText.toLowerCase().includes('blocked') ||
                                 document.body.innerText.toLowerCase().includes('access denied'),
                    linkCount: document.querySelectorAll('a').length,
                    vdpLinkCount: document.querySelectorAll('a[href*="vdp"]').length
                };
            });

            console.log('🔍 Page debug:', JSON.stringify(pageDebug, null, 2));
        }

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
        const linksToVisit = carLinks.slice(0, maxResults);
        console.log(`📋 Will visit ${linksToVisit.length} car detail pages`);

        for (const carUrl of linksToVisit) {
            console.log(`\n🔍 Visiting car: ${carUrl}`);

            try {
                const carPage = await context.newPage();

                // Track the detailListingJson API call - parse JSON IMMEDIATELY
                let detailListingData = null;
                let apiResolved = false;

                const detailListingPromise = new Promise((resolve) => {
                    carPage.on('response', async (response) => {
                        if (apiResolved) return; // Already got it

                        const url = response.url();

                        // THIS is the API call with ALL the car data!
                        if (url.includes('detailListingJson.action')) {
                            console.log(`📡 Intercepted API call: detailListingJson.action`);
                            try {
                                // CRITICAL: Parse JSON IMMEDIATELY before page closes
                                const data = await response.json();
                                detailListingData = data;
                                apiResolved = true;
                                resolve(data);
                            } catch (e) {
                                console.log(`⚠️ Failed to parse API response: ${e.message}`);
                                resolve(null);
                            }
                        }
                    });

                    // Timeout after 35 seconds if API doesn't arrive
                    setTimeout(() => {
                        if (!apiResolved) {
                            console.log('⚠️ API timeout - extracting from DOM');
                            resolve(null);
                        }
                    }, 35000);
                });

                await carPage.goto(carUrl, {
                    waitUntil: 'domcontentloaded', // Don't wait for ads
                    timeout: 60000
                });

                // Wait for the detailListingJson.action API call
                console.log('⏳ Waiting for detailListingJson.action...');
                await detailListingPromise;

                // Extra buffer to ensure data is parsed
                await carPage.waitForTimeout(2000);

                // Parse data from API response
                let carData = {};

                if (detailListingData && detailListingData.listing) {
                    const listing = detailListingData.listing;

                    // Extract VIN
                    let vin = listing.vin || null;
                    if (!vin && listing.specifications) {
                        const vinSpec = listing.specifications.find(s =>
                            s.displayName && s.displayName.toLowerCase() === 'vin'
                        );
                        if (vinSpec) vin = vinSpec.displayValue;
                    }

                    carData = {
                        vin,
                        title: `${listing.modelYear || ''} ${listing.makeName || ''} ${listing.modelName || ''} ${listing.trimName || ''}`.trim(),
                        price: listing.expectedPrice || listing.price,
                        priceString: listing.expectedPriceString || listing.priceString,
                        year: listing.modelYear,
                        make: listing.makeName,
                        model: listing.modelName,
                        trim: listing.trimName,
                        mileage: listing.mileage,
                        mileageString: listing.mileageString,
                        dealerName: listing.sellerName,
                        dealerCity: listing.sellerCity,
                        dealRating: listing.dealBadgeText,
                        bodyType: listing.bodyType,
                        url: carUrl,
                        pageNumber: pageToScrape,
                        source: 'api',
                        hasApiData: true
                    };
                } else {
                    // Fallback: try window.__PREFLIGHT__
                    carData = await carPage.evaluate(() => {
                        const preflight = window.__PREFLIGHT__ || {};
                        const listing = preflight.listing || {};

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
                            source: 'dom',
                            hasApiData: false
                        };
                    });
                    carData.pageNumber = pageToScrape;
                }

                console.log(`  VIN: ${carData.vin || 'NOT FOUND'}`);
                console.log(`  Title: ${carData.title || 'NOT FOUND'}`);
                console.log(`  Price: ${carData.priceString || carData.price || 'NOT FOUND'}`);
                console.log(`  Source: ${carData.source} (API: ${carData.hasApiData})`);

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

                await carPage.close();

                // Random delay between cars
                await page.waitForTimeout(2000 + Math.random() * 3000);

            } catch (error) {
                console.error(`❌ Error processing car ${carUrl}:`, error.message);
            }
        }

        // Save state for next run
        const nextPage = pageToScrape + 1;
        await Actor.setValue('SCRAPER_STATE', {
            nextPage,
            lastScraped: new Date().toISOString(),
            lastPage: pageToScrape
        });

        console.log(`\n💾 State saved: Next run will scrape page ${nextPage}`);

    } catch (error) {
        console.error(`❌ Error processing page ${pageToScrape}:`, error.message);
    }

    await browser.close();
    console.log('\n✅ Scraping complete!');
});
