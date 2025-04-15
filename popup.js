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
    const downloadLink = document.getElementById('download-link');
    const extractionMethodRadios = document.querySelectorAll('input[name="extractionMethod"]');
    const apiKeyCard = document.getElementById('api-key-card');
    const extractionCard = document.getElementById('extraction-method-card');
    const resumeCard = document.getElementById('resume-card');
    const collapsibleHeaders = document.querySelectorAll('.card-header');
    const previewBtn = document.getElementById('preview-jd-btn');
    const previewOutput = document.getElementById('preview-jd-output');
    const manualJdInputArea = document.getElementById('manual-jd-input-area');
    const manualJdTextarea = document.getElementById('manual-jd-textarea');

    // --- State ---
    let storedResume = { 
        filename: null, 
        content: null, // Base64 content 
        mimeType: null 
    };
    let isProcessing = false; // Flag to prevent multiple clicks
    let selectedExtractionMethod = 'standard'; // Default
    let isPreviewing = false; // Flag for preview loading state

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

    // Create Resume Button Click 
    createResumeBtn.addEventListener('click', () => {
        if (isProcessing) return; 

        // Clear previous status/download
        statusMessageDiv.textContent = '';
        statusMessageDiv.className = 'status-message';
        downloadLink.style.display = 'none';
        downloadLink.href = '#';
        
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
        createResumeBtn.textContent = 'Generating...'; 
        statusMessageDiv.textContent = `Processing (using ${methodForStatus})...`; // Use updated status
        statusMessageDiv.classList.add('processing');

        console.log(`Sending request to background (method: ${methodForStatus})...`);
        
        // Send message to background script
        chrome.runtime.sendMessage({
            action: "createTailoredResume",
            resumeData: storedResume,
            apiToken: apiToken,
            // Send the determined job description OR null if background should extract
            jobDescriptionOverride: jobDescriptionToSend, 
            // Also send original extraction method if needed by background for AI/Standard
            extractionMethod: currentExtractionMethod 
        }, (response) => {
            // Stop Processing
            isProcessing = false;
            createResumeBtn.disabled = false;
            createResumeBtn.textContent = 'Generate Tailored Summary';
            statusMessageDiv.className = 'status-message';

            if (chrome.runtime.lastError) {
                console.error("Message sending failed:", chrome.runtime.lastError);
                statusMessageDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
                statusMessageDiv.classList.add('error');
                return;
            }

            console.log('Response from background:', response);
            if (response && response.success) {
                statusMessageDiv.textContent = 'Summary generated successfully!';
                statusMessageDiv.classList.add('success');
                try {
                    const blob = new Blob([response.generatedResume], { type: 'text/plain' }); 
                    const url = URL.createObjectURL(blob);
                    downloadLink.href = url;
                    const originalFilenameParts = storedResume.filename.split('.');
                    originalFilenameParts.pop(); 
                    const baseName = originalFilenameParts.join('.');
                    downloadLink.download = `${baseName}_tailored.txt`; 
                    downloadLink.style.display = 'block';
                    downloadLink.textContent = `Download: ${downloadLink.download}`;
                } catch (e) {
                    console.error("Error creating download link:", e);
                    statusMessageDiv.textContent = 'Success, but failed to create download link.';
                    statusMessageDiv.classList.add('warning');
                }
            } else if (response && response.error) {
                statusMessageDiv.textContent = `Error: ${response.error}`;
                statusMessageDiv.classList.add('error');
            } else {
                statusMessageDiv.textContent = 'Unknown error. Check console.';
                statusMessageDiv.classList.add('error');
            }
        });
    });

    // Initialize the UI
    initializeUI();
}); 