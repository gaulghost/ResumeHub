// ResumeHub popup script (Modern UI)

document.addEventListener('DOMContentLoaded', function() {
    console.log('ResumeHub Modern UI popup loaded.');

    // --- UI Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const apiTokenInput = document.getElementById('api-token');
    const apiTokenStatusSpan = document.getElementById('api-token-status');
    const resumeUploadInput = document.getElementById('resume-upload');
    const resumeUploadStatusSpan = document.getElementById('resume-upload-status');
    const clearResumeBtn = document.getElementById('clear-resume-btn');
    const downloadResumeBtn = document.getElementById('download-resume-btn');
    const createResumeBtn = document.getElementById('create-resume-btn');
    const statusMessageDiv = document.getElementById('status-message');
    const downloadButtonsContainer = document.getElementById('download-buttons-container');
    const downloadDocxBtn = document.getElementById('download-docx-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const extractionMethodRadios = document.querySelectorAll('input[name="extractionMethod"]');
    const apiKeyCard = document.getElementById('api-key-card');
    const extractionCard = document.getElementById('extraction-method-card');
    const resumeCard = document.getElementById('resume-card');
    const collapsibleHeaders = document.querySelectorAll('.card-header');
    const previewBtn = document.getElementById('preview-jd-btn');
    const previewOutput = document.getElementById('preview-jd-output');
    const manualJdInputArea = document.getElementById('manual-jd-input-area');
    const manualJdTextarea = document.getElementById('manual-jd-textarea');
    const autoFillBtn = document.getElementById('auto-fill-btn');
    const autoFillStatus = document.getElementById('auto-fill-status');

    // --- State ---
    let storedResume = { 
        filename: null, 
        content: null, // Base64 content 
        mimeType: null 
    };
    let isProcessing = false; // Flag to prevent multiple clicks
    let selectedExtractionMethod = 'standard'; // Default
    let isPreviewing = false; // Flag for preview loading state
    let currentGeneratedResumeJSON = null; // NEW state variable for JSON data

    // --- Helper Function to Apply Theme --- 
    function applyTheme(theme, isInitialLoad = false) {
        document.body.className = `theme-${theme}`;
        if (!isInitialLoad) {
            console.log('Theme applied to body:', theme);
        }
    }
    
    // --- Helper Function to Toggle Card Collapse State ---
    function toggleCard(cardElement, forceCollapse = null) {
        if (!cardElement) {
            console.error('toggleCard called with null element');
            return;
        }
        
        const isCollapsed = cardElement.classList.contains('is-collapsed');
        const shouldCollapse = forceCollapse !== null ? forceCollapse : !isCollapsed;
        const button = cardElement.querySelector('.toggle-button');
        
        console.log(`Toggling card ${cardElement.id}, currently collapsed: ${isCollapsed}, setting to: ${shouldCollapse}`);
        
        if (shouldCollapse) {
            cardElement.classList.add('is-collapsed');
            if (button) {
                button.textContent = '▶';
                button.setAttribute('aria-expanded', 'false');
            }
        } else {
            cardElement.classList.remove('is-collapsed');
            if (button) {
                button.textContent = '▼';
                button.setAttribute('aria-expanded', 'true');
            }
        }
    }
    
    // --- Helper Function to Update Resume Status UI ---
    function updateResumeStatusUI() {
        if (storedResume.filename) {
            resumeUploadStatusSpan.textContent = `Using: ${storedResume.filename}`;
            resumeUploadStatusSpan.style.color = 'var(--color-success)';
            clearResumeBtn.style.display = 'inline-block';
            downloadResumeBtn.style.display = 'inline-block';
            
            // Explicitly collapse the resume card when a resume is loaded
            console.log('Resume found, collapsing resume card');
            toggleCard(resumeCard, true);
        } else {
            resumeUploadStatusSpan.textContent = 'No file selected.';
            resumeUploadStatusSpan.style.color = 'var(--text-secondary)';
            clearResumeBtn.style.display = 'none';
            downloadResumeBtn.style.display = 'none';
            resumeUploadInput.value = '';
            
            // Expand the resume card when no resume is loaded
            console.log('No resume found, expanding resume card');
            toggleCard(resumeCard, false);
        }
    }

    // --- Helper Function to Handle Extraction Method UI ---
    function handleExtractionMethodChange(method) {
        selectedExtractionMethod = method;
        console.log("Extraction method changed to:", selectedExtractionMethod);
        
        const isManualMethod = (method === 'manual');

        // Control visibility of the manual input area
        if (manualJdInputArea) {
            if (isManualMethod) {
                manualJdInputArea.classList.remove('is-hidden');
                previewBtn.disabled = true;
                if (!extractionCard.classList.contains('is-collapsed')) {
                    previewOutput.value = 'Preview not applicable for manual input.';
                    previewOutput.style.color = 'var(--text-secondary)';
                }
            } else {
                manualJdInputArea.classList.add('is-hidden');
                previewBtn.disabled = false;
            }
        }
        
        // Collapse card if not manual method
        toggleCard(extractionCard, !isManualMethod);

        // Save preference
        chrome.storage.sync.set({ extractionMethod: selectedExtractionMethod });
    }

    // --- Initialize UI based on storage ---
    function initializeUI() {
        // First load sync storage (preferences)
        chrome.storage.sync.get(['theme', 'extractionMethod'], (syncResult) => {
            // Apply theme
            const theme = syncResult.theme || 'light';
            applyTheme(theme, true);
            themeToggle.checked = (theme === 'dark');
            
            // Set extraction method
            selectedExtractionMethod = syncResult.extractionMethod || 'standard';
            const currentRadio = document.querySelector(`input[name="extractionMethod"][value="${selectedExtractionMethod}"]`);
            if (currentRadio) currentRadio.checked = true;
            console.log("Loaded extraction method preference:", selectedExtractionMethod);
            
            // Now load local storage (resume data and API token)
            chrome.storage.local.get(['resumeFilename', 'resumeContent', 'resumeMimeType', 'apiToken'], (result) => {
                // Set resume data
                if (result.resumeFilename && result.resumeContent && result.resumeMimeType) {
                    storedResume.filename = result.resumeFilename;
                    storedResume.content = result.resumeContent;
                    storedResume.mimeType = result.resumeMimeType;
                }
                
                // Update resume UI (will handle collapsing)
                updateResumeStatusUI();
                
                // Handle API token
                if (result.apiToken) {
                    apiTokenInput.value = result.apiToken;
                    apiTokenStatusSpan.textContent = 'Loaded from storage.';
                    apiTokenStatusSpan.style.color = 'var(--color-success)';
                    toggleCard(apiKeyCard, true); // Collapse if token exists
                } else {
                    apiTokenStatusSpan.textContent = '';
                    toggleCard(apiKeyCard, false); // Expand if no token
                }
                
                // Configure extraction method UI
                handleExtractionMethodChange(selectedExtractionMethod);
            });
        });
    }

    // --- Event Listeners ---

    // Card Collapse Toggle Listener
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', (event) => {
            // Check if the click target is the header itself or one of its direct children
            // (like the h2 title), but *not* another interactive element like an input.
            // Allow clicks on the toggle button specifically.
            const isToggleButton = event.target.classList.contains('toggle-button');
            
            // Only proceed if the click wasn't on an input/textarea/select OR if it was the toggle button
            if (!event.target.closest('input, textarea, select') || isToggleButton) {
                const card = header.closest('.collapsible');
                if (card) {
                    // If the click was specifically on the button, toggle its parent card
                    // Otherwise, if the click was elsewhere in the header (but not input), toggle
                    toggleCard(card);
                }
            }
        });
    });

    // Theme Toggle
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        chrome.storage.sync.set({ theme: newTheme }); // Save preference
    });

    // Extraction Method Change
    extractionMethodRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.checked) {
                handleExtractionMethodChange(event.target.value);
            }
        });
    });

    // Resume Upload Handling
    resumeUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Basic validation
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
            resumeUploadStatusSpan.textContent = `Invalid type. Use PDF, DOCX, or TXT.`;
            resumeUploadStatusSpan.style.color = 'var(--color-danger)';
            resumeUploadInput.value = '';
            clearResumeBtn.style.display = storedResume.filename ? 'inline-block' : 'none';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileContentBase64 = e.target.result.split(',')[1]; 
            const mimeType = file.type;
            
            storedResume.filename = file.name;
            storedResume.content = fileContentBase64;
            storedResume.mimeType = mimeType;
            
            // Store in chrome.storage.local
            chrome.storage.local.set({ 
                resumeFilename: file.name,
                resumeContent: fileContentBase64,
                resumeMimeType: mimeType
            }, () => {
                if (chrome.runtime.lastError) {
                    resumeUploadStatusSpan.textContent = 'Error saving resume.';
                    resumeUploadStatusSpan.style.color = 'var(--color-danger)';
                    console.error("Error saving resume:", chrome.runtime.lastError);
                } else {
                    console.log('Resume saved:', file.name, 'Type:', mimeType);
                }
                updateResumeStatusUI(); // Update UI after storage operation completes
            });
        };
        reader.onerror = function() {
            resumeUploadStatusSpan.textContent = 'Error reading file.';
            resumeUploadStatusSpan.style.color = 'var(--color-danger)';
            console.error("Error reading file:", reader.error);
        }
        reader.readAsDataURL(file); 
    });

    // Clear Resume Button
    clearResumeBtn.addEventListener('click', () => {
        storedResume = { filename: null, content: null, mimeType: null };
        chrome.storage.local.remove(['resumeFilename', 'resumeContent', 'resumeMimeType'], () => {
            if (chrome.runtime.lastError) {
                console.error("Error clearing resume storage:", chrome.runtime.lastError);
            } else {
                console.log("Stored resume cleared.");
            }
            updateResumeStatusUI(); // Update UI after storage operation completes
        });
    });

    // Download Stored Resume Button
    downloadResumeBtn.addEventListener('click', () => {
        if (!storedResume.content || !storedResume.mimeType || !storedResume.filename) {
            console.error("No stored resume data to download.");
            // Optionally show a message to the user
            statusMessageDiv.textContent = 'No resume stored to download.';
            statusMessageDiv.className = 'status-message warning';
            return;
        }
        
        try {
            // Convert Base64 back to binary data
            const byteCharacters = atob(storedResume.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: storedResume.mimeType });
            
            // Create a temporary link for download
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = storedResume.filename; // Use the original filename
            document.body.appendChild(link); // Required for Firefox
            link.click();
            
            // Clean up
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log("Stored resume downloaded:", storedResume.filename);
            
        } catch (error) {
            console.error("Error creating download link for stored resume:", error);
            statusMessageDiv.textContent = 'Error preparing resume for download.';
            statusMessageDiv.className = 'status-message error';
        }
    });

    // API Token Handling
    apiTokenInput.addEventListener('input', () => {
        const token = apiTokenInput.value.trim();
        if (token) {
            chrome.storage.local.set({ apiToken: token }, () => {
                if (chrome.runtime.lastError) {
                    apiTokenStatusSpan.textContent = 'Error saving.';
                    apiTokenStatusSpan.style.color = 'var(--color-danger)';
                    console.error("Error saving API token:", chrome.runtime.lastError);
                } else {
                    apiTokenStatusSpan.textContent = 'Saved.';
                    apiTokenStatusSpan.style.color = 'var(--color-success)';
                    toggleCard(apiKeyCard, true); // Collapse when token is saved
                }
            });
        } else {
            chrome.storage.local.remove('apiToken', () => {
                apiTokenStatusSpan.textContent = 'Removed.';
                apiTokenStatusSpan.style.color = 'var(--text-secondary)'; 
                toggleCard(apiKeyCard, false); // Expand if token removed
            });
        }
    });

    // Preview Job Description Button Click
    previewBtn.addEventListener('click', () => {
        if (isPreviewing) return; // Prevent multiple clicks

        isPreviewing = true;
        previewBtn.disabled = true;
        previewBtn.textContent = 'Loading...';
        previewOutput.value = 'Attempting extraction...';
        previewOutput.style.color = 'var(--color-warning)';

        const currentExtractionMethod = document.querySelector('input[name="extractionMethod"]:checked')?.value || 'standard';
        const apiKeyForAIExtraction = apiTokenInput.value.trim();

        // Check if API key is needed but missing for AI extraction
        if (currentExtractionMethod === 'ai' && !apiKeyForAIExtraction) {
            previewOutput.value = 'Error: API Key required for AI-Powered extraction.';
            previewOutput.style.color = 'var(--color-danger)';
            isPreviewing = false;
            previewBtn.disabled = false;
            previewBtn.textContent = 'Preview';
            return;
        }

        console.log(`Sending preview request (method: ${currentExtractionMethod})...`);
        chrome.runtime.sendMessage({
            action: "getJobDescription",
            extractionMethod: currentExtractionMethod,
            apiToken: currentExtractionMethod === 'ai' ? apiKeyForAIExtraction : null 
        }, (response) => {
            isPreviewing = false;
            previewBtn.disabled = false;
            previewBtn.textContent = 'Preview';
            previewOutput.style.color = 'var(--text-secondary)';

            if (chrome.runtime.lastError) {
                console.log("Preview message failed:", chrome.runtime.lastError);
                previewOutput.value = `Error: ${chrome.runtime.lastError.message}`;
                previewOutput.style.color = 'var(--color-danger)';
                return;
            }

            console.log('Preview response received:', response);
            if (response && response.success) {
                previewOutput.value = response.jobDescription || '[No description extracted]';
                previewOutput.style.color = 'var(--text)';
            } else if (response && response.error) {
                previewOutput.value = `Error: ${response.error}`;
                previewOutput.style.color = 'var(--color-danger)';
            } else {
                previewOutput.value = 'Unknown error during preview.';
                previewOutput.style.color = 'var(--color-danger)';
            }
        });
    });

    // Auto-fill button click handler
    autoFillBtn.addEventListener('click', () => {
        handleAutoFillForm();
    });

    // Handle Auto-Fill Form functionality
    async function handleAutoFillForm() {
        console.log('Auto-fill button clicked');
        
        // Validate prerequisites
        if (!storedResume.content) {
            autoFillStatus.textContent = '❌ Error: Please upload a resume first';
            autoFillStatus.className = 'status-message error';
            return;
        }

        // Get API token
        const apiToken = apiTokenInput.value.trim();
        if (!apiToken) {
            autoFillStatus.textContent = '❌ Error: Please enter your API token first';
            autoFillStatus.className = 'status-message error';
            return;
        }

        // Disable button and show loading state
        autoFillBtn.disabled = true;
        autoFillBtn.textContent = 'Processing...';
        autoFillStatus.textContent = '🔄 Analyzing form fields and filling data...';
        autoFillStatus.className = 'status-message processing';

        try {
            // Send message to background script
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: "autoFillForm",
                    resumeData: storedResume,
                    apiToken: apiToken
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Auto-fill message failed:", chrome.runtime.lastError);
                        resolve({ success: false, error: `Could not establish connection. ${chrome.runtime.lastError.message || 'Receiving end does not exist.'}` });
                        return;
                    }
                    resolve(response);
                });
            });
            
            if (response && response.success) {
                autoFillStatus.textContent = `✅ Form auto-filled successfully! ${response.fieldsFound || 0} fields detected, ${response.fieldsFilled || 0} fields filled.`;
                autoFillStatus.className = 'status-message success';
            } else {
                const errorMessage = response?.error || response?.message || 'Unknown error occurred';
                autoFillStatus.textContent = `❌ Error: ${errorMessage}`;
                autoFillStatus.classList.add('error');
            }
        } catch (error) {
            console.error('Auto-fill error:', error);
            autoFillStatus.textContent = `❌ Error: ${error.message || error.toString() || 'Failed to auto-fill form'}`;
            autoFillStatus.classList.add('error');
        } finally {
            // Re-enable button
            autoFillBtn.disabled = false;
            autoFillBtn.textContent = '🤖 Auto-Fill Current Form';
        }
    }

    // Helper function to trigger download
    function triggerDownload(content, mimeType, extension) {
        if (!storedResume.filename) {
             console.error("Cannot generate filename, original resume filename missing.");
             return;
        }
        try {
            const blob = new Blob([content], { type: mimeType }); 
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const originalFilenameParts = storedResume.filename.split('.');
            originalFilenameParts.pop(); 
            const baseName = originalFilenameParts.join('.');
            link.download = `${baseName}_tailored.${extension}`; 
            
            link.href = url;
            document.body.appendChild(link); // Required for Firefox
            link.click();
            
            // Clean up
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            console.log(`Download triggered for ${link.download}`);
        } catch (e) {
            console.error(`Error creating download link for .${extension}:`, e);
            statusMessageDiv.textContent = `Success, but failed to create download link for .${extension}.`;
            statusMessageDiv.classList.add('warning');
        }
    }

    // Create Resume Button Click (Update response handling)
    createResumeBtn.addEventListener('click', () => {
        if (isProcessing) return; 

        // Clear previous status/download
        statusMessageDiv.textContent = '';
        statusMessageDiv.className = 'status-message';
        // Hide the download buttons container
        downloadButtonsContainer.style.display = 'none'; 
        
        // --- Basic validation ---
        const apiToken = apiTokenInput.value.trim();
        const currentExtractionMethod = document.querySelector('input[name="extractionMethod"]:checked')?.value || 'standard';
        const previewText = previewOutput.value.trim();
        let jobDescriptionToSend = null;
        let methodForStatus = currentExtractionMethod;

        // 1. Check if there is usable text in the preview/edit area
        // (We consider it usable if it's not empty and not just the placeholder or a status message)
        const placeholderText = previewOutput.placeholder;
        const isPreviewTextUserInput = previewText && 
                                      previewText !== placeholderText && 
                                      !previewText.startsWith('Attempting extraction...') &&
                                      !previewText.startsWith('Error:') &&
                                      !previewText.startsWith('[No description extracted]');

        if (isPreviewTextUserInput) {
            jobDescriptionToSend = previewText;
            methodForStatus = 'Preview/Edited Text';
            console.log('Using job description from preview/edit area.');
        } else {
            // 2. If preview area is not used, check if manual method is selected
            if (currentExtractionMethod === 'manual' && manualJdTextarea) {
                manualJobDescription = manualJdTextarea.value.trim();
                if (!manualJobDescription) {
                    statusMessageDiv.textContent = 'Please paste the job description in the manual text area or the preview box.';
                    statusMessageDiv.classList.add('error');
                    manualJdTextarea.focus();
                    return;
                }
                if (manualJobDescription.length < 50) {
                    statusMessageDiv.textContent = 'Manual job description seems too short.';
                    statusMessageDiv.classList.add('error');
                    manualJdTextarea.focus();
                    return;
                }
                jobDescriptionToSend = manualJobDescription;
                 methodForStatus = 'Manual Input';
                 console.log('Using job description from manual input area.');
            } 
            // 3. If neither preview nor manual input is used, rely on background extraction (Standard or AI)
            // No need to set jobDescriptionToSend here; background script will handle extraction.
            // methodForStatus is already set to 'standard' or 'ai'.
            console.log(`Using background extraction method: ${currentExtractionMethod}`);
        }
        
        // --- Resume and API Token Validation ---
        if (!storedResume.filename || !storedResume.content || !storedResume.mimeType) {
            statusMessageDiv.textContent = 'Please upload your resume file first.';
            statusMessageDiv.classList.add('error');
            return;
        }
        
        if (!apiToken) {
            statusMessageDiv.textContent = 'Please enter your Google API Key.';
            statusMessageDiv.classList.add('error');
            apiTokenInput.focus();
            return;
        }

        // --- Start Processing --- 
        isProcessing = true;
        createResumeBtn.disabled = true;
        createResumeBtn.classList.add('button-loading');
        createResumeBtn.textContent = 'Generating...'; 
        statusMessageDiv.textContent = `Processing (using ${methodForStatus})... Generating a tailored resume with max 570 words, focusing on most relevant skills`; 
        statusMessageDiv.classList.add('processing');

        console.log(`Sending request to background (method: ${methodForStatus})...`);
        
        // Send message to background script
        chrome.runtime.sendMessage({
            action: "createTailoredResume",
            resumeData: storedResume,
            apiToken: apiToken,
            jobDescriptionOverride: jobDescriptionToSend, 
            extractionMethod: currentExtractionMethod 
        }, (response) => {
            // Stop Processing
            isProcessing = false;
            createResumeBtn.disabled = false;
            createResumeBtn.classList.remove('button-loading');
            createResumeBtn.textContent = 'Generate Tailored Resume';
            statusMessageDiv.className = 'status-message';

            if (chrome.runtime.lastError) {
                console.error("Message sending failed:", chrome.runtime.lastError);
                statusMessageDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
                statusMessageDiv.classList.add('error');
                // Clear potentially stale JSON data on error
                currentGeneratedResumeJSON = null; 
                return;
            }

            console.log('Response from background:', response);
            if (response && response.success && response.tailoredResumeJSON) { // Check for JSON
                // Success: Display success message and show download buttons
                console.log("Received successful JSON response from background script.");
                statusMessageDiv.textContent = 'Tailored resume generated successfully!';
                statusMessageDiv.className = 'status-message success'; // Use success class

                // Store the latest generated resume JSON
                currentGeneratedResumeJSON = response.tailoredResumeJSON;
                console.log("Stored tailored resume JSON:", currentGeneratedResumeJSON); 

                // Re-enable the button after success
                createResumeBtn.disabled = false;
                
                // Show the download buttons container
                if (downloadButtonsContainer) {
                    downloadButtonsContainer.style.display = 'block';
                } else {
                     console.error("Cannot show download buttons because the container element was not found!");
                }

                // Ensure the buttons are interactive 
                if (downloadDocxBtn) downloadDocxBtn.disabled = false;
                if (downloadPdfBtn) downloadPdfBtn.disabled = false;
                if (downloadTxtBtn) downloadTxtBtn.disabled = false; // Ensure TXT button is also enabled
                
            } else if (response && response.error) {
                statusMessageDiv.textContent = `Error: ${response.error}`;
                statusMessageDiv.classList.add('error');
                 currentGeneratedResumeJSON = null; // Clear data on error
            } else {
                statusMessageDiv.textContent = 'Unknown error or invalid response format. Check console.';
                statusMessageDiv.classList.add('error');
                 currentGeneratedResumeJSON = null; // Clear data on error
            }
        });
    });

    // --- NEW Helper Function to Convert JSON to Formatted Text (Improved) ---
    function convertResumeJSONToText(jsonData) {
        if (!jsonData) return "Error: No resume data available to format.";

        let text = "";
        const newline = "\n"; // Use variable for clarity
        const sectionSeparator = newline + newline; // Double newline for separation
        const entrySeparator = newline; // Single newline between entries within a section
        const bulletIndent = "  "; // Indentation for bullet points

        // Contact Info
        if (jsonData.contact) {
            const contactParts = [
                jsonData.contact.name,
                jsonData.contact.email,
                jsonData.contact.phone,
                jsonData.contact.linkedin,
                jsonData.contact.github,
                jsonData.contact.portfolio
            ].filter(Boolean);
            if (contactParts.length > 0) {
                if (jsonData.contact.name) {
                    // Center name roughly with padding (approximation)
                    const padding = Math.max(0, Math.floor((80 - jsonData.contact.name.length) / 2));
                    text += ' '.repeat(padding) + jsonData.contact.name.toUpperCase() + newline; // Uppercase Name
                    const otherContacts = contactParts.filter(p => p !== jsonData.contact.name);
                    if (otherContacts.length > 0) {
                         text += otherContacts.join(' | ') + newline;
                    }
                } else {
                     text += contactParts.join(' | ') + newline;
                }
                 text += sectionSeparator;
            } 
        }

        // Generic Section Formatter
        const formatSection = (title, items, itemFormatter) => {
            if (items && items.length > 0) {
                text += title.toUpperCase() + sectionSeparator; // UPPERCASE Title
                items.forEach(item => {
                    text += itemFormatter(item);
                    text += entrySeparator; // Space between entries
                });
                 text += newline; // Extra space after section
            }
        };

        // Summary
        if (jsonData.summary) {
            text += "SUMMARY" + sectionSeparator;
            text += jsonData.summary + sectionSeparator;
        }

        // Experience
        formatSection("EXPERIENCE", jsonData.experience, (exp) => {
            let entryText = "";
            const titleLine = [exp.title, exp.company].filter(Boolean).join(' @ ');
            const locationDates = [exp.location, exp.dates].filter(Boolean).join(' | ');
            entryText += titleLine + (locationDates ? ` (${locationDates})` : '') + newline;
            if (exp.bullets && exp.bullets.length > 0) {
                exp.bullets.forEach(bullet => {
                    entryText += bulletIndent + `- ${bullet}` + newline;
                });
            }
            return entryText.trim();
        });

        // Education
        formatSection("EDUCATION", jsonData.education, (edu) => {
             let entryText = "";
             const degreeLine = [edu.degree, edu.institution].filter(Boolean).join(', ');
             const locationDates = [edu.location, edu.dates].filter(Boolean).join(' | ');
             entryText += degreeLine + (locationDates ? ` (${locationDates})` : '') + newline;
              if (edu.details) {
                  entryText += bulletIndent + edu.details + newline;
              }
              return entryText.trim();
         });

        // Skills
        if (jsonData.skills && Array.isArray(jsonData.skills) && jsonData.skills.length > 0) {
            text += "SKILLS" + sectionSeparator;
            jsonData.skills.forEach(skillCategory => {
                if (skillCategory.category && skillCategory.items && skillCategory.items.length > 0) {
                     // Bolder category, then items
                     text += skillCategory.category.toUpperCase() + ":" + newline;
                     text += bulletIndent + skillCategory.items.join(' | ') + newline;
                }
            });
            text += newline; // Extra space after section
        }

        // Projects
        formatSection("PROJECTS", jsonData.projects, (proj) => {
             let entryText = "";
             entryText += proj.name.toUpperCase() + (proj.link ? ` (${proj.link})` : '') + newline; // Uppercase project name
             if (proj.description) {
                 entryText += bulletIndent + proj.description + newline;
             }
             if (proj.technologies && proj.technologies.length > 0) {
                  entryText += bulletIndent + `Technologies: ${proj.technologies.join(', ')}` + newline;
             }
             return entryText.trim();
        });

        // Achievements
        formatSection("ACHIEVEMENTS", jsonData.achievements, (ach) => {
             return bulletIndent + `- ${ach}`; // Simple bullet list
         });

        return text.trim(); // Final trim
    }

    // --- REVISED PDF Generation Function (using pdfmake with JSON input - Modern Template) ---
    function generatePdf(jsonData, baseFilename) {
        console.log("Generating PDF - Modern Template Replication...");
        if (!jsonData) {
            console.error("generatePdf called with no JSON data.");
            statusMessageDiv.textContent = 'Error: No resume data for PDF generation.';
            statusMessageDiv.className = 'status-message error';
            return;
        }

        try {
            // Updated color scheme to match the more professional design
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
            }
            
            content.push({ text: ' ', margin: [0, 10] }); // Extra space after header

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
                    if (proj.technologies && proj.technologies.length > 0) {
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

            // --- Document Definition ---
            const docDefinition = {
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
                    }
                },
                defaultStyle: {
                    font: 'Roboto',
                    fontSize: bodyFontSize,
                    lineHeight: 1.2
                },
                pageSize: 'A4', // Changed from LETTER to A4
                pageMargins: [40, 30, 40, 30], // [left, top, right, bottom]
            };

            pdfMake.createPdf(docDefinition).download(`${baseFilename}_tailored_modern.pdf`);
            console.log("Modern Template PDF download triggered.");

        } catch (error) {
            console.error("Error generating Modern Template PDF:", error);
            statusMessageDiv.textContent = 'Error generating PDF. Check console.';
            statusMessageDiv.className = 'status-message error';
        }
    }

    // --- REVISED Download Button Listeners (Attached once) ---
    downloadDocxBtn.addEventListener('click', () => {
        if (currentGeneratedResumeJSON) {
             const resumeText = convertResumeJSONToText(currentGeneratedResumeJSON);
            triggerDownload(
                resumeText, // Use converted text
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'docx'
            );
        } else {
            console.error("DOCX download clicked, but no generated resume JSON available.");
             statusMessageDiv.textContent = 'Error: No resume content for DOCX.';
             statusMessageDiv.className = 'status-message error';
        }
    });

    downloadTxtBtn.addEventListener('click', () => {
        if (currentGeneratedResumeJSON) {
             const resumeText = convertResumeJSONToText(currentGeneratedResumeJSON);
            triggerDownload(
                resumeText, // Use converted text
                'text/plain',
                'txt'
            );
        } else {
             console.error("TXT download clicked, but no generated resume JSON available.");
             statusMessageDiv.textContent = 'Error: No resume content for TXT.';
             statusMessageDiv.className = 'status-message error';
        }
    });
    
    downloadPdfBtn.addEventListener('click', () => {
        if (currentGeneratedResumeJSON && storedResume.filename) {
             const originalFilenameParts = storedResume.filename.split('.');
            originalFilenameParts.pop(); 
            const baseName = originalFilenameParts.join('.');
            // Pass the JSON data directly to generatePdf
            generatePdf(currentGeneratedResumeJSON, baseName);
        } else {
            console.error("PDF download clicked, but no generated resume JSON or base filename available.");
            if (!currentGeneratedResumeJSON) statusMessageDiv.textContent = 'Error: No resume content for PDF.';
            if (!storedResume.filename) statusMessageDiv.textContent = 'Error: Original filename missing for PDF.';
            statusMessageDiv.className = 'status-message error';
        }
    });

    // Initialize the UI
    initializeUI();
}); 