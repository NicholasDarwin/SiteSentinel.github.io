# SiteSentinel - Website Security Analysis Platform

A professional website security analysis tool with **60+ comprehensive checks** for SSL/TLS, DNS, performance, SEO, accessibility, and safety.

## Features

- 🔒 **Security & HTTPS** - SSL/TLS certificates, HSTS headers, CSP policies
- 🌐 **DNS & Domain** - DNS resolution, MX records, SPF, DMARC
- ⚡ **Performance** - Load times, compression, caching, CDN usage
- 📊 **SEO & Metadata** - Meta tags, structured data, Open Graph
- ♿ **Accessibility** - WCAG 2.1 compliance, alt text, ARIA attributes
- ⚠️ **Safety & Threats** - Malware indicators, XSS protection, injection prevention

## Quick Start

Simply enter a URL and SiteSentinel will analyze it across all 6 security categories!

## Project Structure

```
SiteSentinel/
├── src/
│   ├── checks/       (6 security check modules)
│   ├── routes/       (API endpoints)
│   ├── utils/        (utilities)
│   └── server.js     (Express server)
├── public/           (frontend files)
├── docs/             (GitHub Pages)
└── package.json
```

## Technologies

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **APIs**: Axios for HTTP requests, Cheerio for DOM parsing, DNS module

## GitHub Repository

[SiteSentinel on GitHub](https://github.com/NicholasDarwin/SiteSentinel)

## License

MIT
