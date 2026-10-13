/**
 * GhostPDF - PDF Cutter & Page Extractor Module
 * Allows cutting specific page ranges (e.g., 20 to 23 out of 100 pages),
 * visual thumbnail selection, splitting into zip, or deleting pages.
 */

const PdfCutter = {
  currentPdfFile: null,
  currentPdfDoc: null, // pdf-lib document
  pdfJsDoc: null,      // pdf.js document
  totalPages: 0,
  selectedPages: new Set(), // 1-indexed page numbers
  pageThumbnails: new Map(), // pageNum -> rendered canvas

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const dropzone = document.getElementById('cutter-dropzone');
    const fileInput = document.getElementById('cutter-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFile(e.target.files[0]);
        }
      });
    }

    // Range input & buttons
    document.getElementById('btn-apply-range')?.addEventListener('click', () => this.applyRangeInput());
    document.getElementById('cutter-range-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.applyRangeInput();
    });

    document.getElementById('btn-select-all')?.addEventListener('click', () => this.selectAll());
    document.getElementById('btn-deselect-all')?.addEventListener('click', () => this.deselectAll());
    document.getElementById('btn-invert-selection')?.addEventListener('click', () => this.invertSelection());
    document.getElementById('btn-select-odd')?.addEventListener('click', () => this.selectOdd());
    document.getElementById('btn-select-even')?.addEventListener('click', () => this.selectEven());
    document.getElementById('btn-cutter-reset')?.addEventListener('click', () => this.reset());
    document.getElementById('btn-cutter-demo')?.addEventListener('click', () => this.loadDemoPdf());

    // Extraction actions
    document.getElementById('btn-extract-selected')?.addEventListener('click', () => this.extractSelectedPages());
    document.getElementById('btn-split-all-zip')?.addEventListener('click', () => this.splitToZip());
    document.getElementById('btn-delete-selected')?.addEventListener('click', () => this.deleteSelectedAndExport());
  },

  async handleFile(file) {
    if (!file || file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      App.showToast('Please upload a valid PDF document.', 'error');
      return;
    }

    this.currentPdfFile = file;
    App.showProgress(15, 'Loading PDF structure...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Load with PDF-LIB for manipulation
      this.currentPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      this.totalPages = this.currentPdfDoc.getPageCount();

      // Load with PDF.JS for visual thumbnail rendering
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      this.pdfJsDoc = await loadingTask.promise;

      // Update UI
      document.getElementById('cutter-dropzone').style.display = 'none';
      document.getElementById('cutter-workspace').style.display = 'block';
      document.getElementById('cutter-file-badge').style.display = 'block';
      document.getElementById('cutter-file-info').textContent = `${this.totalPages} Pages • ${App.formatBytes(file.size)}`;
      document.getElementById('cutter-total-count').textContent = this.totalPages;

      App.showToast(`Loaded "${file.name}" (${this.totalPages} pages)`, 'success');

      // Initialize all selected by default or render grid
      this.selectAll();
      await this.renderPageThumbnails();
      App.hideProgress();

    } catch (err) {
      console.error('Error opening PDF:', err);
      App.hideProgress();
      App.showToast('Failed to load PDF. It may be password protected or corrupted.', 'error');
    }
  },

  // Range parser supporting "20-23", "20 to 23", "1, 4, 10-15"
  parseRangeString(str) {
    if (!str || !str.trim()) return [];
    const normalized = str.toLowerCase().replace(/to/g, '-');
    const parts = normalized.split(/[,;\s]+/);
    const pages = new Set();

    parts.forEach(part => {
      part = part.trim();
      if (!part) return;

      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(this.totalPages, Math.max(start, end));
          for (let p = min; p <= max; p++) {
            pages.add(p);
          }
        }
      } else {
        const pageNum = parseInt(part, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= this.totalPages) {
          pages.add(pageNum);
        }
      }
    });

    return Array.from(pages).sort((a, b) => a - b);
  },

  applyRangeInput() {
    const input = document.getElementById('cutter-range-input');
    const val = input.value.trim();
    if (!val) {
      App.showToast('Please enter a page range, e.g. "20-23" or "20 to 23"', 'info');
      return;
    }

    const pages = this.parseRangeString(val);
    if (pages.length === 0) {
      App.showToast(`No valid pages found between 1 and ${this.totalPages}`, 'error');
      return;
    }

    this.selectedPages.clear();
    pages.forEach(p => this.selectedPages.add(p));
    this.updateGridSelectionState();
    App.showToast(`Selected ${pages.length} pages (${val})`, 'success');
  },

  selectAll() {
    this.selectedPages.clear();
    for (let i = 1; i <= this.totalPages; i++) {
      this.selectedPages.add(i);
    }
    this.updateGridSelectionState();
  },

  deselectAll() {
    this.selectedPages.clear();
    this.updateGridSelectionState();
  },

  invertSelection() {
    const newSelection = new Set();
    for (let i = 1; i <= this.totalPages; i++) {
      if (!this.selectedPages.has(i)) {
        newSelection.add(i);
      }
    }
    this.selectedPages = newSelection;
    this.updateGridSelectionState();
  },

  selectOdd() {
    this.selectedPages.clear();
    for (let i = 1; i <= this.totalPages; i += 2) {
      this.selectedPages.add(i);
    }
    this.updateGridSelectionState();
  },

  selectEven() {
    this.selectedPages.clear();
    for (let i = 2; i <= this.totalPages; i += 2) {
      this.selectedPages.add(i);
    }
    this.updateGridSelectionState();
  },

  togglePage(pageNum) {
    if (this.selectedPages.has(pageNum)) {
      this.selectedPages.delete(pageNum);
    } else {
      this.selectedPages.add(pageNum);
    }
    this.updateGridSelectionState();
  },

  updateGridSelectionState() {
    const countEl = document.getElementById('cutter-selected-count');
    if (countEl) countEl.textContent = this.selectedPages.size;

    const cards = document.querySelectorAll('.page-card');
    cards.forEach(card => {
      const pageNum = parseInt(card.getAttribute('data-page'), 10);
      const isSelected = this.selectedPages.has(pageNum);

      if (isSelected) {
        card.classList.add('selected');
        card.classList.remove('excluded');
      } else {
        card.classList.remove('selected');
        card.classList.add('excluded');
      }

      const badge = card.querySelector('.page-checkbox-badge');
      if (badge) {
        badge.innerHTML = isSelected ? '✓' : '';
      }
    });
  },

  // Render thumbnail cards lazily and efficiently
  async renderPageThumbnails() {
    const container = document.getElementById('cutter-page-grid');
    if (!container) return;
    container.innerHTML = '';
    this.pageThumbnails.clear();

    // Create cards placeholders immediately for fast responsive UI
    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      const card = document.createElement('div');
      card.className = `page-card ${this.selectedPages.has(pageNum) ? 'selected' : 'excluded'}`;
      card.setAttribute('data-page', pageNum);

      card.innerHTML = `
        <div class="page-thumb-wrapper" id="thumb-wrap-${pageNum}">
          <div class="page-checkbox-badge">${this.selectedPages.has(pageNum) ? '✓' : ''}</div>
          <button class="page-preview-btn" title="Zoom Preview Page ${pageNum}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <div class="page-thumb-loading" id="thumb-loader-${pageNum}">
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
          </div>
        </div>
        <div class="page-info-bar">Page ${pageNum}</div>
      `;

      // Click card to toggle
      card.addEventListener('click', (e) => {
        if (e.target.closest('.page-preview-btn')) {
          e.stopPropagation();
          this.previewPage(pageNum);
          return;
        }
        this.togglePage(pageNum);
      });

      container.appendChild(card);
    }

    // Lazy load thumbnails in batches so browser doesn't freeze on 100 pages
    this.loadThumbnailsBatch(1);
  },

  async loadThumbnailsBatch(startPage = 1, batchSize = 10) {
    if (!this.pdfJsDoc) return;

    const endPage = Math.min(this.totalPages, startPage + batchSize - 1);
    for (let p = startPage; p <= endPage; p++) {
      try {
        const page = await this.pdfJsDoc.getPage(p);
        const viewport = page.getViewport({ scale: 0.35 });

        const canvas = document.createElement('canvas');
        canvas.className = 'page-thumb-canvas';
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        this.pageThumbnails.set(p, canvas);

        const wrap = document.getElementById(`thumb-wrap-${p}`);
        const loader = document.getElementById(`thumb-loader-${p}`);
        if (wrap) {
          if (loader) loader.remove();
          wrap.appendChild(canvas);
        }
      } catch (err) {
        console.warn(`Could not render thumbnail for page ${p}:`, err);
      }
    }

    if (endPage < this.totalPages) {
      setTimeout(() => this.loadThumbnailsBatch(endPage + 1, batchSize), 20);
    }
  },

  async previewPage(pageNum) {
    try {
      App.showProgress(40, `Generating HD preview of Page ${pageNum}...`);
      const page = await this.pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;
      App.hideProgress();
      App.openPreview(canvas, `Page ${pageNum} Preview - ${this.currentPdfFile.name}`);
    } catch (err) {
      App.hideProgress();
      App.showToast(`Error opening preview for page ${pageNum}`, 'error');
    }
  },

  // Extract selected pages into a single new PDF (e.g. Page 20 to 23)
  async extractSelectedPages() {
    if (this.selectedPages.size === 0) {
      App.showToast('Please select at least one page to extract!', 'error');
      return;
    }

    App.showProgress(25, `Extracting ${this.selectedPages.size} selected pages...`);

    try {
      const sortedPages = Array.from(this.selectedPages).sort((a, b) => a - b);
      const newPdf = await PDFLib.PDFDocument.create();

      // Zero-indexed page numbers for pdf-lib
      const pageIndices = sortedPages.map(p => p - 1);
      const copiedPages = await newPdf.copyPages(this.currentPdfDoc, pageIndices);

      copiedPages.forEach(p => newPdf.addPage(p));

      App.showProgress(80, 'Generating new PDF document...');
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Clean filename like original_pages_20-23.pdf
      const baseName = this.currentPdfFile.name.replace(/\.[^/.]+$/, "");
      const rangeLabel = sortedPages.length === 1 
        ? `page_${sortedPages[0]}` 
        : `pages_${sortedPages[0]}-${sortedPages[sortedPages.length - 1]}`;
      const outFilename = `${baseName}_${rangeLabel}.pdf`;

      App.downloadBlob(blob, outFilename);
      App.hideProgress();
      App.showToast(`Extracted ${sortedPages.length} pages to "${outFilename}"!`, 'success');

    } catch (err) {
      console.error('Extract error:', err);
      App.hideProgress();
      App.showToast('Failed to extract selected pages.', 'error');
    }
  },

  // Split selected pages into individual PDFs packed inside a ZIP file
  async splitToZip() {
    if (this.selectedPages.size === 0) {
      App.showToast('Please select pages to split!', 'error');
      return;
    }

    if (typeof JSZip === 'undefined') {
      App.showToast('JSZip library not available for zip generation.', 'error');
      return;
    }

    const sortedPages = Array.from(this.selectedPages).sort((a, b) => a - b);
    const zip = new JSZip();
    const baseName = this.currentPdfFile.name.replace(/\.[^/.]+$/, "");

    App.showProgress(10, `Splitting ${sortedPages.length} pages into zip...`);

    try {
      for (let i = 0; i < sortedPages.length; i++) {
        const pageNum = sortedPages[i];
        const pct = 10 + Math.round((i / sortedPages.length) * 75);
        App.showProgress(pct, `Processing Page ${pageNum} of ${this.totalPages}...`);

        const singleDoc = await PDFLib.PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(this.currentPdfDoc, [pageNum - 1]);
        singleDoc.addPage(copiedPage);

        const singleBytes = await singleDoc.save();
        zip.file(`${baseName}_page_${pageNum}.pdf`, singleBytes);
      }

      App.showProgress(90, 'Compressing ZIP archive...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      App.downloadBlob(zipBlob, `${baseName}_split_pages.zip`);
      App.hideProgress();
      App.showToast(`Downloaded ZIP containing ${sortedPages.length} individual PDFs!`, 'success');

    } catch (err) {
      console.error('Split zip error:', err);
      App.hideProgress();
      App.showToast('Error creating zip archive.', 'error');
    }
  },

  // Delete selected pages and save remainder
  async deleteSelectedAndExport() {
    const unselected = [];
    for (let p = 1; p <= this.totalPages; p++) {
      if (!this.selectedPages.has(p)) {
        unselected.push(p);
      }
    }

    if (unselected.length === 0) {
      App.showToast('Cannot delete all pages! At least 1 page must remain.', 'error');
      return;
    }

    App.showProgress(30, `Removing selected pages and saving ${unselected.length} pages...`);

    try {
      const newPdf = await PDFLib.PDFDocument.create();
      const pageIndices = unselected.map(p => p - 1);
      const copiedPages = await newPdf.copyPages(this.currentPdfDoc, pageIndices);

      copiedPages.forEach(p => newPdf.addPage(p));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const baseName = this.currentPdfFile.name.replace(/\.[^/.]+$/, "");

      App.downloadBlob(blob, `${baseName}_remainder_${unselected.length}pages.pdf`);
      App.hideProgress();
      App.showToast(`Saved remainder (${unselected.length} pages)!`, 'success');

    } catch (err) {
      App.hideProgress();
      App.showToast('Error removing pages.', 'error');
    }
  },

  async loadDemoPdf() {
    App.showProgress(15, 'Generating 100-page demo PDF in browser...');
    try {
      const demoDoc = await PDFLib.PDFDocument.create();
      const fontBold = await demoDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const fontRegular = await demoDoc.embedFont(PDFLib.StandardFonts.Helvetica);

      for (let i = 1; i <= 100; i++) {
        const page = demoDoc.addPage([595.28, 841.89]); // A4
        
        // Header
        page.drawText('GhostPDF Studio - 100 Pages Test Document', {
          x: 50,
          y: 790,
          size: 14,
          font: fontBold,
          color: PDFLib.rgb(0.55, 0.27, 0.95),
        });

        // Banner box
        page.drawRectangle({
          x: 50,
          y: 720,
          width: 495.28,
          height: 50,
          color: PDFLib.rgb(0.95, 0.93, 1.0),
          borderColor: PDFLib.rgb(0.65, 0.45, 0.95),
          borderWidth: 1.5,
        });

        page.drawText(`DOCUMENT PAGE ${i} OF 100`, {
          x: 70,
          y: 738,
          size: 18,
          font: fontBold,
          color: PDFLib.rgb(0.4, 0.15, 0.7),
        });

        // Sample text
        page.drawText(`This is page number ${i}. Test selecting range "20-23" or "20 to 23" to extract!`, {
          x: 50,
          y: 670,
          size: 12,
          font: fontRegular,
          color: PDFLib.rgb(0.2, 0.2, 0.2),
        });

        page.drawText(`Section ${Math.ceil(i / 10)}: Data analysis, performance metrics, and extracted insights.`, {
          x: 50,
          y: 640,
          size: 11,
          font: fontRegular,
          color: PDFLib.rgb(0.3, 0.3, 0.3),
        });

        // Footer
        page.drawText(`GhostPDF • Page ${i} / 100`, {
          x: 240,
          y: 40,
          size: 10,
          font: fontRegular,
          color: PDFLib.rgb(0.5, 0.5, 0.5),
        });
      }

      App.showProgress(85, 'Finalizing 100-page document...');
      const bytes = await demoDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const sampleFile = new File([blob], 'Sample_100_Page_Doc.pdf', { type: 'application/pdf' });

      await this.handleFile(sampleFile);
      App.showToast('Generated & loaded 100-page sample PDF!', 'success');
      // Set sample range in the input so user can click Apply Range
      const rangeInput = document.getElementById('cutter-range-input');
      if (rangeInput) rangeInput.value = '20-23';

    } catch (err) {
      console.error('Error generating demo PDF:', err);
      App.hideProgress();
      App.showToast('Failed to create sample PDF.', 'error');
    }
  },

  reset() {
    this.currentPdfFile = null;
    this.currentPdfDoc = null;
    this.pdfJsDoc = null;
    this.totalPages = 0;
    this.selectedPages.clear();
    this.pageThumbnails.clear();

    document.getElementById('cutter-dropzone').style.display = 'flex';
    document.getElementById('cutter-workspace').style.display = 'none';
    document.getElementById('cutter-file-badge').style.display = 'none';
    document.getElementById('cutter-page-grid').innerHTML = '';
    document.getElementById('cutter-file-input').value = '';
    document.getElementById('cutter-range-input').value = '';
  }
};

// Auto initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  PdfCutter.init();
});
