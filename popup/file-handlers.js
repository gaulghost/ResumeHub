/**
 * File Handlers Module
 * Manages file upload, download, and format conversion operations
 */

class FileHandlers {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.supportedFormats = {
      upload: ['.pdf', '.doc', '.docx', '.txt'],
      download: ['docx', 'pdf', 'txt']
    };
  }

  /**
   * Handle resume file upload
   */
  async handleResumeUpload(file) {
    try {
      console.log(`📁 User clicked upload resume: ${file.name}`);
      
      if (!file) {
        throw new Error('No file selected');
      }

      // Validate file using SharedUtilities
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!SharedUtilities.validateFileType(file.name, allowedTypes)) {
        throw new Error('Invalid type. Use PDF, DOCX, or TXT.');
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(`File size too large. Maximum size is ${SharedUtilities.formatFileSize(maxSize)}.`);
      }

      // Read file as base64
      const base64Content = await this.readFileAsBase64(file);
      
      // Invalidate old resume cache before storing new one
      if (window.ResumeCacheOptimizer) {
        try {
          const tempOptimizer = new ResumeCacheOptimizer(null); // Don't need API client for cache invalidation
          await tempOptimizer.invalidateResumeCache(); // Invalidate all resume caches
        } catch (cacheError) {
          // Silent failure for cache invalidation
        }
      }
      
      // Store in state
      await this.stateManager.setResume(file.name, base64Content, file.type);
      
      console.log('✅ Successfully stored resume');
      return {
        success: true,
        filename: file.name,
        size: file.size,
        type: file.type
      };

    } catch (error) {
      console.error(`❌ Resume upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read file as base64
   */
  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        // Extract just the base64 part (after the comma) like original implementation
        const base64Content = e.target.result.split(',')[1];
        resolve(base64Content);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Download original resume file
   */
  downloadOriginalResume() {
    try {
      console.log('📥 User clicked download resume');
      
      const resume = this.stateManager.getResume();
      
      if (!resume.filename || !resume.content || !resume.mimeType) {
        throw new Error('No resume file available for download');
      }

      // Convert Base64 back to binary data like original implementation
      const byteCharacters = atob(resume.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: resume.mimeType });
      
      // Create download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = resume.filename;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('✅ Successfully downloaded resume');
      return true;

    } catch (error) {
      console.error(`❌ Resume download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download generated resume in specified format
   */
  downloadGeneratedResume(format = 'txt') {
    try {
      const resumeJSON = this.stateManager.getGeneratedResume();
      
      if (!resumeJSON) {
        throw new Error('No generated resume available. Please create a tailored resume first.');
      }

      const baseFilename = this.generateFilename();
      
      switch (format.toLowerCase()) {
        case 'txt':
          return this.downloadAsText(resumeJSON, baseFilename);
        case 'pdf':
          return this.downloadAsPdf(resumeJSON, baseFilename);
        case 'docx':
          return this.downloadAsDocx(resumeJSON, baseFilename);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

    } catch (error) {
      console.error(`Error downloading ${format} resume:`, error);
      throw error;
    }
  }

  /**
   * Download resume as text file
   */
  downloadAsText(resumeJSON, baseFilename) {
    const textContent = this.convertResumeJSONToText(resumeJSON);
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    this.downloadBlob(url, `${baseFilename}.txt`);
    console.log('✅ Successfully downloaded TXT resume');
    return true;
  }

  /**
   * Download resume as PDF
   */
  downloadAsPdf(resumeJSON, baseFilename) {
    try {
      // Check if pdfMake is available
      if (typeof pdfMake === 'undefined') {
        throw new Error('PDF generation library not available');
      }

      const docDefinition = PdfGenerator.generatePdfDefinition(resumeJSON);
      
      pdfMake.createPdf(docDefinition).download(`${baseFilename}.pdf`);
      console.log('✅ Successfully downloaded PDF resume');
      return true;

    } catch (error) {
      console.error(`❌ PDF generation failed: ${error.message}`);
      throw new Error('Failed to generate PDF. Please try TXT format instead.');
    }
  }

  /**
   * Download resume as DOCX (placeholder - would need additional library)
   */
  downloadAsDocx(resumeJSON, baseFilename) {
    // Check if DocxGenerator is available
    if (typeof DocxGenerator === 'undefined') {
      console.error('DocxGenerator not loaded');
      // Fallback or error handling
      console.warn('DOCX generation not fully implemented, falling back to text format');
      const textContent = this.convertResumeJSONToText(resumeJSON);
      const blob = new Blob([textContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      this.downloadBlob(url, `${baseFilename}.docx`);
      return true;
    }

    const blob = DocxGenerator.generateDocxBlob(resumeJSON);
    const url = URL.createObjectURL(blob);
    
    this.downloadBlob(url, `${baseFilename}.docx`);
    console.log('Resume downloaded as DOCX (text format)');
    return true;
  }

  /**
   * Convert resume JSON to formatted text
   */
  /**
   * Convert resume JSON to text using SharedUtilities
   */
  convertResumeJSONToText(jsonData) {
    return SharedUtilities.convertJSONToText(jsonData);
  }

  /**
   * Helper method to format sections
   */
  formatSectionText(title, items, itemFormatter) {
    if (!items || items.length === 0) return "";
    
    let sectionText = title.toUpperCase() + "\n\n";
    items.forEach(item => {
      sectionText += itemFormatter(item);
      sectionText += "\n";
    });
    sectionText += "\n";
    
    return sectionText;
  }



  /**
   * Unified download function for all file types
   */
  downloadBlob(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up object URL
    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename with timestamp using SharedUtilities
   */
  generateFilename() {
    return SharedUtilities.generateTimestampedFilename('tailored_resume', '').replace(/\.$/, '');
  }

  /**
   * Get file extension from filename using SharedUtilities
   */
  getFileExtension(filename) {
    return SharedUtilities.getFileExtension(filename);
  }

  /**
   * Validate file type using SharedUtilities
   */
  isValidFileType(filename, allowedTypes) {
    return SharedUtilities.validateFileType(filename, allowedTypes);
  }

  /**
   * Format file size for display using SharedUtilities
   */
  formatFileSize(bytes) {
    return SharedUtilities.formatFileSize(bytes);
  }
}

// Make FileHandlers available globally for the popup
if (typeof window !== 'undefined') {
  window.FileHandlers = FileHandlers;
} 