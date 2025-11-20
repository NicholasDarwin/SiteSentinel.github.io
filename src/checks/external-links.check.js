/**
 * External Links Check
 * Lists all external links found on the page
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { calculateCategoryScore } = require('../utils/score-calculator.util');

class ExternalLinksCheck {
  async analyze(url) {
    const checks = [];
    const hostname = new URL(url).hostname;

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        validateStatus: () => true,
        maxRedirects: 3
      });

      const $ = cheerio.load(response.data);
      const externalLinks = [];

      // Extract all links from the page
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('#')) {
          try {
            // Convert relative URLs to absolute
            const absoluteUrl = new URL(href, url).href;
            const linkHostname = new URL(absoluteUrl).hostname;
            
            // Track external links (different domain)
            if (linkHostname !== hostname) {
              externalLinks.push(absoluteUrl);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });

      // Remove duplicates
      const uniqueExternalLinks = [...new Set(externalLinks)];

      // Generate checks
      checks.push({
        name: 'External Links Detected',
        status: uniqueExternalLinks.length === 0 ? 'info' : 'pass',
        description: uniqueExternalLinks.length === 0 
          ? 'No external links found on this page'
          : `Found ${uniqueExternalLinks.length} unique external link${uniqueExternalLinks.length !== 1 ? 's' : ''}`,
        severity: 'low'
      });

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

      return {
        category: 'External Links',
        icon: '🌍',
        score: calculateCategoryScore(checks),
        checks,
        externalLinks: uniqueExternalLinks,
        externalDomains: uniqueDomains
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
        externalDomains: []
      };
    }
  }
}

module.exports = ExternalLinksCheck;
