/**
 * GhostPDF - PDF Merger & Combiner Module ("pdf add")
 * Merges multiple PDF files into one combined PDF document.
 * Supports reordering, page count detection, and safe client-side combining.
 */

const PdfMerger = {
  files: [], // array of { id, file, pageCount, size }

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const dropzone = document.getElementById('merger-dropzone');
    const fileInput = document.getElementById('merger-file-input');

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
          this.addFiles(Array.from(e.dataTransfer.files));
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.addFiles(Array.from(e.target.files));
        }
      });
    }

    document.getElementById('btn-merger-addmore')?.addEventListener('click', () => {
      fileInput?.click();
    });

    document.getElementById('btn-merger-clear')?.addEventListener('click', () => this.clearAll());
    document.getElementById('btn-start-merge')?.addEventListener('click', () => this.mergePdfs());
  },

  async addFiles(newFiles) {
    const pdfFiles = newFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      App.showToast('Please select valid PDF documents.', 'error');
      return;
    }

    App.showProgress(25, `Analyzing ${pdfFiles.length} PDF file(s)...`);

    for (const file of pdfFiles) {
      try {
        const buffer = await file.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
        const pageCount = doc.getPageCount();

        this.files.push({
          id: 'pdf_' + Math.random().toString(36).substr(2, 9),
          file,
          buffer,
          pageCount,
          size: file.size
        });
      } catch (err) {
        console.warn(`Could not read PDF ${file.name}:`, err);
        App.showToast(`Skipped "${file.name}" (encrypted or damaged)`, 'error');
      }
    }

    App.hideProgress();
    this.renderList();
    App.showToast(`Added ${pdfFiles.length} document(s) to merger`, 'success');
  },

  renderList() {
    const workspace = document.getElementById('merger-workspace');
    const dropzone = document.getElementById('merger-dropzone');
    const list = document.getElementById('merger-list');
    const countEl = document.getElementById('merger-count');

    if (!workspace || !dropzone || !list) return;

    if (this.files.length === 0) {
      workspace.style.display = 'none';
      dropzone.style.display = 'flex';
      return;
    }

    dropzone.style.display = 'none';
    workspace.style.display = 'block';
    if (countEl) countEl.textContent = this.files.length;

    list.innerHTML = '';

    this.files.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'merge-item';

      row.innerHTML = `
        <div class="merge-item-left">
          <div class="merge-order-badge">#${idx + 1}</div>
          <div class="merge-file-info">
            <div class="merge-file-name" title="${item.file.name}">${item.file.name}</div>
            <div class="merge-file-meta">${item.pageCount} Pages • ${App.formatBytes(item.size)}</div>
          </div>
        </div>
        <div class="merge-item-actions">
          <button class="action-icon-btn btn-move-up" title="Move Up" ${idx === 0 ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="action-icon-btn btn-move-down" title="Move Down" ${idx === this.files.length - 1 ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="action-icon-btn delete-btn btn-delete-merge" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      row.querySelector('.btn-move-up')?.addEventListener('click', () => this.moveItem(idx, -1));
      row.querySelector('.btn-move-down')?.addEventListener('click', () => this.moveItem(idx, 1));
      row.querySelector('.btn-delete-merge')?.addEventListener('click', () => this.removeItem(idx));

      list.appendChild(row);
    });
  },

  moveItem(index, direction) {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= this.files.length) return;
    const temp = this.files[index];
    this.files[index] = this.files[newIdx];
    this.files[newIdx] = temp;
    this.renderList();
  },

  removeItem(index) {
    this.files.splice(index, 1);
    this.renderList();
  },

  clearAll() {
    this.files = [];
    this.renderList();
    document.getElementById('merger-file-input').value = '';
  },

  async mergePdfs() {
    if (this.files.length < 2) {
      App.showToast('Please add at least 2 PDF files to merge.', 'error');
      return;
    }

    App.showProgress(10, 'Initializing master merged PDF...');

    try {
      const mergedPdf = await PDFLib.PDFDocument.create();
      let totalMergedPages = 0;

      for (let i = 0; i < this.files.length; i++) {
        const item = this.files[i];
        const pct = 10 + Math.round((i / this.files.length) * 80);
        App.showProgress(pct, `Merging "${item.file.name}" (${i + 1} of ${this.files.length})...`);

        const srcDoc = await PDFLib.PDFDocument.load(item.buffer, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach(p => mergedPdf.addPage(p));
        totalMergedPages += copiedPages.length;
      }

      App.showProgress(92, 'Generating final merged PDF document...');
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });

      App.downloadBlob(blob, `merged_${this.files.length}_documents_${totalMergedPages}pages.pdf`);
      App.hideProgress();
      App.showToast(`Merged ${this.files.length} PDFs (${totalMergedPages} total pages)!`, 'success');

    } catch (err) {
      console.error('Merge error:', err);
      App.hideProgress();
      App.showToast('Failed to merge PDF documents.', 'error');
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  PdfMerger.init();
});
