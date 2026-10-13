/**
 * GhostPDF - PDF Text Extractor & Smart Summarizer Module
 * Extracts text from all pages and generates intelligent summaries (extractive TextRank),
 * key topics extraction, reading metrics, and export to TXT or PDF.
 */

const PdfSummarizer = {
  currentFile: null,
  fullText: '',
  pageTexts: [], // array of text per page
  sentences: [],
  keywords: [],
  summaryResult: '',
  activeView: 'summary', // 'summary' or 'raw'

  // Common stop words to exclude from keyword extraction & scoring
  stopWords: new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could',
    'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
    'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
    'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off',
    'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she',
    'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
    'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'page', 'pages', 'also', 'one', 'two', 'using', 'used', 'can'
  ]),

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const dropzone = document.getElementById('summarizer-dropzone');
    const fileInput = document.getElementById('summarizer-file-input');

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

    // Format & slider controls
    document.getElementById('summary-format-select')?.addEventListener('change', () => this.generateSummary());
    
    const lengthSlider = document.getElementById('summary-length-slider');
    const lengthVal = document.getElementById('summary-length-val');
    if (lengthSlider && lengthVal) {
      lengthSlider.addEventListener('input', (e) => {
        lengthVal.textContent = `${e.target.value} sentences`;
        this.generateSummary();
      });
    }

    // Toggle view buttons
    document.getElementById('btn-view-summary')?.addEventListener('click', () => this.switchView('summary'));
    document.getElementById('btn-view-raw')?.addEventListener('click', () => this.switchView('raw'));

    // Export buttons
    document.getElementById('btn-copy-text')?.addEventListener('click', () => this.copyToClipboard());
    document.getElementById('btn-download-txt')?.addEventListener('click', () => this.downloadTxt());
    document.getElementById('btn-export-summary-pdf')?.addEventListener('click', () => this.exportSummaryToPdf());
    document.getElementById('btn-summarizer-demo')?.addEventListener('click', () => this.loadDemoPdf());
  },

  async handleFile(file) {
    if (!file || file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      App.showToast('Please upload a valid PDF document.', 'error');
      return;
    }

    this.currentFile = file;
    App.showProgress(20, 'Reading PDF text content...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      this.pageTexts = [];
      let combined = '';

      for (let p = 1; p <= numPages; p++) {
        const pct = 20 + Math.round((p / numPages) * 65);
        App.showProgress(pct, `Extracting text from page ${p} of ${numPages}...`);

        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        this.pageTexts.push(pageText);
        combined += `\n--- Page ${p} ---\n` + pageText + '\n';
      }

      this.fullText = combined.trim();

      if (!this.fullText || this.fullText.replace(/--- Page \d+ ---/g, '').trim().length < 20) {
        App.hideProgress();
        App.showToast('Warning: This PDF contains very little or no selectable text (may be scanned images).', 'info');
      }

      // Compute statistics and topics
      this.computeStats(numPages);

      document.getElementById('summarizer-dropzone').style.display = 'none';
      document.getElementById('summarizer-workspace').style.display = 'block';

      this.generateSummary();
      App.hideProgress();
      App.showToast(`Extracted text from ${numPages} pages!`, 'success');

    } catch (err) {
      console.error('Error reading PDF text:', err);
      App.hideProgress();
      App.showToast('Failed to extract text from PDF.', 'error');
    }
  },

  computeStats(numPages) {
    const rawContent = this.fullText.replace(/--- Page \d+ ---/g, ' ');
    const words = rawContent.match(/\b[A-Za-z0-9_-]+\b/g) || [];
    const totalWords = words.length;
    const totalChars = rawContent.length;
    const readingTime = Math.max(1, Math.round(totalWords / 200));

    document.getElementById('stat-pages').textContent = numPages;
    document.getElementById('stat-words').textContent = totalWords.toLocaleString();
    document.getElementById('stat-chars').textContent = totalChars.toLocaleString();
    document.getElementById('stat-reading').textContent = `${readingTime} min`;

    // Extract top keywords by frequency
    const freq = new Map();
    words.forEach(w => {
      const lower = w.toLowerCase();
      if (lower.length > 3 && !this.stopWords.has(lower) && !/^\d+$/.test(lower)) {
        freq.set(lower, (freq.get(lower) || 0) + 1);
      }
    });

    const sortedKeywords = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const chipsContainer = document.getElementById('keyword-chips-container');
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      if (sortedKeywords.length === 0) {
        chipsContainer.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">No significant keywords detected.</span>';
      } else {
        sortedKeywords.forEach(([kw, count]) => {
          const chip = document.createElement('span');
          chip.className = 'keyword-chip';
          chip.textContent = `#${kw} (${count})`;
          chipsContainer.appendChild(chip);
        });
      }
    }
  },

  // Smart Extractive Summarizer Algorithm
  generateSummary() {
    const rawContent = this.fullText.replace(/--- Page \d+ ---/g, ' ').trim();
    if (!rawContent) {
      this.summaryResult = 'No text available to summarize.';
      this.updateDisplay();
      return;
    }

    // Split into sentences
    const rawSentences = rawContent
      .split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && s.length < 500);

    if (rawSentences.length <= 3) {
      this.summaryResult = rawContent;
      this.updateDisplay();
      return;
    }

    // Word frequency mapping
    const words = rawContent.toLowerCase().match(/\b[A-Za-z0-9_-]+\b/g) || [];
    const wordFreq = new Map();
    words.forEach(w => {
      if (!this.stopWords.has(w) && w.length > 3) {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      }
    });

    // Score sentences
    const scored = rawSentences.map((sentence, index) => {
      const sWords = sentence.toLowerCase().match(/\b[A-Za-z0-9_-]+\b/g) || [];
      let score = 0;

      sWords.forEach(w => {
        if (wordFreq.has(w)) {
          score += wordFreq.get(w);
        }
      });

      // Normalize by sentence length
      score = score / Math.max(1, Math.sqrt(sWords.length));

      // Boost early sentences in paragraphs
      if (index < 5) score *= 1.25;

      return { text: sentence, index, score };
    });

    const targetSentencesCount = parseInt(document.getElementById('summary-length-slider')?.value || '5', 10);
    const topSentences = [...scored]
      .sort((a, b) => b.score - a.score)
      .slice(0, targetSentencesCount)
      .sort((a, b) => a.index - b.index); // restore reading flow

    const format = document.getElementById('summary-format-select')?.value || 'bullet';

    if (format === 'bullet') {
      this.summaryResult = topSentences
        .map(item => `• ${item.text}`)
        .join('\n\n');
    } else if (format === 'executive') {
      this.summaryResult = topSentences
        .map(item => item.text)
        .join(' ');
    } else {
      // Detailed: Group into sections with headers
      this.summaryResult = `### Summary Highlights\n\n` + 
        topSentences.map((item, idx) => `**Point ${idx + 1}:** ${item.text}`).join('\n\n');
    }

    this.updateDisplay();
  },

  updateDisplay() {
    const display = document.getElementById('summary-text-display');
    if (!display) return;

    if (this.activeView === 'summary') {
      display.textContent = this.summaryResult;
    } else {
      display.textContent = this.fullText;
    }
  },

  switchView(view) {
    this.activeView = view;
    const btnSummary = document.getElementById('btn-view-summary');
    const btnRaw = document.getElementById('btn-view-raw');

    if (view === 'summary') {
      btnSummary.style.borderColor = 'var(--ghost-purple)';
      btnSummary.style.color = 'var(--ghost-purple)';
      btnRaw.style.borderColor = 'var(--border-color)';
      btnRaw.style.color = 'var(--text-main)';
    } else {
      btnRaw.style.borderColor = 'var(--ghost-purple)';
      btnRaw.style.color = 'var(--ghost-purple)';
      btnSummary.style.borderColor = 'var(--border-color)';
      btnSummary.style.color = 'var(--text-main)';
    }

    this.updateDisplay();
  },

  copyToClipboard() {
    const textToCopy = this.activeView === 'summary' ? this.summaryResult : this.fullText;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      App.showToast('Copied to clipboard!', 'success');
    }).catch(() => {
      App.showToast('Failed to copy text.', 'error');
    });
  },

  downloadTxt() {
    const text = this.activeView === 'summary' ? this.summaryResult : this.fullText;
    if (!text) return;

    const baseName = this.currentFile ? this.currentFile.name.replace(/\.[^/.]+$/, "") : "document";
    const filename = `${baseName}_${this.activeView}.txt`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    App.downloadBlob(blob, filename);
    App.showToast(`Downloaded "${filename}"!`, 'success');
  },

  // Export summary as formatted PDF document using pdf-lib
  async exportSummaryToPdf() {
    if (!this.summaryResult || !this.currentFile) {
      App.showToast('No summary available to export.', 'error');
      return;
    }

    App.showProgress(30, 'Formatting Summary PDF document...');

    try {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const timesRomanFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

      const margin = 50;
      const width = 595.28;  // A4
      const height = 841.89; // A4
      const maxLineWidth = width - margin * 2;

      let currentPage = pdfDoc.addPage([width, height]);
      let currentY = height - margin;

      // Draw Title Header
      currentPage.drawText('GhostPDF - Executive Document Summary', {
        x: margin,
        y: currentY,
        size: 16,
        font: boldFont,
        color: PDFLib.rgb(0.55, 0.27, 0.95), // Ghost Purple
      });
      currentY -= 24;

      // Draw Document Meta Info
      const baseName = this.currentFile.name;
      currentPage.drawText(`Source Document: ${baseName} | Generated: ${new Date().toLocaleDateString()}`, {
        x: margin,
        y: currentY,
        size: 9,
        font: timesRomanFont,
        color: PDFLib.rgb(0.4, 0.4, 0.4),
      });
      currentY -= 20;

      // Divider Line
      currentPage.drawLine({
        start: { x: margin, y: currentY },
        end: { x: width - margin, y: currentY },
        thickness: 1,
        color: PDFLib.rgb(0.85, 0.85, 0.85),
      });
      currentY -= 24;

      // Split summary into lines that fit the page width
      const paragraphs = this.summaryResult.split('\n');
      const fontSize = 10;
      const lineHeight = 15;

      for (const para of paragraphs) {
        if (!para.trim()) {
          currentY -= 8;
          continue;
        }

        const words = para.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const textWidth = timesRomanFont.widthOfTextAtSize(testLine, fontSize);

          if (textWidth > maxLineWidth) {
            // Check if page overflow
            if (currentY < margin + 20) {
              currentPage = pdfDoc.addPage([width, height]);
              currentY = height - margin;
            }

            currentPage.drawText(currentLine, {
              x: margin,
              y: currentY,
              size: fontSize,
              font: timesRomanFont,
              color: PDFLib.rgb(0.1, 0.1, 0.1),
            });
            currentY -= lineHeight;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          if (currentY < margin + 20) {
            currentPage = pdfDoc.addPage([width, height]);
            currentY = height - margin;
          }

          currentPage.drawText(currentLine, {
            x: margin,
            y: currentY,
            size: fontSize,
            font: timesRomanFont,
            color: PDFLib.rgb(0.1, 0.1, 0.1),
          });
          currentY -= lineHeight + 4;
        }
      }

      App.showProgress(90, 'Saving summary PDF...');
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const outName = `${this.currentFile.name.replace(/\.[^/.]+$/, "")}_summary.pdf`;

      App.downloadBlob(blob, outName);
      App.hideProgress();
      App.showToast(`Exported summary to "${outName}"!`, 'success');

    } catch (err) {
      console.error('Error generating summary PDF:', err);
      App.hideProgress();
      App.showToast('Failed to export summary PDF.', 'error');
    }
  },

  async loadDemoPdf() {
    App.showProgress(25, 'Generating comprehensive research sample document...');
    try {
      const demoDoc = await PDFLib.PDFDocument.create();
      const fontBold = await demoDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const fontRegular = await demoDoc.embedFont(PDFLib.StandardFonts.Helvetica);

      const page1 = demoDoc.addPage([595.28, 841.89]);
      page1.drawText('Global Technology & AI Industry Quarterly Report', {
        x: 50, y: 780, size: 16, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1)
      });
      page1.drawText('Executive Overview & Key Market Trends', {
        x: 50, y: 755, size: 12, font: fontBold, color: PDFLib.rgb(0.5, 0.2, 0.8)
      });

      const sampleLinesPage1 = [
        "Artificial intelligence and client-side web computing have experienced unprecedented growth in recent years.",
        "Modern web browsers now leverage high-performance JavaScript engines capable of complex document processing.",
        "Privacy-first architectures represent a major milestone for enterprise security and personal data confidentiality.",
        "By processing sensitive financial and legal PDF documents locally within the user client environment, organizations reduce data breach vulnerabilities by more than eighty percent.",
        "Cloud storage costs and network bandwidth requirements are substantially decreased when client devices compress documents before transmission.",
        "Recent market surveys demonstrate that ninety-two percent of enterprise technology leaders prioritize on-device data processing over centralized server workflows.",
        "Document intelligence frameworks extract structural metadata, key sentence clusters, and semantic frequency maps in real time.",
        "The shift towards decentralization empowers end users while maintaining compliance with strict international data protection regulations."
      ];

      let yPos = 710;
      sampleLinesPage1.forEach(line => {
        page1.drawText(line, { x: 50, y: yPos, size: 10, font: fontRegular, color: PDFLib.rgb(0.2, 0.2, 0.2) });
        yPos -= 28;
      });

      const page2 = demoDoc.addPage([595.28, 841.89]);
      page2.drawText('Strategic Recommendations & Future Projections', {
        x: 50, y: 780, size: 14, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1)
      });

      const sampleLinesPage2 = [
        "Next-generation applications will standardize browser-based processing pipelines across desktop and mobile devices.",
        "Optimized image compression formats drastically diminish document payload sizes without degrading typographic legibility.",
        "Automated extractive summarization algorithms enable professionals to comprehend hundred-page manuscripts within seconds.",
        "Continuous improvements in client-side runtime environments ensure sub-second response times for complex vector graphics rendering.",
        "In conclusion, modern client applications bridge the gap between heavy desktop utilities and agile web software."
      ];

      yPos = 730;
      sampleLinesPage2.forEach(line => {
        page2.drawText(line, { x: 50, y: yPos, size: 10, font: fontRegular, color: PDFLib.rgb(0.2, 0.2, 0.2) });
        yPos -= 28;
      });

      const bytes = await demoDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const sampleFile = new File([blob], 'AI_Quarterly_Research_Report.pdf', { type: 'application/pdf' });

      await this.handleFile(sampleFile);
      App.showToast('Loaded research report sample for text extraction & summary!', 'success');
    } catch (err) {
      App.hideProgress();
      App.showToast('Failed to create sample report.', 'error');
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  PdfSummarizer.init();
});
