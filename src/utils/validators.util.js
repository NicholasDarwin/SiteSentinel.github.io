/**
 * URL and Input Validators
 */

function validateUrl(urlString) {
  try {
    if (typeof urlString !== 'string') return null;
    let s = urlString.trim();
    if (!s) return null;

    // If the user didn't provide a protocol (e.g. "google.com"), assume https
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
      s = 'https://' + s;
    }

    const parsed = new URL(s);
    // Ensure it's http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    // Allow localhost, valid domain names, and IP addresses
    const hostname = parsed.hostname;
    const isDomain = isValidDomain(hostname);
    const isIPv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const isIPv6 = /^[0-9a-fA-F:]+$/.test(hostname) || /^\[[0-9a-fA-F:]+\]$/.test(hostname);

    if (hostname !== 'localhost' && !isDomain && !isIPv4 && !isIPv6) {
      return null;
    }

    return parsed.href;
  } catch (error) {
    return null;
  }
}

function isValidDomain(domain) {
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return null;
  }
}

module.exports = {
  validateUrl,
  isValidDomain,
  getHostname
};
