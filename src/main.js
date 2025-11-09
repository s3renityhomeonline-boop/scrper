import { Actor } from 'apify';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin
chromium.use(StealthPlugin());

// ============================================
// FILTER AUTOMATION HELPERS
// ============================================

async function applyFilters(page, filters, location, searchRadius) {
    console.log('🎯 Applying UI filters...');

    // 1. LOCATION FILTER - SKIPPED (using default location from URL)
    // await applyLocationFilter(page, location, searchRadius);

    // 2. BODY TYPE FILTER (Add Pickup Truck)
    await applyBodyTypeFilter(page, filters.bodyTypes);

    // 3. MAKE & MODEL FILTER
    await applyMakeFilter(page, filters.makes);

    // 4. PRICE FILTER
    await applyPriceFilter(page, filters.minPrice);

    // 5. MILEAGE FILTER
    await applyMileageFilter(page, filters.maxMileage);

    // 6. DEAL RATING FILTER
    await applyDealRatingFilter(page, filters.dealRatings);

    console.log('✅ All filters applied successfully!');
}

async function applyLocationFilter(page, postalCode, radius) {
    try {
        console.log(`📍 Setting location: ${postalCode}, radius: ${radius} km`);

        // Click location button to open modal
        await page.click('button[data-testid="zipCodeLink"]');
        await page.waitForTimeout(1000);

        // Find and fill postal code input
        const locationInput = await page.locator('input[placeholder*="postal"], input[name*="zip"], input[id*="location"]').first();
        await locationInput.fill(postalCode);
        await page.waitForTimeout(500);

        // Select search radius
        await page.selectOption('select[data-testid="select-filter-distance"]', radius.toString());
        await page.waitForTimeout(500);

        // Click "Update" or "Search" button in modal
        await page.click('button:has-text("Update"), button:has-text("Search"), button:has-text("Apply")');
        await page.waitForTimeout(3000); // Wait for results to update

        console.log(`  ✅ Location set to ${postalCode}`);
    } catch (error) {
        console.log(`  ⚠️ Location filter error: ${error.message} (continuing...)`);
    }
}

async function applyBodyTypeFilter(page, bodyTypes) {
    try {
        console.log(`🚗 Setting body types: ${bodyTypes.join(', ')}`);

        // Open Body Style accordion
        await page.click('#BodyStyle-accordion-trigger');
        await page.waitForTimeout(1000);

        // Click checkboxes for each body type
        for (const bodyType of bodyTypes) {
            if (bodyType.includes('Pickup')) {
                // Find and click Pickup Truck checkbox
                await page.click('button[id*="PICKUP"], label:has-text("Pickup Truck")');
                await page.waitForTimeout(500);
                console.log('  ✅ Added Pickup Truck');
            }
            // SUV/Crossover is already selected by default on the base URL
        }

        await page.waitForTimeout(2000); // Wait for results to update
    } catch (error) {
        console.log(`  ⚠️ Body type filter error: ${error.message} (continuing...)`);
    }
}

async function applyMakeFilter(page, makes) {
    try {
        console.log(`🏭 Setting makes: ${makes.join(', ')}`);

        // Open Make & Model accordion
        await page.click('#MakeAndModel-accordion-trigger');
        await page.waitForTimeout(1500);

        // Click checkboxes for each make
        for (const make of makes) {
            try {
                // Try multiple selector patterns
                const selectors = [
                    `button[id*="${make.toUpperCase()}"]`,
                    `label:has-text("${make}")`,
                    `button[aria-label*="${make}"]`
                ];

                let clicked = false;
                for (const selector of selectors) {
                    try {
                        await page.click(selector, { timeout: 2000 });
                        clicked = true;
                        console.log(`  ✅ Added ${make}`);
                        await page.waitForTimeout(300);
                        break;
                    } catch (e) {
                        continue;
                    }
                }

                if (!clicked) {
                    console.log(`  ⚠️ Could not find ${make} checkbox`);
                }
            } catch (error) {
                console.log(`  ⚠️ Error clicking ${make}: ${error.message}`);
            }
        }

        await page.waitForTimeout(2000); // Wait for results to update
    } catch (error) {
        console.log(`  ⚠️ Make filter error: ${error.message} (continuing...)`);
    }
}

async function applyPriceFilter(page, minPrice) {
    try {
        console.log(`💰 Setting min price: $${minPrice}`);

        // Open Price accordion
        await page.click('#Price-accordion-trigger');
        await page.waitForTimeout(1000);

        // Find and fill min price input
        const minPriceInput = await page.locator('input[id*="min"][id*="price"], input[placeholder*="Min"]').first();
        await minPriceInput.fill(minPrice.toString());
        await page.waitForTimeout(500);

        // Press Enter or Tab to trigger update
        await minPriceInput.press('Enter');
        await page.waitForTimeout(2000);

        console.log(`  ✅ Min price set to $${minPrice}`);
    } catch (error) {
        console.log(`  ⚠️ Price filter error: ${error.message} (continuing...)`);
    }
}

async function applyMileageFilter(page, maxMileage) {
    try {
        console.log(`📏 Setting max mileage: ${maxMileage} km`);

        // Open Mileage accordion
        await page.click('#Mileage-accordion-trigger');
        await page.waitForTimeout(1000);

        // Find and fill max mileage input
        const maxMileageInput = await page.locator('input[id*="max"][id*="mileage"], input[placeholder*="Max"]').first();
        await maxMileageInput.fill(maxMileage.toString());
        await page.waitForTimeout(500);

        // Press Enter or Tab to trigger update
        await maxMileageInput.press('Enter');
        await page.waitForTimeout(2000);

        console.log(`  ✅ Max mileage set to ${maxMileage} km`);
    } catch (error) {
        console.log(`  ⚠️ Mileage filter error: ${error.message} (continuing...)`);
    }
}

async function applyDealRatingFilter(page, dealRatings) {
    try {
        console.log(`⭐ Setting deal ratings: ${dealRatings.join(', ')}`);

        // Open Deal Rating accordion
        await page.click('#DealRating-accordion-trigger');
        await page.waitForTimeout(1000);

        // Click checkboxes for each deal rating
        for (const rating of dealRatings) {
            try {
                await page.click(`#FILTER\\.DEAL_RATING\\.${rating}`);
                console.log(`  ✅ Added ${rating.replace('_', ' ')}`);
                await page.waitForTimeout(300);
            } catch (error) {
                console.log(`  ⚠️ Could not click ${rating}: ${error.message}`);
            }
        }

        await page.waitForTimeout(2000); // Wait for results to update
    } catch (error) {
        console.log(`  ⚠️ Deal rating filter error: ${error.message} (continuing...)`);
    }
}

// ============================================
// MAIN SCRAPER
// ============================================

await Actor.main(async () => {
    const input = await Actor.getInput();

    const {
        location = 'H3H',
        searchRadius = 100,
        currentPage = null,
        maxPages = 73,
        maxResults = 24,
        filters = {
            makes: ['Ford', 'GMC', 'Chevrolet', 'Toyota', 'Cadillac', 'Ram', 'Jeep'],
            bodyTypes: ['SUV / Crossover', 'Pickup Truck'],
            maxMileage: 140000,
            minPrice: 35000,
            dealRatings: ['GREAT_PRICE', 'GOOD_PRICE', 'FAIR_PRICE']
        }
    } = input;

    console.log('🚀 Starting CarGurus Stealth Scraper with UI Filters...');

    // Get or initialize page state
    let pageToScrape = currentPage;
    if (!pageToScrape) {
        const state = await Actor.getValue('SCRAPER_STATE') || {};
        pageToScrape = state.nextPage || 1;
    }

    // Safety check
    if (pageToScrape > maxPages) {
        console.log(`✅ All pages scraped! (Last page: ${maxPages})`);
        return;
    }

    console.log(`📄 Scraping page: ${pageToScrape} of ${maxPages}`);
    console.log(`📍 Location: ${location} (${searchRadius} km radius)`);
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
        geolocation: { longitude: -79.3832, latitude: 43.6532 },
        permissions: ['geolocation'],
    });

    const page = await context.newPage();

    try {
        // STEP 1: Navigate to base SUV page
        const baseUrl = 'https://www.cargurus.ca/Cars/l-Used-SUV-Crossover-bg7';
        console.log(`\n🌐 Visiting base page: ${baseUrl}`);

        await page.goto(baseUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 90000
        });

        console.log('⏳ Waiting for page to load...');
        await page.waitForTimeout(5000);

        // Simulate human behavior
        console.log('🖱️ Simulating human behavior...');
        await page.mouse.move(100, 200);
        await page.waitForTimeout(500);
        await page.mouse.move(300, 400);
        await page.waitForTimeout(1000);

        // STEP 2: Apply all filters via UI
        await applyFilters(page, filters, location, searchRadius);

        // STEP 3: Get the filtered URL with searchId
        await page.waitForTimeout(3000);
        const filteredUrl = page.url();
        const baseUrlWithFilters = filteredUrl.split('#')[0];

        console.log(`✅ Filters applied! Generated URL with searchId`);

        // STEP 4: Navigate to specific page if needed
        if (pageToScrape > 1) {
            const pageUrl = `${baseUrlWithFilters}#resultsPage=${pageToScrape}`;
            console.log(`🔄 Navigating to page ${pageToScrape}...`);
            await page.goto(pageUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });
            await page.waitForTimeout(3000);
        }

        // STEP 5: Scroll to load car links
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

        await page.waitForTimeout(3000);

        // STEP 6: Extract car links
        const carLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="vdp.action"]'));
            return [...new Set(links.map(a => a.href))];
        });

        console.log(`🚗 Found ${carLinks.length} car links on page ${pageToScrape}`);

        // Debug if no links found
        if (carLinks.length === 0) {
            console.log('⚠️ No car links found - debugging...');
            const currentUrl = page.url();
            const pageTitle = await page.title();
            console.log(`📍 Current URL: ${currentUrl}`);
            console.log(`📄 Page title: ${pageTitle}`);

            await Actor.setValue('debug-screenshot.png', await page.screenshot({ fullPage: false }), { contentType: 'image/png' });
        }

        // STEP 7: Visit car detail pages and scrape
        const linksToVisit = carLinks.slice(0, maxResults);
        console.log(`📋 Will visit ${linksToVisit.length} car detail pages`);

        for (const carUrl of linksToVisit) {
            console.log(`\n🔍 Visiting car: ${carUrl}`);

            try {
                const carPage = await context.newPage();

                // Track API call
                let detailListingData = null;
                let apiResolved = false;

                const detailListingPromise = new Promise((resolve) => {
                    carPage.on('response', async (response) => {
                        if (apiResolved) return;

                        const url = response.url();

                        if (url.includes('detailListingJson.action')) {
                            console.log(`📡 Intercepted API call: detailListingJson.action`);
                            try {
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

                    setTimeout(() => {
                        if (!apiResolved) {
                            console.log('⚠️ API timeout - extracting from DOM');
                            resolve(null);
                        }
                    }, 35000);
                });

                await carPage.goto(carUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });

                console.log('⏳ Waiting for detailListingJson.action...');
                await detailListingPromise;
                await carPage.waitForTimeout(2000);

                // Parse data from API response
                let carData = {};

                if (detailListingData && detailListingData.listing) {
                    const listing = detailListingData.listing;

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
                        location: location,
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
                    carData.location = location;
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
            baseUrl: baseUrlWithFilters,
            location,
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
