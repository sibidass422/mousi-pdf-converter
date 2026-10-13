/**
 * GhostPDF - Core Application Coordinator & Utilities
 * Handles Themes, Tabs, Toasts, Progress, and Global Helpers
 */

const App = {
  theme: 'dark',
  currentTab: 'cutter',

  init() {
    this.initTheme();
    this.initTabs();
    this.initPdfJs();
    this.initModal();
  },

  // Setup PDF.js worker safely across all environments (file:// or http://)
  initPdfJs() {
    if (typeof pdfjsLib !== 'undefined') {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
      } catch (err) {
        console.warn('PDF.js worker initialization notice:', err);
      }
    }
  },

  // Theme Management (Dark / Light)
  initTheme() {
    const savedTheme = localStorage.getItem('ghostpdf_theme') || 'dark';
    this.setTheme(savedTheme);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
      });
    }
  },

  setTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ghostpdf_theme', theme);

    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (icon && text) {
      if (theme === 'dark') {
        icon.textContent = '🌙';
        text.textContent = 'Dark';
      } else {
        icon.textContent = '☀️';
        text.textContent = 'Light';
      }
    }
  },

  // Tab Switching
  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update tab content panes
    document.querySelectorAll('.tab-content').forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  },

  // Progress Bar Helper
  showProgress(percentage, statusText) {
    const card = document.getElementById('global-progress-card');
    const fill = document.getElementById('global-progress-fill');
    const status = document.getElementById('progress-status-text');
    const pct = document.getElementById('progress-percentage-text');

    if (card && fill && status && pct) {
      card.classList.add('active');
      fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
      status.textContent = statusText || 'Processing...';
      pct.textContent = `${Math.round(percentage)}%`;
    }
  },

  hideProgress() {
    const card = document.getElementById('global-progress-card');
    if (card) {
      card.classList.remove('active');
      const fill = document.getElementById('global-progress-fill');
      if (fill) fill.style.width = '0%';
    }
  },

  // Toast Notifications
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `
      ${iconSvg}
      <span style="flex: 1;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  },

  // Modal Preview Dialog
  initModal() {
    const modal = document.getElementById('preview-modal');
    const closeBtn = document.getElementById('modal-close-btn');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    }
  },

  openPreview(sourceCanvas, title = 'Page Preview') {
    const modal = document.getElementById('preview-modal');
    const modalTitle = document.getElementById('modal-page-title');
    const modalBody = document.getElementById('modal-preview-body');

    if (!modal || !modalBody) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = '';

    const newCanvas = document.createElement('canvas');
    newCanvas.width = sourceCanvas.width;
    newCanvas.height = sourceCanvas.height;
    const ctx = newCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);

    modalBody.appendChild(newCanvas);
    modal.classList.add('active');
  },

  // Byte formatting helper
  formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  // Safe file downloader
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }
};

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
