/**
 * DOCX Generator Utility
 * Shared logic for generating DOCX files (currently text fallback)
 * Used by both popup and content scripts
 */

/**
 * Generate DOCX Blob from resume JSON
 * Currently implements a text fallback with .docx extension
 * @param {Object} jsonData - Resume JSON data
 * @returns {Blob} DOCX blob (text content)
 */
export function generateDocxBlob(jsonData) {
  // For now, fallback to text format with .docx extension
  // In a full implementation, you'd use a library like docx or similar
  console.warn('[ResumeHub] DOCX generation not fully implemented, falling back to text format');
  
  const textContent = SharedUtilities.convertJSONToText(jsonData);
  return new Blob([textContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Create a namespace object for backward compatibility with legacy global usage
export const DocxGenerator = {
  generateDocxBlob
};

// Expose globally so non-module popup scripts can access it
if (typeof window !== 'undefined') {
  window.DocxGenerator = DocxGenerator;
} else if (typeof self !== 'undefined') {
  self.DocxGenerator = DocxGenerator;
} else if (typeof global !== 'undefined') {
  global.DocxGenerator = DocxGenerator;
}
