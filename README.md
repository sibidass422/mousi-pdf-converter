# 👻 GhostPDF - Smart Private PDF Studio

**GhostPDF** is a 100% client-side, ultra-fast, mobile-responsive PDF studio built with vanilla modern HTML5, CSS3, and JavaScript. All document processing happens directly in your browser with zero server uploads, keeping your documents completely private and secure.

---

## 🚀 Key Features

### 1. ✂️ PDF Cutter & Page Splitter (e.g., 20 to 23 of 100 Pages)
- **Flexible Page Range Parser**: Type `20-23`, `20 to 23`, `1, 4, 10-15` or comma-separated lists to instantly select exact pages.
- **Visual Thumbnail Grid**: Renders live page thumbnails of all pages (even 100+ page documents) with lazy loading to preserve performance.
- **HD Zoom Preview**: Click any page preview icon to inspect pages before cutting.
- **Quick Selection Controls**: Select All, Deselect All, Invert Selection, Odd Pages, Even Pages.
- **Multi-Mode Extraction**:
  - **Extract Selected Pages (.PDF)**: Creates a single PDF containing only selected pages (e.g. `document_pages_20-23.pdf`).
  - **Split to Separate Files (.ZIP)**: Extracts each selected page into individual PDF files bundled into a single `.ZIP` archive.
  - **Delete Selected Pages (.PDF)**: Removes unwanted pages and exports the remainder.
- **⚡ Built-in 100-Page Sample Generator**: Test extracting pages 20-23 immediately with 1 click!

### 2. 🗜️ PDF Compressor (Low KB/MB & Quality Reducer)
- **File Size Targeting**: Reduce heavy PDFs down to low KB / MB for government portals, job applications, or email attachments.
- **Compression Presets**:
  - ⚡ **Extreme Compression**: Smallest possible file size in low KB.
  - ⚖️ **Recommended Balanced**: Optimal trade-off between readability and reduction.
  - 💎 **High Quality**: Crystal-clear images with gentle compression.
  - 🛠️ **Custom Sliders**: Fine-tune JPEG Quality (10% - 95%) and Resolution Scale (40% - 100%).
- **Before & After Statistics**: Displays Original Size vs Compressed Size and percentage saved (`-80% Saved`).

### 3. 🖼️ Image to PDF Converter
- **Multi-Image Support**: Convert JPG, PNG, WEBP, and other image formats.
- **Interactive Reordering**: Reorder images with Move Up / Move Down buttons or remove individual images.
- **Page Layout Customization**:
  - Page Size: *Fit to Image*, *A4*, *US Letter*.
  - Orientation: *Auto Match Image*, *Portrait*, *Landscape*.
  - Margins: *No Margin (Full Bleed)*, *Small Margin (20px)*, *Big Margin (40px)*.

### 4. ➕ PDF Add & Merge (PDF Combiner)
- Combine two or more PDF documents into a master PDF.
- Reorder PDF documents before merging.
- Shows page count and file size of each document.

### 5. 📝 PDF Text Extraction & Smart Summary
- **Text Extraction**: Reads text from every page of the PDF in milliseconds.
- **Document Intelligence**: Word count, character count, page count, and estimated reading time.
- **Top Keywords**: Automatic keyword and topic cloud extraction.
- **Smart Extractive Summarizer (100% Offline)**:
  - TextRank / sentence scoring algorithm calculates the most important sentences.
  - Modes: *Key Takeaways (Bullet Points)*, *Executive Summary (Paragraphs)*, and *Detailed Highlights*.
  - Adjustable summary length (3 to 20 sentences).
- **Export Options**: Copy to clipboard, download as `.TXT`, or export as a formatted `.PDF` summary report.

---

## 🎨 Ghost Theme & Design
- **Theme**: Dark Mode & Light Mode with custom frosted glassmorphic cards, glowing neon accents, and animated Ghost mascot.
- **100% Mobile Responsive**: Seamlessly adapts to smartphones, tablets, and desktop displays.
- **Completely Offline**: All core libraries (`pdf-lib`, `pdf.js`, `jszip`) are bundled locally inside the `libs/` directory.

---

## 💻 How to Run

Simply **double-click** `start-ghostpdf.bat` or open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Brave, Firefox, Safari).

No installation, Node.js, or web server required!
