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

      // Validate file type (match original validation)
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid type. Use PDF, DOCX, or TXT.');
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('File size too large. Maximum size is 10MB.');
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
      this.stateManager.setResume(file.name, base64Content, file.type);
      
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

      const docDefinition = this.generatePdfDefinition(resumeJSON);
      
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
    // For now, fallback to text format with .docx extension
    // In a full implementation, you'd use a library like docx or similar
    console.warn('DOCX generation not fully implemented, falling back to text format');
    
    const textContent = this.convertResumeJSONToText(resumeJSON);
    const blob = new Blob([textContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
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
   * Generate PDF document definition
   */
  generatePdfDefinition(jsonData) {
    console.log('Generating PDF from resume data...');
    
    // Updated color scheme to match the professional design
    const accentColor = '#4285F4'; // Modern blue accent
    const greyColor = '#6c757d';   // Grey color for dates/secondary text
    const lineColor = '#e0e0e0';   // Light grey for separator lines
    const headingFontSize = 14;
    const sectionFontSize = 12;
    const bodyFontSize = 10;
    const smallFontSize = 9;

    const content = [];
    
    // --- Helper function to add a horizontal line ---
    const addLineSeparator = () => {
      content.push({
        canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.5, lineColor: lineColor }],
        margin: [0, 2, 0, 8] // Margin below line
      });
    };

    // --- 1. Header Section ---
    if (jsonData.contact) {
      if (jsonData.contact.name) {
        content.push({ text: jsonData.contact.name, style: 'nameHeader' });
      }
      
      // Job Title (role)
      content.push({ text: 'SOFTWARE DEVELOPER', style: 'jobTitleHeader', color: accentColor });

      // Contact info line with proper spacing and alignment
      const contactParts = [];
      
      if (jsonData.contact.phone) contactParts.push(jsonData.contact.phone);
      if (jsonData.contact.email) contactParts.push({ text: jsonData.contact.email, link: `mailto:${jsonData.contact.email}`, style: 'linkPlain' });
      
      // Improved separator handling
      if (contactParts.length > 0) {
        const contactLine = [];
        contactParts.forEach((part, index) => {
          contactLine.push(part);
          if (index < contactParts.length - 1) {
            contactLine.push({ text: ' | ', color: greyColor, margin: [2, 0] });
          }
        });
        content.push({ text: contactLine, style: 'contactInfo', alignment: 'center' });
      }
      
      // Add second line of contact info with LinkedIn and other links
      const secondLineParts = [];
      if (jsonData.contact.linkedin) secondLineParts.push({ text: 'LinkedIn', link: jsonData.contact.linkedin, style: 'linkPlain' });
      if (jsonData.contact.github) secondLineParts.push({ text: 'GitHub', link: jsonData.contact.github, style: 'linkPlain' });
      if (jsonData.contact.portfolio) secondLineParts.push({ text: 'Portfolio', link: jsonData.contact.portfolio, style: 'linkPlain' });
      
      if (secondLineParts.length > 0) {
        const secondLine = [];
        secondLineParts.forEach((part, index) => {
          secondLine.push(part);
          if (index < secondLineParts.length - 1) {
            secondLine.push({ text: ' | ', color: greyColor, margin: [2, 0] });
          }
        });
        content.push({ text: secondLine, style: 'contactInfo', alignment: 'center' });
      }
      
      content.push({ text: ' ', margin: [0, 10] }); // Extra space after header
    }

    // --- 2. Education Section ---
    if (jsonData.education && jsonData.education.length > 0) {
      content.push({ text: 'Education', style: 'sectionHeader', color: accentColor });
      addLineSeparator();
      
      jsonData.education.forEach(edu => {
        const degreeLine = edu.degree || '';
        const institutionLine = edu.institution || '';
        const location = edu.location || '';
        const dates = edu.dates || '';

        // Institution with location at right
        content.push({ 
          columns: [
            { text: institutionLine, style: 'itemTitle', width: '*' },
            { text: dates, style: 'locationDate', width: 'auto', alignment: 'right' }
          ],
          columnGap: 10
        });
        
        // Degree with indentation
        content.push({ text: degreeLine, style: 'itemSubtitle', italics: true });
        
        // GPA or other details if available
        if (edu.details) {
          content.push({ text: edu.details, style: 'details' });
        }
        
        content.push({ text: ' ', margin: [0, 5] }); // Space between education entries
      });
    }

    // --- 3. Skills Section ---
    if (jsonData.skills && Array.isArray(jsonData.skills) && jsonData.skills.length > 0) {
      content.push({ text: 'Skills', style: 'sectionHeader', color: accentColor });
      addLineSeparator();
      
      const skillsContent = [];
      jsonData.skills.forEach(skillCategory => {
        if (skillCategory.category && skillCategory.items && skillCategory.items.length > 0) {
          skillsContent.push({
            columns: [
              { width: 130, text: skillCategory.category, style: 'skillCategory', bold: true },
              { width: '*', text: skillCategory.items.join(' | '), style: 'skillItems' }
            ],
            columnGap: 10,
            margin: [0, 1, 0, 4]
          });
        }
      });
      content.push(...skillsContent);
      content.push({ text: ' ', margin: [0, 5] });
    }

    // --- 4. Work Experience Section ---
    if (jsonData.experience && jsonData.experience.length > 0) {
      content.push({ text: 'Work Experience', style: 'sectionHeader', color: accentColor });
      addLineSeparator();
      
      jsonData.experience.forEach(exp => {
        const titleLine = exp.title || '';
        const companyLine = exp.company || '';
        const location = exp.location || '';
        const dates = exp.dates || '';

        // Job title and company with date range right-aligned
        content.push({
          columns: [
            { text: `${titleLine} | ${companyLine}`, style: 'itemTitle', width: '*' },
            { text: dates, style: 'locationDate', width: 'auto', alignment: 'right' }
          ],
          columnGap: 10
        });

        // Bullets with proper indentation and spacing
        if (exp.bullets && exp.bullets.length > 0) {
          content.push({ 
            ul: exp.bullets.map(bullet => ({text: bullet, margin: [0, 1]})),
            style: 'list',
            margin: [0, 3, 0, 0]
          });
        }
        
        content.push({ text: ' ', margin: [0, 8] }); // Space between experience entries
      });
    }

    // --- 5. Projects Section ---
    if (jsonData.projects && jsonData.projects.length > 0) {
      content.push({ text: 'Projects', style: 'sectionHeader', color: accentColor });
      addLineSeparator();
      
      jsonData.projects.forEach(proj => {
        // Project name with optional link
        const titleLine = [];
        titleLine.push({ text: proj.name, style: 'itemTitle' });
        
        if (proj.link) {
          titleLine.push({ text: ` | `, color: greyColor });
          titleLine.push({ text: 'Link', link: proj.link, style: 'linkSmall', color: accentColor });
        }
        
        content.push({ text: titleLine });

        // Project description
        if (proj.description) {
          content.push({ text: proj.description, style: 'paragraph', margin: [0, 2, 0, 3] });
        }
        
        // Technologies used
        if (proj.technologies && Array.isArray(proj.technologies)) {
          content.push({ 
            text: [
              {text: 'Technologies used: ', style: 'techLabel', italics: true, color: greyColor},
              {text: proj.technologies.join(', '), style: 'details'}
            ],
            margin: [0, 0, 0, 3]
          });
        }
        
        content.push({ text: ' ', margin: [0, 5] }); // Space between projects
      });
    }

    // --- 6. Achievements Section ---
    if (jsonData.achievements && jsonData.achievements.length > 0) {
      content.push({ text: 'Achievements', style: 'sectionHeader', color: accentColor });
      addLineSeparator();
      
      content.push({ 
        ul: jsonData.achievements.map(achievement => ({text: achievement, margin: [0, 1]})),
        style: 'list',
        margin: [0, 0, 0, 0]
      });
      
      content.push({ text: ' ', margin: [0, 5] });
    }

    console.log('PDF content structure created successfully');

    return {
      content: content,
      styles: {
        nameHeader: { 
          fontSize: 28, 
          bold: true, 
          alignment: 'center', 
          margin: [0, 0, 0, 4] 
        },
        jobTitleHeader: { 
          fontSize: 16, 
          alignment: 'center', 
          margin: [0, 0, 0, 10], 
          color: accentColor 
        },
        contactInfo: { 
          fontSize: smallFontSize, 
          alignment: 'center', 
          margin: [0, 0, 0, 2], 
          color: 'black' 
        },
        sectionHeader: { 
          fontSize: headingFontSize, 
          bold: true, 
          margin: [0, 12, 0, 2]
        },
        itemTitle: { 
          fontSize: bodyFontSize + 1, 
          bold: true, 
          margin: [0, 0, 0, 2] 
        },
        itemSubtitle: { 
          fontSize: bodyFontSize, 
          italics: true, 
          margin: [0, 0, 0, 2] 
        },
        locationDate: { 
          fontSize: smallFontSize, 
          color: greyColor 
        },
        paragraph: { 
          fontSize: bodyFontSize, 
          margin: [0, 2, 0, 3], 
          lineHeight: 1.2 
        },
        list: { 
          fontSize: bodyFontSize, 
          margin: [10, 0, 0, 5] 
        },
        details: { 
          fontSize: smallFontSize, 
          color: 'black', 
          margin: [0, 0, 0, 2] 
        },
        techLabel: {
          fontSize: smallFontSize,
          color: greyColor
        },
        skillCategory: { 
          fontSize: bodyFontSize, 
          bold: true 
        },
        skillItems: { 
          fontSize: bodyFontSize 
        },
        linkPlain: { 
          fontSize: smallFontSize, 
          color: accentColor, 
          decoration: 'underline' 
        },
        linkSmall: { 
          fontSize: smallFontSize, 
          color: accentColor, 
          decoration: 'underline' 
        },
        // Legacy styles for backward compatibility
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        jobTitle: {
          fontSize: 12,
          bold: true,
          margin: [0, 5, 0, 2]
        },
        jobDetails: {
          fontSize: 10,
          italics: true,
          margin: [0, 0, 0, 5]
        },
        body: {
          fontSize: 11,
          margin: [0, 0, 0, 10]
        },
        bulletList: {
          fontSize: 11,
          margin: [20, 0, 0, 5]
        }
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: bodyFontSize,
        lineHeight: 1.2
      },
      pageSize: 'A4',
      pageMargins: [40, 30, 40, 30] // [left, top, right, bottom]
    };
  }

  /**
   * Trigger file download
   */
  triggerDownload(content, mimeType, extension) {
    const link = document.createElement('a');
    link.href = content;
    link.download = `resume.${extension}`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up object URL if it was created
    if (content.startsWith('blob:')) {
      URL.revokeObjectURL(content);
    }
  }

  /**
   * Download blob with filename
   */
  downloadBlob(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
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