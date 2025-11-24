/**
 * PDF Generator Utility
 * Shared logic for generating PDF definitions from resume JSON
 * Used by both popup and content scripts
 */

/**
 * Generate PDF document definition from resume JSON
 * @param {Object} jsonData - Resume JSON data
 * @returns {Object} pdfMake document definition
 */
export function generatePdfDefinition(jsonData) {
  console.log('Generating PDF from resume data...');
  
  // Aggressively optimized for maximum space utilization
  const accentColor = '#4285F4'; // Modern blue accent
  const greyColor = '#6c757d';   // Grey color for dates/secondary text
  const lineColor = '#e0e0e0';   // Light grey for separator lines
  const headingFontSize = 12;    // Further reduced from 13
  const sectionFontSize = 10;    // Further reduced from 11
  const bodyFontSize = 9.5;      // Slightly reduced but still readable
  const smallFontSize = 8.5;

  const content = [];
  
  // --- Helper function to add a horizontal line ---
  const addLineSeparator = () => {
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 1, x2: 515, y2: 1, lineWidth: 0.5, lineColor: lineColor }],
      margin: [0, 0, 0, 2] // Further reduced margin below line
    });
  };

  // --- 1. Header Section ---
  if (jsonData.contact) {
    if (jsonData.contact.name) {
      content.push({ text: jsonData.contact.name, style: 'nameHeader' });
    }
    
    // Job Title (role)
    const jobTitle = jsonData.jobTitle || 'SOFTWARE DEVELOPER';
    content.push({ text: jobTitle.toUpperCase(), style: 'jobTitleHeader', color: accentColor });

    // Consolidate ALL contact info into a single line for maximum space efficiency
    const allContactParts = [];
    
    if (jsonData.contact.phone) allContactParts.push(jsonData.contact.phone);
    if (jsonData.contact.email) allContactParts.push({ text: jsonData.contact.email, link: `mailto:${jsonData.contact.email}`, style: 'linkPlain' });
    if (jsonData.contact.linkedin) allContactParts.push({ text: 'LinkedIn', link: jsonData.contact.linkedin, style: 'linkPlain' });
    if (jsonData.contact.github) allContactParts.push({ text: 'GitHub', link: jsonData.contact.github, style: 'linkPlain' });
    if (jsonData.contact.portfolio) allContactParts.push({ text: 'Portfolio', link: jsonData.contact.portfolio, style: 'linkPlain' });
    
    // Create single contact line with all information
    if (allContactParts.length > 0) {
      const singleContactLine = [];
      allContactParts.forEach((part, index) => {
        singleContactLine.push(part);
        if (index < allContactParts.length - 1) {
          singleContactLine.push({ text: ' | ', color: greyColor, margin: [1, 0] });
        }
      });
      content.push({ text: singleContactLine, style: 'contactInfo', alignment: 'center' });
    }
    
    content.push({ text: ' ', margin: [0, 3] }); // Further reduced space after header
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
      
      content.push({ text: ' ', margin: [0, 1] }); // Minimal space between education entries
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
          margin: [0, 0, 0, 1] // Further reduced from [0, 0, 0, 2]
        });
      }
    });
    content.push(...skillsContent);
    content.push({ text: ' ', margin: [0, 1] }); // Minimal section spacing
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
          ul: exp.bullets.map(bullet => ({text: bullet, margin: [0, 0.2]})), // Further reduced from [0, 0.5]
          style: 'list',
          margin: [0, 1, 0, 0]  // Further reduced from [0, 2, 0, 0]
        });
      }
      
      content.push({ text: ' ', margin: [0, 0] }); // Zero space between experience entries
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
        content.push({ text: proj.description, style: 'paragraph', margin: [0, 0, 0, 1] }); // Further reduced margins
      }
      
      // Technologies used
      if (proj.technologies && Array.isArray(proj.technologies)) {
        content.push({ 
          text: [
            {text: 'Technologies used: ', style: 'techLabel', italics: true, color: greyColor},
            {text: proj.technologies.join(', '), style: 'details'}
          ],
          margin: [0, 0, 0, 1]  // Further reduced from 2
        });
      }
      
      content.push({ text: ' ', margin: [0, 0] }); // Zero space between projects
    });
  }

  // --- 6. Achievements Section ---
  if (jsonData.achievements && jsonData.achievements.length > 0) {
    content.push({ text: 'Achievements', style: 'sectionHeader', color: accentColor });
    addLineSeparator();
    
    content.push({ 
      ul: jsonData.achievements.map(achievement => ({text: achievement, margin: [0, 0.2]})), // Further reduced from [0, 0.5]
      style: 'list',
      margin: [0, 0, 0, 0]
    });
            
      content.push({ text: ' ', margin: [0, 1] }); // Minimal section spacing
    }

  return {
    content: content,
    styles: {
      nameHeader: { 
        fontSize: 20,  // Further reduced from 22 
        bold: true, 
        alignment: 'center', 
        margin: [0, 0, 0, 1]  // Further reduced from 2
      },
      jobTitleHeader: { 
        fontSize: 12,  // Further reduced from 14
        alignment: 'center', 
        margin: [0, 0, 0, 4],  // Further reduced from 6
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
        margin: [0, 6, 0, 0]  // Further reduced from [0, 8, 0, 1]
      },
      itemTitle: { 
        fontSize: bodyFontSize + 1, 
        bold: true, 
        margin: [0, 0, 0, 1]  // Reduced from 2
      },
      itemSubtitle: { 
        fontSize: bodyFontSize, 
        italics: true, 
        margin: [0, 0, 0, 1]  // Reduced from 2
      },
      locationDate: { 
        fontSize: smallFontSize, 
        color: greyColor 
      },
      paragraph: { 
        fontSize: bodyFontSize, 
        margin: [0, 0, 0, 1],  // Further reduced from [0, 1, 0, 2]
        lineHeight: 1.1        // Further reduced from 1.15 for maximum compression
      },
      list: { 
        fontSize: bodyFontSize, 
        margin: [8, 0, 0, 2]  // Further reduced from [10, 0, 0, 3]
      },
      details: { 
        fontSize: smallFontSize, 
        color: 'black', 
        margin: [0, 0, 0, 1]   // Reduced from 2
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
      lineHeight: 1.05  // Further reduced from 1.1 for maximum compression
    },
    pageSize: 'A4',
    pageMargins: [25, 20, 25, 20] // Further reduced margins: [left, top, right, bottom]
  };
}

// Create a namespace object for backward compatibility with legacy global usage
export const PdfGenerator = {
  generatePdfDefinition
};

// Expose globally so non-module popup scripts can access it
if (typeof window !== 'undefined') {
  window.PdfGenerator = PdfGenerator;
} else if (typeof self !== 'undefined') {
  self.PdfGenerator = PdfGenerator;
} else if (typeof global !== 'undefined') {
  global.PdfGenerator = PdfGenerator;
}
