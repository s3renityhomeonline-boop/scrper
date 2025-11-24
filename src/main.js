import { Actor } from 'apify';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin
chromium.use(StealthPlugin());

// ============================================
// FILTER AUTOMATION HELPERS
// ============================================

async function applyFilters(page, filters, searchRadius) {
    console.log('🎯 Applying UI filters...');

    // 1. SEARCH RADIUS (Nationwide)
    await setSearchRadius(page, searchRadius);

    // 2. BODY TYPE FILTER (Add Pickup Truck)
    await applyBodyTypeFilter(page, filters.bodyTypes);

    // 3. MAKE & MODEL FILTER (Ford, GMC, Chevrolet, Cadillac)
    if (filters.makes && filters.makes.length > 0) {
        await applyMakeFilter(page, filters.makes);
    }

    // 4. PRICE FILTER (Minimum $35,000)
    await applyPriceFilter(page);

    // 5. DEAL RATING FILTER (Great/Good/Fair) - LAST
    await applyDealRatingFilter(page, filters.dealRatings);

    console.log('✅ All filters applied successfully!');
}

async function setSearchRadius(page, searchRadius) {
    try {
        console.log(`🌍 Setting search radius to: ${searchRadius === 50000 ? 'Nationwide' : searchRadius + ' km'}`);

        // Select the search distance dropdown (6-minute timeout)
        const dropdown = await page.locator('select[data-testid="select-filter-distance"]');
        await dropdown.waitFor({ state: 'visible', timeout: 360000 });

        // Select the value (50000 for Nationwide, or specific km value)
        await dropdown.selectOption(searchRadius.toString(), { timeout: 360000 });

        console.log(`  ✅ Search radius set successfully`);

        // Wait for results to update
        await page.waitForTimeout(2000);

    } catch (error) {
        console.log(`  ⚠️ Search radius error: ${error.message} (continuing...)`);
    }
}

async function applyBodyTypeFilter(page, bodyTypes) {
    try {
        console.log(`🚗 Setting body types: ${bodyTypes.join(', ')}`);

        // Open Body Style accordion (6-minute timeout)
        await page.click('#BodyStyle-accordion-trigger', { timeout: 360000 });
        await page.waitForTimeout(1000);

        // Click checkboxes for each body type
        for (const bodyType of bodyTypes) {
            if (bodyType.includes('Pickup')) {
                // Find and click Pickup Truck checkbox (6-minute timeout)
                await page.click('button[id*="PICKUP"], label:has-text("Pickup Truck")', { timeout: 360000 });
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
        await page.click('#MakeAndModel-accordion-trigger', { timeout: 360000 });
        await page.waitForTimeout(1000);

        // Click checkbox for each make (stable approach)
        for (const make of makes) {
            try {
                // Handle special case: RAM needs to be uppercase to match button ID
                const makeId = make.toUpperCase() === 'RAM' ? 'RAM' : make;

                // Click the make button (escape dots in ID selector) with 6-minute timeout
                await page.click(`#FILTER\\.MAKE_MODEL\\.${makeId}`, { timeout: 360000 });
                console.log(`  ✅ Added ${make}`);
                await page.waitForTimeout(500);
            } catch (error) {
                console.log(`  ⚠️ Could not click ${make}: ${error.message}`);
            }
        }

        await page.waitForTimeout(2000); // Wait for results to update
    } catch (error) {
        console.log(`  ⚠️ Make filter error: ${error.message} (continuing...)`);
    }
}

async function applyPriceFilter(page) {
    try {
        console.log(`💰 Setting minimum price to: $35,000 CAD`);

        // Open Price accordion (6-minute timeout)
        await page.click('#Price-accordion-trigger', { timeout: 360000 });
        await page.waitForTimeout(1000);

        // Find the MINIMUM slider specifically (not maximum)
        const minSlider = page.locator('[role="slider"][aria-label="Minimum"]');
        await minSlider.waitFor({ state: 'visible', timeout: 360000 });

        // Click on the minimum slider to focus it
        await minSlider.click({ timeout: 360000 });
        await page.waitForTimeout(500);

        // Set the slider value to 24 (which equals $35,000 CAD)
        // Using keyboard arrow keys: press Home to go to 0, then Right arrow 24 times
        await page.keyboard.press('Home'); // Reset to 0
        await page.waitForTimeout(300);

        // Press Right arrow 24 times to reach position 24 ($35,000)
        for (let i = 0; i < 24; i++) {
            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(50); // Small delay between presses
        }

        console.log(`  ✅ Minimum price set to $35,000`);
        await page.waitForTimeout(2000); // Wait for results to update

    } catch (error) {
        console.log(`  ⚠️ Price filter error: ${error.message} (continuing...)`);
    }
}

async function applyDealRatingFilter(page, dealRatings) {
    try {
        console.log(`⭐ Setting deal ratings: ${dealRatings.join(', ')}`);

        // Open Deal Rating accordion (6-minute timeout)
        await page.click('#DealRating-accordion-trigger', { timeout: 360000 });
        await page.waitForTimeout(1000);

        // Click checkboxes for each deal rating
        for (const rating of dealRatings) {
            try {
                // Click with 6-minute timeout
                await page.click(`#FILTER\\.DEAL_RATING\\.${rating}`, { timeout: 360000 });
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
        searchRadius = 50000,
        currentPage = null,
        maxPages = 73,
        maxResults = 24,
        filters = {
            makes: ['Ford', 'GMC', 'Chevrolet', 'Cadillac'],
            bodyTypes: ['SUV / Crossover', 'Pickup Truck'],
            maxMileage: 140000,
            minPrice: 35000,
            dealRatings: ['GREAT_PRICE', 'GOOD_PRICE', 'FAIR_PRICE']
        }
    } = input;

    console.log('🚀 Starting CarGurus Stealth Scraper with UI Filters...');

    // Open persistent Key-Value Store (survives between runs)
    const kv = await Actor.openKeyValueStore('scraper-state');

    // Get or initialize page state with daily reset
    let startPage = currentPage;
    if (!startPage) {
        const state = await kv.getValue('state') || {};
        const today = new Date().toISOString().split('T')[0]; // "2025-11-13"

        // Check if we need to reset (new day or first run)
        if (state.lastScrapedDate === today) {
            // Same day → continue from where we left off
            startPage = state.nextPage || 1;
            console.log(`📅 Continuing from page ${startPage} (same day: ${today})`);
        } else {
            // Different day or first run → reset to page 1
            startPage = 1;
            if (state.lastScrapedDate) {
                console.log(`📅 New day detected! Resetting to page 1 (previous: ${state.lastScrapedDate}, today: ${today})`);
            } else {
                console.log(`📅 First run! Starting from page 1`);
            }
        }
    }

    // Calculate the 3-page batch
    const pagesToScrape = [];
    for (let i = 0; i < 3; i++) {
        const pageNum = startPage + i;
        if (pageNum <= maxPages) {
            pagesToScrape.push(pageNum);
        }
    }

    // Safety check
    if (pagesToScrape.length === 0) {
        console.log(`✅ All pages scraped! (Last page: ${maxPages})`);
        return;
    }

    console.log(`📄 Scraping ${pagesToScrape.length} pages this run: ${pagesToScrape.join(', ')} of ${maxPages} total`);
    console.log(`🌍 Search radius: ${searchRadius === 50000 ? 'Nationwide' : searchRadius + ' km'}`);
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

        // STEP 2: Apply all filters via UI (once for all pages)
        await applyFilters(page, filters, searchRadius);

        // STEP 3: Get the filtered URL with searchId
        await page.waitForTimeout(3000);
        const filteredUrl = page.url();
        const baseUrlWithFilters = filteredUrl.split('#')[0];

        console.log(`✅ Filters applied! Generated URL with searchId`);

        // Track current page (we start at page 1 after applying filters)
        let currentPageNumber = 1;

        // STEP 4-7: Loop through each page in the batch (3 pages)
        for (const pageToScrape of pagesToScrape) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📄 Processing page ${pageToScrape} of ${maxPages}`);
            console.log(`${'='.repeat(60)}\n`);

            // Navigate to specific page if needed by clicking Next button (human-like)
            if (pageToScrape !== currentPageNumber) {
                const clicksNeeded = pageToScrape - currentPageNumber;
                console.log(`🔄 Navigating from page ${currentPageNumber} to page ${pageToScrape} (${clicksNeeded} clicks)...`);

                for (let i = 0; i < clicksNeeded; i++) {
                    try {
                        // Scroll to bottom to make pagination visible
                        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                        await page.waitForTimeout(800);

                        // Wait for and click the Next button (2-minute timeout)
                        const nextButton = page.locator('button[data-testid="srp-desktop-page-navigation-next-page"]');
                        await nextButton.waitFor({ state: 'visible', timeout: 120000 });
                        await nextButton.click({ timeout: 120000 });

                        console.log(`  ✅ Clicked Next button (${i + 1}/${clicksNeeded})`);

                        // Wait for new page to load
                        await page.waitForTimeout(4000);
                    } catch (error) {
                        console.log(`  ⚠️ Next button click failed: ${error.message}`);
                        // Fallback to hash navigation if Next button fails
                        console.log(`  🔄 Falling back to hash navigation...`);
                        await page.evaluate((pageNum) => {
                            window.location.hash = `resultsPage=${pageNum}`;
                        }, pageToScrape);
                        await page.waitForTimeout(5000);
                        break; // Exit the clicking loop since we used hash navigation
                    }
                }

                // Scroll to top after navigation
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.waitForTimeout(1000);

                // Update current page tracker
                currentPageNumber = pageToScrape;
            }

            // Scroll to load car links
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

            // Extract car links
            const carLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[data-testid="car-blade-link"]'));
                const baseUrl = window.location.origin;
                // Convert hash links to full URLs: #listing=123 → https://cargurus.ca/Cars/link/vdp.action#listing=123
                return [...new Set(links.map(a => {
                    const href = a.getAttribute('href');
                    if (href && href.startsWith('#')) {
                        return `${baseUrl}/Cars/link/vdp.action${href}`;
                    }
                    return a.href;
                }))];
            });

            console.log(`🚗 Found ${carLinks.length} car links on page ${pageToScrape}`);

            // Debug if no links found
            if (carLinks.length === 0) {
                console.log('⚠️ No car links found - debugging...');
                const currentUrl = page.url();
                const pageTitle = await page.title();
                console.log(`📍 Current URL: ${currentUrl}`);
                console.log(`📄 Page title: ${pageTitle}`);

                await Actor.setValue(`debug-screenshot-page${pageToScrape}.png`, await page.screenshot({ fullPage: false }), { contentType: 'image/png' });
                continue; // Skip to next page
            }

            // Visit car detail pages and scrape
            const linksToVisit = carLinks.slice(0, maxResults);
            console.log(`📋 Will visit ${linksToVisit.length} car detail pages`);

        for (const carUrl of linksToVisit) {
            console.log(`\n🔍 Visiting car: ${carUrl}`);

            try {
                const carPage = await context.newPage();

                // Navigate to car page
                await carPage.goto(carUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });

                // Try to get API data with retry logic
                let detailListingData = null;
                const maxApiAttempts = 2; // Try twice before falling back to DOM

                for (let attempt = 1; attempt <= maxApiAttempts; attempt++) {
                    console.log(`⏳ Waiting for detailListingJson.action (attempt ${attempt}/${maxApiAttempts})...`);

                    let apiResolved = false;

                    const detailListingPromise = new Promise((resolve) => {
                        carPage.on('response', async (response) => {
                            if (apiResolved) return;

                            const url = response.url();

                            if (url.includes('detailListingJson.action')) {
                                console.log(`📡 Intercepted API call: detailListingJson.action`);
                                try {
                                    // Race condition: timeout on JSON parsing (25 seconds)
                                    const jsonPromise = response.json();
                                    const timeoutPromise = new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('JSON parse timeout')), 25000)
                                    );

                                    const data = await Promise.race([jsonPromise, timeoutPromise]);
                                    apiResolved = true;
                                    resolve(data);
                                } catch (e) {
                                    console.log(`⚠️ Failed to parse API response: ${e.message}`);
                                    apiResolved = true;
                                    resolve(null);
                                }
                            }
                        });

                        // Overall API timeout (90 seconds = 2.5x of 35s)
                        setTimeout(() => {
                            if (!apiResolved) {
                                console.log(`⚠️ API timeout on attempt ${attempt}`);
                                apiResolved = true;
                                resolve(null);
                            }
                        }, 90000);
                    });

                    detailListingData = await detailListingPromise;

                    // If we got data, break out of retry loop
                    if (detailListingData && detailListingData.listing) {
                        console.log(`✅ API data received successfully`);
                        break;
                    }

                    // If this was the last attempt, log and continue to DOM fallback
                    if (attempt === maxApiAttempts) {
                        console.log(`⚠️ All API attempts failed, falling back to DOM extraction`);
                    } else {
                        console.log(`🔄 Retrying API call...`);
                        await carPage.waitForTimeout(2000); // Small delay before retry
                    }
                }

                await carPage.waitForTimeout(1000);

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

                    // Try to extract fuel type from specifications array
                    let fuelType = null;
                    if (listing.specifications) {
                        const fuelSpec = listing.specifications.find(s =>
                            s.displayName && (
                                s.displayName.toLowerCase().includes('fuel') ||
                                s.displayName.toLowerCase().includes('engine')
                            )
                        );
                        if (fuelSpec) fuelType = fuelSpec.displayValue;
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
                        dealerName: listing.sellerName || listing.seller?.name,
                        dealerCity: listing.sellerCity || listing.seller?.city,
                        dealerAddress: listing.seller?.address,
                        dealRating: listing.dealBadgeText,
                        bodyType: listing.bodyType,
                        fuelType: fuelType || listing.fuelType,
                        url: carUrl,
                        pageNumber: pageToScrape,
                        searchRadius: searchRadius,
                        source: 'api',
                        hasApiData: true
                    };

                    // Fallback: If critical fields missing from API, scrape from DOM
                    if (!carData.year || !carData.bodyType || !carData.dealerName || !carData.dealerCity || !carData.fuelType) {
                        const domData = await carPage.evaluate(() => {
                            const yearEl = document.querySelector('div[data-cg-ft="year"] span._value_ujq1z_13');
                            const bodyTypeEl = document.querySelector('div[data-cg-ft="bodyType"] span._value_ujq1z_13');
                            const fuelTypeEl = document.querySelector('div[data-cg-ft="fuelType"] span._value_ujq1z_13');

                            // Extract dealer name
                            const dealerNameEl = document.querySelector('[data-testid="dealerName"]');

                            // Extract location from title area (hgroup) or dealer address
                            const locationFromTitle = document.querySelector('hgroup p.oqywn.sCSIz');
                            const dealerAddressEl = document.querySelector('[data-testid="dealerAddress"] span[data-track-ui="dealer-address"]');

                            return {
                                year: yearEl ? yearEl.textContent.trim() : null,
                                bodyType: bodyTypeEl ? bodyTypeEl.textContent.trim() : null,
                                fuelType: fuelTypeEl ? fuelTypeEl.textContent.trim() : null,
                                dealerName: dealerNameEl ? dealerNameEl.textContent.trim() : null,
                                dealerCity: locationFromTitle ? locationFromTitle.textContent.trim() : null,
                                dealerAddress: dealerAddressEl ? dealerAddressEl.textContent.trim() : null
                            };
                        });

                        if (!carData.year && domData.year) carData.year = domData.year;
                        if (!carData.bodyType && domData.bodyType) carData.bodyType = domData.bodyType;
                        if (!carData.fuelType && domData.fuelType) carData.fuelType = domData.fuelType;
                        if (!carData.dealerName && domData.dealerName) carData.dealerName = domData.dealerName;
                        if (!carData.dealerCity && domData.dealerCity) carData.dealerCity = domData.dealerCity;
                        if (!carData.dealerAddress && domData.dealerAddress) carData.dealerAddress = domData.dealerAddress;
                    }
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

                        // Try to extract fuel type from specs
                        let fuelType = null;
                        if (listing.specs) {
                            const fuelSpec = listing.specs.find(s =>
                                s.label && (
                                    s.label.toLowerCase().includes('fuel') ||
                                    s.label.toLowerCase().includes('engine')
                                )
                            );
                            if (fuelSpec) fuelType = fuelSpec.value;
                        }

                        const titleEl = document.querySelector('h1');
                        const title = titleEl ? titleEl.textContent.trim() : '';

                        // Extract from DOM
                        const yearEl = document.querySelector('div[data-cg-ft="year"] span._value_ujq1z_13');
                        const bodyTypeEl = document.querySelector('div[data-cg-ft="bodyType"] span._value_ujq1z_13');
                        const fuelTypeEl = document.querySelector('div[data-cg-ft="fuelType"] span._value_ujq1z_13');

                        // Extract dealer info
                        const dealerNameEl = document.querySelector('[data-testid="dealerName"]');
                        const locationFromTitle = document.querySelector('hgroup p.oqywn.sCSIz');
                        const dealerAddressEl = document.querySelector('[data-testid="dealerAddress"] span[data-track-ui="dealer-address"]');

                        return {
                            vin,
                            title: title || preflight.listingTitle,
                            price: preflight.listingPriceValue || listing.price,
                            priceString: preflight.listingPriceString || listing.priceString,
                            year: yearEl ? yearEl.textContent.trim() : (listing.year || preflight.listingYear),
                            make: listing.make || preflight.listingMake,
                            model: listing.model || preflight.listingModel,
                            trim: listing.trim,
                            mileage: listing.mileage || listing.odometer,
                            dealerName: dealerNameEl ? dealerNameEl.textContent.trim() : (listing.dealerName || preflight.listingSellerName),
                            dealerCity: locationFromTitle ? locationFromTitle.textContent.trim() : (listing.dealerCity || preflight.listingSellerCity),
                            dealerAddress: dealerAddressEl ? dealerAddressEl.textContent.trim() : null,
                            dealRating: listing.dealRating || listing.dealBadge,
                            bodyType: bodyTypeEl ? bodyTypeEl.textContent.trim() : listing.bodyType,
                            fuelType: fuelTypeEl ? fuelTypeEl.textContent.trim() : fuelType,
                            url: window.location.href,
                            source: 'dom',
                            hasApiData: false
                        };
                    });
                    carData.pageNumber = pageToScrape;
                    carData.searchRadius = searchRadius;
                }

                console.log(`  VIN: ${carData.vin || 'NOT FOUND'}`);
                console.log(`  Title: ${carData.title || 'NOT FOUND'}`);
                console.log(`  Price: ${carData.priceString || carData.price || 'NOT FOUND'}`);
                console.log(`  Year: ${carData.year || 'NOT FOUND'}`);
                console.log(`  Mileage: ${carData.mileageString || carData.mileage || 'NOT FOUND'}`);
                console.log(`  Body Type: ${carData.bodyType || 'NOT FOUND'}`);
                console.log(`  Fuel Type: ${carData.fuelType || 'NOT FOUND'}`);
                console.log(`  Dealer: ${carData.dealerName || 'NOT FOUND'} - ${carData.dealerCity || 'NOT FOUND'}`);
                console.log(`  Source: ${carData.source} (API: ${carData.hasApiData})`);

                // Save car data
                if (carData.vin || carData.title) {
                    const dataToSave = {
                        type: 'car_listing',
                        ...carData,
                        scrapedAt: new Date().toISOString()
                    };

                    await Actor.pushData(dataToSave);
                    console.log(`  ✅ Saved to dataset`);

                    // Send to webhook
                    try {
                        const webhookUrl = 'https://n8n-production-0d7d.up.railway.app/webhook/cargurus';
                        const response = await fetch(webhookUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(dataToSave)
                        });

                        if (response.ok) {
                            console.log(`  📤 Sent to webhook (${response.status})`);
                        } else {
                            console.log(`  ⚠️ Webhook failed: ${response.status}`);
                        }
                    } catch (webhookError) {
                        console.log(`  ⚠️ Webhook error: ${webhookError.message}`);
                    }
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

        } // End of page loop

        // Save state for next run - save the next batch starting page
        const lastPageScraped = pagesToScrape[pagesToScrape.length - 1];
        const nextPage = lastPageScraped + 1;
        const today = new Date().toISOString().split('T')[0];

        await kv.setValue('state', {
            nextPage,
            lastScrapedDate: today,
            baseUrl: baseUrlWithFilters,
            searchRadius,
            lastScraped: new Date().toISOString(),
            lastPage: lastPageScraped,
            pagesScraped: pagesToScrape
        });

        console.log(`\n💾 State saved: Next run will start at page ${nextPage} (date: ${today})`);

    } catch (error) {
        console.error(`❌ Error processing pages ${pagesToScrape.join(', ')}:`, error.message);
    }

    await browser.close();
    console.log('\n✅ Scraping complete!');
});
