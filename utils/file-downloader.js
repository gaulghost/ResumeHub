/**
 * File Download Utility
 * Centralized download functionality for resume files in multiple formats
 */

import { convertJSONToText, generateTimestampedFilename } from './shared-utilities.js';

export class FileDownloader {
  /**
   * Download resume as plain text file
   * @param {Object} resumeJSON - Resume data in JSON format
   * @param {string} baseFilename - Base filename without extension
   * @param {Function} textConverter - Function to convert JSON to text (defaults to SharedUtilities)
   * @returns {boolean} True if successful
   */
  static downloadAsText(resumeJSON, baseFilename, textConverter = null) {
    try {
      let textContent;
      
      // Use provided converter or direct import
      if (textConverter && typeof textConverter === 'function') {
        textContent = textConverter(resumeJSON);
      } else if (convertJSONToText) {
        textContent = convertJSONToText(resumeJSON);
      } else {
        throw new Error('Text converter not available.');
      }

      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      this.downloadBlob(url, `${baseFilename}.txt`);
      console.log('✅ Successfully downloaded TXT resume');
      return true;
    } catch (error) {
      console.error(`❌ TXT download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download resume as PDF file
   * @param {Object} resumeJSON - Resume data in JSON format
   * @param {string} baseFilename - Base filename without extension
   * @param {Function} pdfDefinitionGenerator - Function to generate PDF definition
   * @returns {boolean} True if successful
   */
  static downloadAsPdf(resumeJSON, baseFilename, pdfDefinitionGenerator = null) {
    try {
      // Check if pdfMake is available
      if (typeof pdfMake === 'undefined') {
        throw new Error('PDF generation library (pdfMake) not available');
      }

      // Use provided generator or throw error
      if (!pdfDefinitionGenerator || typeof pdfDefinitionGenerator !== 'function') {
        throw new Error('PDF definition generator function is required');
      }

      const docDefinition = pdfDefinitionGenerator(resumeJSON);
      pdfMake.createPdf(docDefinition).download(`${baseFilename}.pdf`);
      
      console.log('✅ Successfully downloaded PDF resume');
      return true;
    } catch (error) {
      console.error(`❌ PDF generation failed: ${error.message}`);
      throw new Error('Failed to generate PDF. Please try TXT format instead.');
    }
  }

  /**
   * Download resume as DOCX file (fallback to text format)
   * @param {Object} resumeJSON - Resume data in JSON format
   * @param {string} baseFilename - Base filename without extension
   * @param {Function} textConverter - Function to convert JSON to text
   * @returns {boolean} True if successful
   */
  static downloadAsDocx(resumeJSON, baseFilename, textConverter = null) {
    try {
      // DOCX generation not fully implemented - fallback to text format
      console.warn('DOCX generation not fully implemented, using text format');
      
      let textContent;
      
      // Use provided converter or direct import
      if (textConverter && typeof textConverter === 'function') {
        textContent = textConverter(resumeJSON);
      } else if (convertJSONToText) {
        textContent = convertJSONToText(resumeJSON);
      } else {
        throw new Error('Text converter not available.');
      }

      const blob = new Blob([textContent], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const url = URL.createObjectURL(blob);
      
      this.downloadBlob(url, `${baseFilename}.docx`);
      console.log('Resume downloaded as DOCX (text format)');
      return true;
    } catch (error) {
      console.error(`❌ DOCX download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unified download function for blob URLs
   * @param {string} url - Blob URL to download
   * @param {string} filename - Filename for download
   */
  static downloadBlob(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up object URL after a short delay to ensure download starts
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Generate filename with timestamp
   * @param {string} prefix - Filename prefix (default: 'tailored_resume')
   * @param {string} suffix - Filename suffix (default: '')
   * @returns {string} Generated filename
   */
  static generateFilename(prefix = 'tailored_resume', suffix = '') {
    if (generateTimestampedFilename) {
      return generateTimestampedFilename(prefix, suffix).replace(/\.$/, '');
    }
    
    // Fallback if function not available
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}${suffix}`;
  }

  /**
   * Download resume in specified format
   * @param {Object} resumeJSON - Resume data in JSON format
   * @param {string} format - Format ('txt', 'pdf', 'docx')
   * @param {string} baseFilename - Base filename without extension
   * @param {Object} options - Optional callbacks and generators
   * @param {Function} options.textConverter - Function to convert JSON to text
   * @param {Function} options.pdfDefinitionGenerator - Function to generate PDF definition
   * @returns {boolean} True if successful
   */
  static downloadResume(resumeJSON, format, baseFilename = null, options = {}) {
    if (!resumeJSON) {
      throw new Error('Resume data is required');
    }

    // Generate filename if not provided
    if (!baseFilename) {
      baseFilename = this.generateFilename();
    }

    const { textConverter, pdfDefinitionGenerator } = options;

    switch (format.toLowerCase()) {
      case 'txt':
        return this.downloadAsText(resumeJSON, baseFilename, textConverter);
      case 'pdf':
        return this.downloadAsPdf(resumeJSON, baseFilename, pdfDefinitionGenerator);
      case 'docx':
        return this.downloadAsDocx(resumeJSON, baseFilename, textConverter);
      default:
        throw new Error(`Unsupported format: ${format}. Supported formats: txt, pdf, docx`);
    }
  }
}
