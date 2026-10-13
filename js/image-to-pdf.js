/**
 * GhostPDF - Image to PDF Converter Module
 * Converts single or multiple JPG, PNG, WEBP images to PDF.
 * Allows reordering, orientation settings, page sizes, and margin configuration.
 */

const ImgToPdf = {
  images: [], // array of { id, file, url, width, height, size }

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const dropzone = document.getElementById('img2pdf-dropzone');
    const fileInput = document.getElementById('img2pdf-file-input');

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

    document.getElementById('btn-img2pdf-addmore')?.addEventListener('click', () => {
      fileInput?.click();
    });

    document.getElementById('btn-img2pdf-clear')?.addEventListener('click', () => this.clearAll());
    document.getElementById('btn-convert-img2pdf')?.addEventListener('click', () => this.convertToPdf());
  },

  async addFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      App.showToast('Please select valid image files (JPG, PNG, WEBP, etc.)', 'error');
      return;
    }

    App.showProgress(30, `Loading ${imageFiles.length} images...`);

    for (const file of imageFiles) {
      const url = URL.createObjectURL(file);
      const dimensions = await this.getImageDimensions(url);

      this.images.push({
        id: 'img_' + Math.random().toString(36).substr(2, 9),
        file,
        url,
        width: dimensions.width,
        height: dimensions.height,
        size: file.size
      });
    }

    App.hideProgress();
    this.renderImages();
    App.showToast(`Added ${imageFiles.length} image(s)`, 'success');
  },

  getImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 800, height: 600 });
      img.src = url;
    });
  },

  renderImages() {
    const workspace = document.getElementById('img2pdf-workspace');
    const dropzone = document.getElementById('img2pdf-dropzone');
    const list = document.getElementById('img2pdf-list');
    const countEl = document.getElementById('img2pdf-count');

    if (!workspace || !dropzone || !list) return;

    if (this.images.length === 0) {
      workspace.style.display = 'none';
      dropzone.style.display = 'flex';
      return;
    }

    dropzone.style.display = 'none';
    workspace.style.display = 'block';
    if (countEl) countEl.textContent = this.images.length;

    list.innerHTML = '';

    this.images.forEach((img, idx) => {
      const card = document.createElement('div');
      card.className = 'image-item-card';

      card.innerHTML = `
        <div class="image-preview-box">
          <img src="${img.url}" alt="${img.file.name}" loading="lazy">
        </div>
        <div class="image-meta-info">
          <div class="image-name" title="${img.file.name}">${img.file.name}</div>
          <div class="image-size">${img.width}x${img.height} • ${App.formatBytes(img.size)}</div>
        </div>
        <div class="image-actions">
          <button class="action-icon-btn btn-move-up" title="Move Up" ${idx === 0 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">#${idx + 1}</span>
          <button class="action-icon-btn btn-move-down" title="Move Down" ${idx === this.images.length - 1 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="action-icon-btn delete-btn btn-delete-img" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      card.querySelector('.btn-move-up')?.addEventListener('click', () => this.moveImage(idx, -1));
      card.querySelector('.btn-move-down')?.addEventListener('click', () => this.moveImage(idx, 1));
      card.querySelector('.btn-delete-img')?.addEventListener('click', () => this.removeImage(idx));

      list.appendChild(card);
    });
  },

  moveImage(index, direction) {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= this.images.length) return;
    const temp = this.images[index];
    this.images[index] = this.images[newIdx];
    this.images[newIdx] = temp;
    this.renderImages();
  },

  removeImage(index) {
    const [removed] = this.images.splice(index, 1);
    if (removed && removed.url) URL.revokeObjectURL(removed.url);
    this.renderImages();
  },

  clearAll() {
    this.images.forEach(img => URL.revokeObjectURL(img.url));
    this.images = [];
    this.renderImages();
    document.getElementById('img2pdf-file-input').value = '';
  },

  async convertToPdf() {
    if (this.images.length === 0) {
      App.showToast('Please add at least one image.', 'error');
      return;
    }

    const pageSizeSetting = document.getElementById('img2pdf-pagesize')?.value || 'fit';
    const orientationSetting = document.getElementById('img2pdf-orientation')?.value || 'auto';
    const margin = parseInt(document.getElementById('img2pdf-margin')?.value || '0', 10);

    App.showProgress(10, 'Creating PDF document...');

    try {
      const pdfDoc = await PDFLib.PDFDocument.create();

      for (let i = 0; i < this.images.length; i++) {
        const item = this.images[i];
        const pct = 10 + Math.round((i / this.images.length) * 80);
        App.showProgress(pct, `Embedding image ${i + 1} of ${this.images.length}...`);

        // Load image as ArrayBuffer or draw to canvas to ensure compatibility (PNG/JPG)
        let embeddedImage;
        const arrayBuffer = await item.file.arrayBuffer();

        const isJpg = item.file.type === 'image/jpeg' || item.file.name.toLowerCase().endsWith('.jpg') || item.file.name.toLowerCase().endsWith('.jpeg');
        const isPng = item.file.type === 'image/png' || item.file.name.toLowerCase().endsWith('.png');

        if (isJpg) {
          try {
            embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
          } catch {
            // Fallback: draw through canvas
            embeddedImage = await this.convertImageViaCanvas(pdfDoc, item.url);
          }
        } else if (isPng) {
          try {
            embeddedImage = await pdfDoc.embedPng(arrayBuffer);
          } catch {
            // Fallback: draw through canvas
            embeddedImage = await this.convertImageViaCanvas(pdfDoc, item.url);
          }
        } else {
          // WebP / Gif / SVG - convert via canvas to JPEG
          embeddedImage = await this.convertImageViaCanvas(pdfDoc, item.url);
        }

        // Calculate page dimension
        let pageW, pageH;
        if (pageSizeSetting === 'a4') {
          pageW = 595.28;
          pageH = 841.89;
        } else if (pageSizeSetting === 'letter') {
          pageW = 612.0;
          pageH = 792.0;
        } else {
          // Fit directly to image with margins
          pageW = item.width + margin * 2;
          pageH = item.height + margin * 2;
        }

        // Handle Orientation
        if (pageSizeSetting !== 'fit') {
          const isImageLandscape = item.width > item.height;
          if (orientationSetting === 'landscape' || (orientationSetting === 'auto' && isImageLandscape)) {
            if (pageW < pageH) {
              const tmp = pageW; pageW = pageH; pageH = tmp;
            }
          } else if (orientationSetting === 'portrait') {
            if (pageW > pageH) {
              const tmp = pageW; pageW = pageH; pageH = tmp;
            }
          }
        }

        const page = pdfDoc.addPage([pageW, pageH]);

        // Calculate fitted image dimensions maintaining aspect ratio
        const availableW = pageW - margin * 2;
        const availableH = pageH - margin * 2;

        const imgScale = Math.min(availableW / item.width, availableH / item.height);
        const drawW = item.width * imgScale;
        const drawH = item.height * imgScale;
        const drawX = margin + (availableW - drawW) / 2;
        const drawY = margin + (availableH - drawH) / 2;

        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });
      }

      App.showProgress(95, 'Saving combined PDF...');
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      App.downloadBlob(blob, `images_converted_${this.images.length}pages.pdf`);
      App.hideProgress();
      App.showToast(`Converted ${this.images.length} image(s) to PDF!`, 'success');

    } catch (err) {
      console.error('Image to PDF error:', err);
      App.hideProgress();
      App.showToast('Failed to convert images to PDF.', 'error');
    }
  },

  // Fallback canvas converter for WebP/SVG/corrupted headers
  async convertImageViaCanvas(pdfDoc, imgUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(async (blob) => {
          try {
            const buf = await blob.arrayBuffer();
            const embedded = await pdfDoc.embedJpg(buf);
            resolve(embedded);
          } catch (e) {
            reject(e);
          }
        }, 'image/jpeg', 0.92);
      };
      img.onerror = reject;
      img.src = imgUrl;
    });
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  ImgToPdf.init();
});
