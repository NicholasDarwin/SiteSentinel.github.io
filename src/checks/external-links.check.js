/**
 * External Links Check
 * Lists all external links found on the page using Puppeteer for dynamic content
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { calculateCategoryScore } = require('../utils/score-calculator.util');

class ExternalLinksCheck {
  async analyze(url) {
    const checks = [];
    const hostname = new URL(url).hostname;

    try {
      // Try to use Puppeteer for dynamic link detection if available
      // Dynamic link & redirect discovery (Puppeteer)
      let dynamicLinks = [];
      let redirectLinks = [];
      try {
        const puppeteer = require('puppeteer');
        const dynamicResult = await this.extractDynamicLinks(url, hostname, puppeteer);
        if (Array.isArray(dynamicResult)) {
          dynamicLinks = dynamicResult;
        } else if (dynamicResult && typeof dynamicResult === 'object') {
          dynamicLinks = dynamicResult.links || [];
          redirectLinks = dynamicResult.redirectLinks || [];
        }
      } catch (puppeteerError) {
        // Puppeteer not available, continue with static analysis only
        console.log('Puppeteer not available, using static analysis only');
      }

      const response = await axios.get(url, {
        timeout: 15000,
        validateStatus: () => true,
        maxRedirects: 3
      });

      const $ = cheerio.load(response.data);
      const externalLinks = [];

      // Extract all <a> tag links
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('#')) {
          try {
            const absoluteUrl = new URL(href, url).href;
            const linkHostname = new URL(absoluteUrl).hostname;
            
            if (linkHostname !== hostname) {
              externalLinks.push(absoluteUrl);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });

      // Extract links from button onclick attributes
      $('button[onclick], input[onclick], div[onclick], span[onclick], a[onclick]').each((i, el) => {
        const onclick = $(el).attr('onclick');
        if (onclick) {
          // Match window.open, location.href, location.assign patterns
          const urlPatterns = [
            /window\.open\s*\(\s*['"]([^'"]+)['"]/gi,
            /location\.href\s*=\s*['"]([^'"]+)['"]/gi,
            /location\.assign\s*\(\s*['"]([^'"]+)['"]/gi,
            /location\s*=\s*['"]([^'"]+)['"]/gi,
            /window\.location\s*=\s*['"]([^'"]+)['"]/gi
          ];

          for (const pattern of urlPatterns) {
            let match;
            while ((match = pattern.exec(onclick)) !== null) {
              try {
                const absoluteUrl = new URL(match[1], url).href;
                const linkHostname = new URL(absoluteUrl).hostname;
                
                if (linkHostname !== hostname) {
                  externalLinks.push(absoluteUrl);
                }
              } catch (e) {
                // Skip invalid URLs
              }
            }
          }
        }
      });

      // Extract links from inline JavaScript in script tags
      const scripts = $('script').toArray();
      for (const script of scripts) {
        const scriptContent = $(script).html() || '';
        
        const urlPatterns = [
          /window\.open\s*\(\s*['"]([^'"]+)['"]/gi,
          /location\.href\s*=\s*['"]([^'"]+)['"]/gi,
          /location\.assign\s*\(\s*['"]([^'"]+)['"]/gi,
          /window\.location\s*=\s*['"]([^'"]+)['"]/gi,
          /window\.location\.replace\s*\(\s*['"]([^'"]+)['"]/gi,
          /['"]https?:\/\/[^'"]+['"]/gi  // Any quoted URLs
        ];

        for (const pattern of urlPatterns) {
          let match;
          while ((match = pattern.exec(scriptContent)) !== null) {
            let extractedUrl = match[1] || match[0].replace(/['"]/g, '');
            
            // Clean up the URL
            extractedUrl = extractedUrl.trim();
            
            if (extractedUrl.startsWith('http://') || extractedUrl.startsWith('https://')) {
              try {
                const absoluteUrl = new URL(extractedUrl).href;
                const linkHostname = new URL(absoluteUrl).hostname;
                
                if (linkHostname !== hostname) {
                  externalLinks.push(absoluteUrl);
                }
              } catch (e) {
                // Skip invalid URLs
              }
            }
          }
        }
      }

      // Extract popup/modal links from data attributes
      $('[data-url], [data-href], [data-link], [data-popup-url]').each((i, el) => {
        const dataAttrs = ['data-url', 'data-href', 'data-link', 'data-popup-url'];
        
        for (const attr of dataAttrs) {
          const dataUrl = $(el).attr(attr);
          if (dataUrl) {
            try {
              const absoluteUrl = new URL(dataUrl, url).href;
              const linkHostname = new URL(absoluteUrl).hostname;
              
              if (linkHostname !== hostname) {
                externalLinks.push(absoluteUrl);
              }
            } catch (e) {
              // Skip invalid URLs
            }
          }
        }
      });

      // Extract form action URLs
      $('form[action]').each((i, el) => {
        const action = $(el).attr('action');
        if (action && !action.startsWith('javascript:') && !action.startsWith('#')) {
          try {
            const absoluteUrl = new URL(action, url).href;
            const linkHostname = new URL(absoluteUrl).hostname;
            
            if (linkHostname !== hostname) {
              externalLinks.push(absoluteUrl);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });

      // Extract iframe sources
      $('iframe[src]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !src.startsWith('javascript:') && !src.startsWith('about:')) {
          try {
            const absoluteUrl = new URL(src, url).href;
            const linkHostname = new URL(absoluteUrl).hostname;
            
            if (linkHostname !== hostname) {
              externalLinks.push(absoluteUrl);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });

      // Remove duplicates and merge with dynamic links
      const allLinks = [...externalLinks, ...dynamicLinks, ...redirectLinks];
      const uniqueExternalLinks = [...new Set(allLinks)];

      // Score each external link (limit to first 50 to avoid timeout)
      const linksToScore = uniqueExternalLinks.slice(0, 50);
      const scoredLinks = await Promise.all(
        linksToScore.map(async (link) => {
          const score = await this.scoreExternalLink(link);
          return {
            url: link,
            score: score.score,
            status: score.status,
            issues: score.issues
          };
        })
      );

      // Add remaining links without scoring if more than 50
      const remainingLinks = uniqueExternalLinks.slice(50).map(link => ({
        url: link,
        score: null,
        status: 'Not Scored',
        issues: []
      }));

      checks.push({
        name: 'External Links Detected',
        status: uniqueExternalLinks.length === 0 ? 'info' : 'pass',
        description: uniqueExternalLinks.length === 0 
          ? 'No external links found on this page'
          : `Found ${uniqueExternalLinks.length} unique external link${uniqueExternalLinks.length !== 1 ? 's' : ''}`,
        severity: 'low'
      });

      if (redirectLinks.length > 0) {
        checks.push({
          name: 'Redirect Triggered External Destinations',
          status: 'warn',
          description: `Detected ${redirectLinks.length} external navigation${redirectLinks.length !== 1 ? 's' : ''} initiated via scripted redirects / window.location changes`,
          severity: 'medium'
        });
      }

      // Check link diversity
      const domains = uniqueExternalLinks.map(link => {
        try {
          return new URL(link).hostname;
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      const uniqueDomains = [...new Set(domains)];
      
      checks.push({
        name: 'External Domains',
        status: 'info',
        description: `Links point to ${uniqueDomains.length} unique external domain${uniqueDomains.length !== 1 ? 's' : ''}`,
        severity: 'low'
      });

      // Security check on scored links
      const lowScoreLinks = scoredLinks.filter(l => l.score !== null && l.score < 50);
      if (lowScoreLinks.length > 0) {
        checks.push({
          name: 'Potentially Unsafe External Links',
          status: lowScoreLinks.length > 3 ? 'fail' : 'warn',
          description: `${lowScoreLinks.length} external link${lowScoreLinks.length !== 1 ? 's have' : ' has'} security concerns`,
          severity: 'high'
        });
      }

      const allScoredLinks = [...scoredLinks, ...remainingLinks];

      return {
        category: 'External Links',
        icon: '🌍',
        score: calculateCategoryScore(checks),
        checks,
        externalLinks: uniqueExternalLinks,
        externalDomains: uniqueDomains,
        scoredLinks: allScoredLinks
      };
    } catch (error) {
      checks.push({
        name: 'External Links Analysis Error',
        status: 'error',
        description: `Error analyzing external links: ${error.message}`,
        severity: 'medium'
      });

      return {
        category: 'External Links',
        icon: '🌍',
        score: 0,
        checks,
        externalLinks: [],
        externalDomains: [],
        scoredLinks: []
      };
    }
  }

  async scoreExternalLink(linkUrl) {
    let score = 100;
    const issues = [];
    let status = 'Safe';

    try {
      // Check URL patterns for suspicious characteristics
      const urlLower = linkUrl.toLowerCase();
      
      // Suspicious TLDs
      const suspiciousTlds = ['.click', '.loan', '.win', '.download', '.bid', '.racing', '.top', '.stream'];
      if (suspiciousTlds.some(tld => urlLower.includes(tld))) {
        score -= 30;
        issues.push('Suspicious TLD');
        status = 'Warning';
      }

      // Redirect/shortener services
      const redirectServices = ['bit.ly', 'tinyurl', 'goo.gl', 'ow.ly', 'adf.ly', 't.co'];
      if (redirectServices.some(service => urlLower.includes(service))) {
        score -= 20;
        issues.push('URL Shortener');
        status = 'Warning';
      }

      // IP address in URL
      if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(linkUrl)) {
        score -= 25;
        issues.push('Direct IP Address');
        status = 'Warning';
      }

      // Long subdomain (common in phishing)
      try {
        const hostname = new URL(linkUrl).hostname;
        const parts = hostname.split('.');
        if (parts.length > 4) {
          score -= 15;
          issues.push('Multiple Subdomains');
        }
      } catch (e) {}

      // Try to check if URL is accessible
      try {
        const response = await axios.head(linkUrl, {
          timeout: 5000,
          maxRedirects: 0,
          validateStatus: () => true
        });

        if (response.status === 404) {
          score -= 40;
          issues.push('Link Not Found (404)');
          status = 'Broken';
        } else if (response.status >= 500) {
          score -= 20;
          issues.push('Server Error');
          status = 'Warning';
        } else if (response.status >= 300 && response.status < 400) {
          score -= 10;
          issues.push('Redirects');
        }

        // Check for HTTPS
        if (!linkUrl.startsWith('https://')) {
          score -= 15;
          issues.push('No HTTPS');
          status = 'Warning';
        }
      } catch (error) {
        // Connection issues
        score -= 30;
        issues.push('Cannot Connect');
        status = 'Unreachable';
      }

      // Determine final status
      if (score < 40) {
        status = 'Unsafe';
      } else if (score < 70) {
        status = 'Warning';
      } else {
        status = 'Safe';
      }

      return {
        score: Math.max(0, Math.min(100, score)),
        status,
        issues
      };
    } catch (error) {
      return {
        score: 50,
        status: 'Unknown',
        issues: ['Analysis Error']
      };
    }
  }

  async extractDynamicLinks(url, hostname, puppeteer) {
    const dynamicLinks = [];
    const redirectLinks = new Set();
    let browser = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();

      // Instrument redirect/navigation APIs before any script runs
      await page.evaluateOnNewDocument(() => {
        window.__redirectLog = [];
        function log(u) {
          try { if (u && (u.startsWith('http://') || u.startsWith('https://'))) window.__redirectLog.push(u); } catch(e) {}
        }
        const origOpen = window.open;
        window.open = function(u) { log(u); return origOpen.apply(this, arguments); };
        ['assign','replace'].forEach(fn => {
          const orig = window.location[fn];
          window.location[fn] = function(u) { log(u); return orig.call(window.location, u); };
        });
        const hrefDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
        if (hrefDesc && hrefDesc.set) {
          Object.defineProperty(window.location, 'href', {
            set(u){ log(u); return hrefDesc.set.call(window.location, u); },
            get(){ return hrefDesc.get.call(window.location); }
          });
        }
        const origPush = history.pushState;
        history.pushState = function(state, title, url){ if (url) log(url.toString()); return origPush.apply(history, arguments); };
        const origReplace = history.replaceState;
        history.replaceState = function(state, title, url){ if (url) log(url.toString()); return origReplace.apply(history, arguments); };
      });
      
      // Track all network requests for external links
      const requestedUrls = new Set();
      page.on('request', request => {
        const requestUrl = request.url();
        try {
          const requestHostname = new URL(requestUrl).hostname;
          if (requestHostname !== hostname && (requestUrl.startsWith('http://') || requestUrl.startsWith('https://'))) {
            requestedUrls.add(requestUrl);
          }
        } catch (e) {
          // Skip invalid URLs
        }
      });

      // Capture navigation events (frame navigations)
      page.on('framenavigated', frame => {
        try {
          const navUrl = frame.url();
          const navHost = new URL(navUrl).hostname;
          if (navHost !== hostname && (navUrl.startsWith('http://') || navUrl.startsWith('https://'))) {
            redirectLinks.add(navUrl);
          }
        } catch(e) {}
      });

      // Capture explicit redirect response Location headers
      page.on('response', response => {
        try {
          const status = response.status();
          if (status >= 300 && status < 400) {
            const headers = response.headers();
            const loc = headers['location'];
            if (loc) {
              let absolute;
              try { absolute = new URL(loc, response.url()).href; } catch(e) { absolute = loc; }
              const host = new URL(absolute).hostname;
              if (host !== hostname) redirectLinks.add(absolute);
            }
          }
        } catch(e) {}
      });

      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Extract all links from the page after JavaScript execution
      const extractedLinks = await page.evaluate((pageHostname) => {
        const links = [];
        
        // Get all anchor tags
        document.querySelectorAll('a[href]').forEach(el => {
          const href = el.href;
          if (href) {
            try {
              const linkHostname = new URL(href).hostname;
              if (linkHostname !== pageHostname) {
                links.push(href);
              }
            } catch (e) {}
          }
        });

        // Get all elements with onclick
        document.querySelectorAll('[onclick]').forEach(el => {
          const onclick = el.getAttribute('onclick');
          if (onclick) {
            const urlMatches = onclick.match(/['"]https?:\/\/[^'"]+['"]/g);
            if (urlMatches) {
              urlMatches.forEach(match => {
                const url = match.replace(/['"]/g, '');
                try {
                  const linkHostname = new URL(url).hostname;
                  if (linkHostname !== pageHostname) {
                    links.push(url);
                  }
                } catch (e) {}
              });
            }
          }
        });

        // Get form actions
        document.querySelectorAll('form[action]').forEach(el => {
          const action = el.action;
          if (action) {
            try {
              const linkHostname = new URL(action).hostname;
              if (linkHostname !== pageHostname) {
                links.push(action);
              }
            } catch (e) {}
          }
        });

        // Get iframes
        document.querySelectorAll('iframe[src]').forEach(el => {
          const src = el.src;
          if (src) {
            try {
              const linkHostname = new URL(src).hostname;
              if (linkHostname !== pageHostname) {
                links.push(src);
              }
            } catch (e) {}
          }
        });

        return links;
      }, hostname);

      dynamicLinks.push(...extractedLinks);

      // Click on all clickable elements and capture any navigation attempts
      await page.evaluate(() => {
        const clickableSelectors = [
          'button', 'a', '[role="button"]', '[onclick]', 
          'input[type="button"]', 'input[type="submit"]',
          '[data-url]', '[data-href]', '[data-link]'
        ];
        
        clickableSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach((el, index) => {
            // Only click first 50 of each type to avoid too many interactions
            if (index < 50) {
              try {
                el.click();
              } catch (e) {}
            }
          });
        });
      });

      // Wait for potential scripted redirects after clicks
      await page.waitForTimeout(2500);

      // Extract links again after clicking
      const afterClickLinks = await page.evaluate((pageHostname) => {
        const links = [];
        document.querySelectorAll('a[href]').forEach(el => {
          const href = el.href;
          if (href) {
            try {
              const linkHostname = new URL(href).hostname;
              if (linkHostname !== pageHostname) {
                links.push(href);
              }
            } catch (e) {}
          }
        });
        return links;
      }, hostname);

      dynamicLinks.push(...afterClickLinks);

      // Collect redirect log from instrumented APIs
      try {
        const apiRedirects = await page.evaluate(() => Array.isArray(window.__redirectLog) ? window.__redirectLog : []);
        apiRedirects.forEach(u => redirectLinks.add(u));
      } catch(e) {}

      // Add all network-requested URLs
      dynamicLinks.push(...Array.from(requestedUrls));

      await browser.close();

      return {
        links: [...new Set(dynamicLinks)],
        redirectLinks: [...redirectLinks]
      }; // Remove duplicates, provide redirect list separately
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      console.error('Dynamic link extraction error:', error.message);
      return { links: [...new Set(dynamicLinks)], redirectLinks: [...redirectLinks] };
    }
  }
}

module.exports = ExternalLinksCheck;
