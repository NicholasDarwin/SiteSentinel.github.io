/**
 * AI Routes for Security & Safety Insights
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();
const logger = require('../utils/logger.util');

const ENABLE_AI = String(process.env.ENABLE_AI || process.env.ENABLE_GPT5 || '0')
  .toLowerCase() === '1' || String(process.env.ENABLE_AI || '').toLowerCase() === 'true';

router.get('/enabled', (req, res) => {
  res.json({ enabled: ENABLE_AI });
});

/**
 * POST /api/ai/quick-assessment
 * Body: { report: <SiteSentinel JSON>, url?: string }
 * Returns: { score: 0-100, message: string }
 */
router.post('/quick-assessment', async (req, res) => {
  try {
    if (!ENABLE_AI) {
      return res.status(403).json({ error: 'AI disabled on server' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const { report, url } = req.body || {};
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid report JSON' });
    }

    const systemPrompt = [
      'You are SiteSentinel AI Security Auditor.',
      'Given a website analysis report, provide:',
      '1. A security score (0-100, where 100 = perfect security)',
      '2. A 1-2 sentence summary of the site\'s security posture',
      'Consider: vulnerabilities, missing headers, malware/phishing indicators, SSL issues, DNS problems.',
      'Format response EXACTLY as JSON: {"score": <number>, "message": "<string>"}',
      'Be direct and specific. Prioritize critical issues.',
    ].join('\n');

    const safeReport = JSON.stringify(report);
    const limitedReport = safeReport.length > 100000 ? safeReport.slice(0, 100000) + '...<truncated>' : safeReport;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `URL: ${url || report.url || 'unknown'}\n\nReport JSON:\n${limitedReport}\n\nProvide your assessment as JSON.`
      }
    ];

    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-5',
        temperature: 0.3,
        messages,
        response_format: { type: 'json_object' }
      },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = resp?.data?.choices?.[0]?.message?.content?.trim() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = { score: 50, message: 'Unable to parse AI assessment.' };
    }

    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50;
    const message = typeof parsed.message === 'string' ? parsed.message : 'AI assessment unavailable.';

    res.json({ score, message });
  } catch (err) {
    logger.error('AI quick assessment error:', err?.response?.data || err?.message || err);
    res.json({ score: 50, message: 'AI assessment temporarily unavailable.' });
  }
});

/**
 * POST /api/ai/security-insights
 * Body: { report: <SiteSentinel JSON>, question?: string, url?: string }
 */
router.post('/security-insights', async (req, res) => {
  try {
    if (!ENABLE_AI) {
      return res.status(403).json({ error: 'AI disabled on server' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const { report, question, url } = req.body || {};
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid report JSON' });
    }

    const systemPrompt = [
      'You are SiteSentinel AI Security Analyst.',
      'Given a website analysis report (security, DNS, performance, SEO, accessibility, safety),',
      'identify vulnerabilities and safety risks, explain impact, and propose prioritized fixes.',
      'Output strictly in this format:',
      '- Findings: bullet list of "issue -> impact -> fix"',
      '- Quick Checklist: 5-8 short prioritized actions',
      '- Risk Score: 0-100 (higher = safer)',
      'Keep concise, technical, and actionable. Avoid speculation beyond provided data.',
    ].join('\n');

    // Trim huge payloads defensively
    const safeReport = JSON.stringify(report);
    const limitedReport = safeReport.length > 120000 ? safeReport.slice(0, 120000) + '...<truncated>' : safeReport;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `URL: ${url || report.url || 'unknown'}\nQuestion: ${question || 'What are the most critical vulnerabilities and safety risks and how do we fix them?'}\n\nReport JSON:\n${limitedReport}`
      }
    ];

    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-5',
        temperature: 0.2,
        messages
      },
      {
        timeout: 25000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const answer = resp?.data?.choices?.[0]?.message?.content?.trim() || 'No answer.';
    res.json({ answer });
  } catch (err) {
    logger.error('AI insights error:', err?.response?.data || err?.message || err);
    const detail = err?.response?.data || err?.message || 'Unknown error';
    res.status(502).json({ error: 'AI provider error', detail });
  }
});

module.exports = router;
