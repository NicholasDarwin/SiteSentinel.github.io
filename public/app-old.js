// ─────────────────────────────────────────────────────────────
// SiteSentinel - Frontend Application
// ─────────────────────────────────────────────────────────────

class SiteSentinelApp {
  constructor() {
    this.form = document.getElementById('analysisForm');
    this.urlInput = document.getElementById('urlInput');
    this.resultsSection = document.getElementById('resultsSection');
    this.categoriesGrid = document.getElementById('categoriesGrid');
    this.overallScore = document.getElementById('overallScore');
    this.scoreLabel = document.getElementById('scoreLabel');
    this.scoreBreakdown = document.getElementById('scoreBreakdown');
    this.analyzedUrl = document.getElementById('analyzedUrl');
    this.newAnalysisBtn = document.getElementById('newAnalysisBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.submitBtn = this.form.querySelector('button[type="submit"]');
    
    this.analysisData = null;
    this.bindEvents();
  }

  bindEvents() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.newAnalysisBtn?.addEventListener('click', () => this.resetForm());
    this.exportBtn?.addEventListener('click', () => this.exportReport());
    
    // Close modal
    const modal = document.getElementById('checkModal');
    const modalClose = document.querySelector('.modal-close');
    modalClose?.addEventListener('click', () => modal.style.display = 'none');
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  handleSubmit(e) {
    e.preventDefault();
    const url = this.urlInput.value.trim();

    if (!url) {
      alert('Please enter a valid URL');
      return;
    }

    this.analyzeUrl(url);
  }

  async analyzeUrl(url) {
    // Show loading state
    this.resultsSection.style.display = 'none';
    this.submitBtn.disabled = true;
    this.submitBtn.querySelector('.btn-text').style.display = 'none';
    this.submitBtn.querySelector('.btn-loading').style.display = 'inline';

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
      this.analysisData = data;
      this.displayResults(data);
    } catch (error) {
      alert(`Error: ${error.message}`);
      console.error('Analysis error:', error);
    } finally {
      this.submitBtn.disabled = false;
      this.submitBtn.querySelector('.btn-text').style.display = 'inline';
      this.submitBtn.querySelector('.btn-loading').style.display = 'none';
    }
  }

  displayResults(data) {
    // Update overall score
    this.overallScore.textContent = data.overall.score;
    this.scoreLabel.textContent = data.overall.label;
    
    // Update URL
    this.analyzedUrl.textContent = data.url;

    // Display categories
    this.categoriesGrid.innerHTML = '';
    
    data.categories.forEach(category => {
      const card = this.createCategoryCard(category);
      this.categoriesGrid.appendChild(card);
    });

    // Show results section
    this.resultsSection.style.display = 'block';
    this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'category-card';
    
    const scoreColor = this.getScoreColor(category.score);
    const scoreLabel = this.getScoreLabel(category.score);
    
    card.innerHTML = `
      <div class="category-card-header">
        <div class="category-icon">${category.icon}</div>
        <div class="category-title">
          <h3>${category.category}</h3>
          <div class="category-score">${category.checks.length} checks</div>
        </div>
        <div class="category-badge" style="background: ${scoreColor}">
          ${category.score}/100
        </div>
      </div>
      <div class="category-body">
        <ul class="check-list">
          ${category.checks.map(check => this.createCheckItem(check)).join('')}
        </ul>
      </div>
    `;

    // Toggle expand/collapse
    card.querySelector('.category-card-header').addEventListener('click', () => {
      card.classList.toggle('expanded');
      card.querySelector('.category-body').style.display = 
        card.classList.contains('expanded') ? 'block' : 'none';
    });

    // Set expanded by default
    card.classList.add('expanded');

    return card;
  }

  createCheckItem(check) {
    const statusIcon = this.getStatusIcon(check.status);
    return `
      <li class="check-item">
        <div class="check-icon">${statusIcon}</div>
        <div class="check-details">
          <div class="check-name">${check.name}</div>
          <div class="check-description">${check.description}</div>
        </div>
      </li>
    `;
  }

  getStatusIcon(status) {
    const icons = {
      pass: '✅',
      warn: '⚠️',
      info: 'ℹ️',
      fail: '❌',
      error: '🔴'
    };
    return icons[status] || '•';
  }

  getScoreColor(score) {
    if (score >= 90) return '#10b981'; // green
    if (score >= 75) return '#3b82f6'; // blue
    if (score >= 60) return '#f59e0b'; // amber
    if (score >= 45) return '#ef4444'; // red
    return '#dc2626'; // dark red
  }

  getScoreLabel(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 45) return 'Poor';
    return 'Critical';
  }

  resetForm() {
    this.urlInput.value = '';
    this.urlInput.focus();
    this.resultsSection.style.display = 'none';
    this.categoriesGrid.innerHTML = '';
  }

  exportReport() {
    if (!this.analysisData) {
      alert('No analysis data to export');
      return;
    }

    const report = this.generateReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SiteSentinel-Report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  generateReport() {
    const data = this.analysisData;
    let report = `
╔════════════════════════════════════════════════════════╗
║           SiteSentinel - Analysis Report               ║
╚════════════════════════════════════════════════════════╝

URL: ${data.url}
Analyzed: ${data.timestamp}
Overall Score: ${data.overall.score}/100 (${data.overall.label})

════════════════════════════════════════════════════════════

`;

    data.categories.forEach(category => {
      report += `\n${category.icon} ${category.category} - ${category.score}/100\n`;
      report += '─'.repeat(60) + '\n\n';
      
      category.checks.forEach(check => {
        const icon = this.getStatusIcon(check.status);
        report += `${icon} ${check.name}\n`;
        report += `   Status: ${check.status.toUpperCase()}\n`;
        report += `   ${check.description}\n\n`;
      });
    });

    report += '\n════════════════════════════════════════════════════════════\n';
    report += 'Generated by SiteSentinel - https://github.com/NicholasDarwin/SiteSentinel\n';

    return report;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SiteSentinelApp();
});
      }

      const results = await response.json();
      this.displayResults(results);
    } catch (error) {
      console.error('Error:', error);
      this.showError(error.message);
    } finally {
      this.submitBtn.disabled = false;
      this.submitBtn.querySelector('.btn-text').style.display = 'inline';
      this.submitBtn.querySelector('.btn-loader').style.display = 'none';
    }
  }

  showLoading() {
    this.resultsSection.style.display = 'none';
    this.errorSection.style.display = 'none';
    this.loadingSection.style.display = 'block';
  }

  showError(message) {
    this.resultsSection.style.display = 'none';
    this.loadingSection.style.display = 'none';
    this.errorSection.style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
  }

  displayResults(results) {
    this.loadingSection.style.display = 'none';
    this.errorSection.style.display = 'none';
    this.resultsSection.style.display = 'block';

    // Update summary
    document.getElementById('analyzedUrl').textContent = results.url;
    document.getElementById('analyzedTime').textContent = new Date(results.timestamp).toLocaleString();

    const summary = results.summary;
    document.getElementById('passedCount').textContent = summary.passed;
    document.getElementById('warningCount').textContent = summary.warnings;
    document.getElementById('failedCount').textContent = summary.failed;
    document.getElementById('totalCount').textContent = summary.total_checks;

    const scoreElement = document.getElementById('scoreValue');
    scoreElement.textContent = summary.score;
    const scoreCircle = document.getElementById('scoreCircle');
    scoreCircle.className = 'score-circle ' + this.getScoreClass(summary.score);

    // Display categories
    this.displayCategories(results.categories);

    // Scroll to results
    window.scrollTo({ top: document.querySelector('.summary-card').offsetTop - 100, behavior: 'smooth' });
  }

  getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'warning';
    return 'poor';
  }

  displayCategories(categories) {
    this.categoriesContainer.innerHTML = '';

    categories.forEach((category, index) => {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'category';

      // Calculate category statistics
      const passed = category.checks.filter(c => c.status === 'pass').length;
      const warnings = category.checks.filter(c => c.status === 'warning').length;
      const failed = category.checks.filter(c => c.status === 'fail').length;

      const headerEl = document.createElement('div');
      headerEl.className = 'category-header';
      headerEl.innerHTML = `
        <h3>${this.escapeHtml(category.name)}</h3>
        <div style="font-size: 0.9em; color: var(--text-secondary); margin-left: 10px;">
          <span style="color: var(--success-color); font-weight: 600;">${passed}</span>
          <span style="color: var(--warning-color); font-weight: 600; margin-left: 10px;">${warnings}</span>
          <span style="color: var(--danger-color); font-weight: 600; margin-left: 10px;">${failed}</span>
          <span class="toggle-icon" style="margin-left: 20px;">▶</span>
        </div>
      `;

      const checksEl = document.createElement('div');
      checksEl.className = 'category-checks';

      category.checks.forEach(check => {
        const checkEl = document.createElement('div');
        checkEl.className = `check-item check-${check.status}`;

        const statusEmoji = check.status === 'pass' ? '✅' : 
                          check.status === 'warning' ? '⚠️' : '❌';

        let recommendationsHtml = '';
        if (check.recommendations && check.recommendations.length > 0) {
          recommendationsHtml = `
            <div class="recommendations">
              <strong>💡 Recommendations:</strong>
              <ul>
                ${check.recommendations.map(rec => `<li>${this.escapeHtml(rec)}</li>`).join('')}
              </ul>
            </div>
          `;
        }

        checkEl.innerHTML = `
          <div class="check-status">${statusEmoji}</div>
          <div class="check-content">
            <div class="check-name">${this.escapeHtml(check.name)}</div>
            <div class="check-details">${this.escapeHtml(check.details)}</div>
            ${recommendationsHtml}
          </div>
        `;

        checksEl.appendChild(checkEl);
      });

      // Toggle functionality
      let isCollapsed = index > 2; // Collapse categories after first 3
      if (isCollapsed) {
        checksEl.classList.add('collapsed');
        headerEl.classList.add('collapsed');
      }

      headerEl.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        checksEl.classList.toggle('collapsed');
        headerEl.classList.toggle('collapsed');
      });

      categoryEl.appendChild(headerEl);
      categoryEl.appendChild(checksEl);
      this.categoriesContainer.appendChild(categoryEl);
    });
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  exportReport() {
    const summary = {
      url: document.getElementById('analyzedUrl').textContent,
      analyzed: document.getElementById('analyzedTime').textContent,
      score: document.getElementById('scoreValue').textContent,
      passed: document.getElementById('passedCount').textContent,
      warnings: document.getElementById('warningCount').textContent,
      failed: document.getElementById('failedCount').textContent,
      total: document.getElementById('totalCount').textContent
    };

    // Extract all checks
    const categories = [];
    document.querySelectorAll('.category').forEach(catEl => {
      const categoryName = catEl.querySelector('.category-header h3').textContent;
      const checks = [];

      catEl.querySelectorAll('.check-item').forEach(checkEl => {
        const status = checkEl.classList[1].replace('check-', '');
        const name = checkEl.querySelector('.check-name').textContent;
        const details = checkEl.querySelector('.check-details').textContent;

        checks.push({ status, name, details });
      });

      categories.push({ name: categoryName, checks });
    });

    // Create CSV content
    let csv = 'SiteSentinel Security Analysis Report\n';
    csv += `URL: ${summary.url}\n`;
    csv += `Analyzed: ${summary.analyzed}\n`;
    csv += `Overall Score: ${summary.score}/100\n\n`;
    csv += `Summary:\n`;
    csv += `Passed: ${summary.passed}\n`;
    csv += `Warnings: ${summary.warnings}\n`;
    csv += `Failed: ${summary.failed}\n`;
    csv += `Total Checks: ${summary.total}\n\n`;
    csv += `Detailed Results:\n\n`;

    categories.forEach(cat => {
      csv += `${cat.name}\n`;
      csv += '---\n';
      cat.checks.forEach(check => {
        csv += `[${check.status.toUpperCase()}] ${check.name}: ${check.details}\n`;
      });
      csv += '\n';
    });

    // Download
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `sitesentinel-report-${new Date().toISOString().split('T')[0]}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SiteSentinelApp();

  // Set focus to input
  document.getElementById('urlInput').focus();
});
