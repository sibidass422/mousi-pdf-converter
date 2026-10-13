/**
 * GhostPDF - PDF Compressor Module
 * Compresses PDFs to low KB/MB with fine-grained quality and scale controls.
 * Shows live progress and before/after file size comparisons.
 */

const PdfCompressor = {
  currentFile: null,
  pdfJsDoc: null,
  totalPages: 0,
  compressedBlob: null,
  activePreset: 'balanced', // 'balanced', 'extreme', 'high', 'custom'

  presets: {
    balanced: { scale: 0.75, quality: 0.70 },
    extreme:  { scale: 0.50, quality: 0.40 },
    high:     { scale: 1.00, quality: 0.85 },
    custom:   { scale: 0.75, quality: 0.70 }
  },

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const dropzone = document.getElementById('compressor-dropzone');
    const fileInput = document.getElementById('compressor-file-input');

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

    // Presets selection
    document.querySelectorAll('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const preset = card.getAttribute('data-preset');
        this.selectPreset(preset);
      });
    });

    // Custom sliders
    const qualitySlider = document.getElementById('compressor-quality-slider');
    const scaleSlider = document.getElementById('compressor-scale-slider');
    const qualityVal = document.getElementById('slider-quality-val');
    const scaleVal = document.getElementById('slider-scale-val');

    if (qualitySlider && qualityVal) {
      qualitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        qualityVal.textContent = `${val}%`;
        this.presets.custom.quality = val / 100;
      });
    }

    if (scaleSlider && scaleVal) {
      scaleSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        scaleVal.textContent = `${(val / 100).toFixed(2)}x`;
        this.presets.custom.scale = val / 100;
      });
    }

    document.getElementById('btn-compressor-reset')?.addEventListener('click', () => this.reset());
    document.getElementById('btn-compressor-demo')?.addEventListener('click', () => this.loadDemoPdf());
    document.getElementById('btn-start-compress')?.addEventListener('click', () => this.compressPdf());
    document.getElementById('btn-download-compressed')?.addEventListener('click', () => this.downloadCompressed());
  },

  selectPreset(presetKey) {
    this.activePreset = presetKey;
    document.querySelectorAll('.preset-card').forEach(c => {
      if (c.getAttribute('data-preset') === presetKey) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    const customBox = document.getElementById('compressor-custom-box');
    if (customBox) {
      customBox.style.display = presetKey === 'custom' ? 'block' : 'none';
    }
  },

  async handleFile(file) {
    if (!file || file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      App.showToast('Please upload a valid PDF document.', 'error');
      return;
    }

    this.currentFile = file;
    App.showProgress(20, 'Reading PDF structure for compression...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      this.pdfJsDoc = await loadingTask.promise;
      this.totalPages = this.pdfJsDoc.numPages;

      document.getElementById('compressor-dropzone').style.display = 'none';
      document.getElementById('compressor-workspace').style.display = 'block';
      document.getElementById('compressor-filename').textContent = file.name;
      document.getElementById('compressor-filedetails').textContent = `${this.totalPages} pages • ${App.formatBytes(file.size)}`;
      document.getElementById('compressor-results-card').style.display = 'none';

      App.hideProgress();
      App.showToast(`Ready to compress "${file.name}"`, 'success');

    } catch (err) {
      console.error('Error loading PDF for compression:', err);
      App.hideProgress();
      App.showToast('Failed to load PDF file.', 'error');
    }
  },

  async compressPdf() {
    if (!this.pdfJsDoc || !this.currentFile) {
      App.showToast('No PDF loaded to compress.', 'error');
      return;
    }

    const { scale, quality } = this.presets[this.activePreset];
    const compressBtn = document.getElementById('btn-start-compress');
    if (compressBtn) compressBtn.disabled = true;

    try {
      const newPdf = await PDFLib.PDFDocument.create();

      for (let p = 1; p <= this.totalPages; p++) {
        const pct = Math.round((p / this.totalPages) * 90);
        App.showProgress(pct, `Compressing page ${p} of ${this.totalPages} (${Math.round(quality * 100)}% quality)...`);

        const page = await this.pdfJsDoc.getPage(p);
        const viewport = page.getViewport({ scale });

        // Offscreen canvas for rendering
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d', { alpha: false });

        // Draw white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Export to compressed JPEG blob
        const jpegBlob = await new Promise((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', quality);
        });

        const jpegBytes = await jpegBlob.arrayBuffer();
        const embeddedImage = await newPdf.embedJpg(jpegBytes);

        // Add page matching viewport dimensions
        const pdfPage = newPdf.addPage([viewport.width, viewport.height]);
        pdfPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });
      }

      App.showProgress(95, 'Finalizing compressed document...');
      const finalBytes = await newPdf.save();
      this.compressedBlob = new Blob([finalBytes], { type: 'application/pdf' });

      // Compare original vs compressed
      const originalSize = this.currentFile.size;
      const compressedSize = this.compressedBlob.size;
      const savedBytes = originalSize - compressedSize;
      const savedPct = Math.round((savedBytes / originalSize) * 100);

      document.getElementById('res-original-size').textContent = App.formatBytes(originalSize);
      document.getElementById('res-compressed-size').textContent = App.formatBytes(compressedSize);

      const savingsBadge = document.getElementById('res-savings-badge');
      if (savedPct > 0) {
        savingsBadge.textContent = `📉 -${savedPct}% Smaller!`;
        savingsBadge.style.color = 'var(--success)';
      } else {
        savingsBadge.textContent = `Optimized format`;
        savingsBadge.style.color = 'var(--ghost-cyan)';
      }

      document.getElementById('compressor-results-card').style.display = 'block';
      App.hideProgress();
      App.showToast(`Compressed successfully! Size: ${App.formatBytes(compressedSize)}`, 'success');

    } catch (err) {
      console.error('Compression error:', err);
      App.hideProgress();
      App.showToast('Error during PDF compression.', 'error');
    } finally {
      if (compressBtn) compressBtn.disabled = false;
    }
  },

  async loadDemoPdf() {
    App.showProgress(20, 'Generating graphic-rich sample PDF for compression...');
    try {
      const demoDoc = await PDFLib.PDFDocument.create();
      const fontBold = await demoDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const fontRegular = await demoDoc.embedFont(PDFLib.StandardFonts.Helvetica);

      for (let i = 1; i <= 5; i++) {
        const page = demoDoc.addPage([595.28, 841.89]);
        
        // Large gradient-like colored pattern to give it substantial weight
        for (let j = 0; j < 15; j++) {
          page.drawRectangle({
            x: 50 + (j % 5) * 95,
            y: 400 + Math.floor(j / 5) * 110,
            width: 85,
            height: 95,
            color: PDFLib.rgb((j * 17) % 255 / 255, (i * 45) % 255 / 255, 0.8),
          });
        }

        page.drawText(`High-Resolution Test Document - Page ${i}`, {
          x: 50,
          y: 770,
          size: 16,
          font: fontBold,
          color: PDFLib.rgb(0.1, 0.1, 0.1),
        });

        page.drawText(`Test PDF compression algorithms with low KB/MB targeting and resolution scale.`, {
          x: 50,
          y: 350,
          size: 12,
          font: fontRegular,
          color: PDFLib.rgb(0.3, 0.3, 0.3),
        });
      }

      const bytes = await demoDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const sampleFile = new File([blob], 'HighRes_Sample_Doc.pdf', { type: 'application/pdf' });

      await this.handleFile(sampleFile);
      App.showToast('Loaded demo PDF for compression!', 'success');
    } catch (err) {
      App.hideProgress();
      App.showToast('Failed to generate demo PDF.', 'error');
    }
  },

  reset() {
    this.currentFile = null;
    this.pdfJsDoc = null;
    this.totalPages = 0;
    this.compressedBlob = null;

    document.getElementById('compressor-dropzone').style.display = 'flex';
    document.getElementById('compressor-workspace').style.display = 'none';
    document.getElementById('compressor-file-input').value = '';
    document.getElementById('compressor-results-card').style.display = 'none';
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  PdfCompressor.init();
});
