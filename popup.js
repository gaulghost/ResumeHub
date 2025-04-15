// ResumeHub popup script (Modern UI)

document.addEventListener('DOMContentLoaded', function() {
    console.log('ResumeHub Modern UI popup loaded.');

    // --- UI Elements ---
    const themeContainer = document.getElementById('theme-container');
    const themeToggle = document.getElementById('theme-toggle');
    const apiTokenInput = document.getElementById('api-token');
    const apiTokenStatusSpan = document.getElementById('api-token-status');
    const resumeUploadInput = document.getElementById('resume-upload');
    const resumeUploadStatusSpan = document.getElementById('resume-upload-status');
    const clearResumeBtn = document.getElementById('clear-resume-btn');
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
        // Apply theme class directly to the body element
        document.body.className = `theme-${theme}`;
        if (!isInitialLoad) {
             console.log('Theme applied to body:', theme);
        }
        // Ensure the container div retains its base class if needed
        // (It should be fine as styles target .container directly, 
        // but uncomment if layout issues appear)
        // if (themeContainer) { 
        //     themeContainer.className = 'container'; 
        // }
    }
    
    // --- Helper Function to Update Resume Status UI ---
    function updateResumeStatusUI() {
        if (storedResume.filename) {
            resumeUploadStatusSpan.textContent = `Using: ${storedResume.filename}`;
            resumeUploadStatusSpan.style.color = 'var(--color-success)';
            clearResumeBtn.style.display = 'inline-block';
            toggleCard(resumeCard, true); // Collapse if resume is loaded
        } else {
            resumeUploadStatusSpan.textContent = 'No file selected.';
            resumeUploadStatusSpan.style.color = 'var(--text-secondary)';
            clearResumeBtn.style.display = 'none';
            resumeUploadInput.value = '';
            toggleCard(resumeCard, false); // Expand if no resume
        }
    }

    // --- Helper Function to Toggle Card Collapse State ---
    function toggleCard(cardElement, forceCollapse = null) {
        const isCollapsed = cardElement.classList.contains('is-collapsed');
        const shouldCollapse = forceCollapse !== null ? forceCollapse : !isCollapsed;
        const button = cardElement.querySelector('.toggle-button');
        
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

    // --- Load saved data on popup open ---
    chrome.storage.sync.get(['theme', 'extractionMethod'], (syncResult) => {
        const theme = syncResult.theme || 'light';
        applyTheme(theme, true);
        themeToggle.checked = (theme === 'dark');
        selectedExtractionMethod = syncResult.extractionMethod || 'standard';
        const currentRadio = document.querySelector(`input[name="extractionMethod"][value="${selectedExtractionMethod}"]`);
        if (currentRadio) currentRadio.checked = true;
        console.log("Loaded extraction method preference:", selectedExtractionMethod);
        // Collapse extraction card by default (as specified in HTML and requirement)
        // toggleCard(extractionCard, true); // Already handled by is-collapsed class in HTML
    });

    chrome.storage.local.get(['resumeFilename', 'resumeContent', 'resumeMimeType', 'apiToken'], (result) => {
        if (result.resumeFilename && result.resumeContent && result.resumeMimeType) {
            storedResume.filename = result.resumeFilename;
            storedResume.content = result.resumeContent; 
            storedResume.mimeType = result.resumeMimeType;
        } 
        updateResumeStatusUI(); // Update based on loaded/default state

        if (result.apiToken) {
            apiTokenInput.value = result.apiToken;
            apiTokenStatusSpan.textContent = 'Loaded from storage.';
            apiTokenStatusSpan.style.color = 'var(--color-success)';
            toggleCard(apiKeyCard, true); // Collapse if token exists
        } else {
             apiTokenStatusSpan.textContent = ''; 
             toggleCard(apiKeyCard, false); // Expand if no token
        }
    });

    // --- Event Listeners ---

    // Card Collapse Toggle Listener
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', (event) => {
            // Prevent toggle if click was on an input/button inside header (if any)
            if (event.target.closest('input, button')) return;
            
            const card = header.closest('.collapsible');
            if (card) {
                toggleCard(card);
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
                selectedExtractionMethod = event.target.value;
                console.log("Extraction method changed to:", selectedExtractionMethod);
                chrome.storage.sync.set({ extractionMethod: selectedExtractionMethod });
            }
        });
    });

    // Resume Upload Handling
    resumeUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            // User cancelled selection - don't clear stored unless explicitly cleared
            // updateResumeStatusUI(); // Update UI to reflect current state (might be unchanged)
            return;
        }

        // Basic validation (redundant with 'accept' but good practice)
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
            resumeUploadStatusSpan.textContent = `Invalid type. Use PDF, DOCX, or TXT.`;
            resumeUploadStatusSpan.style.color = 'var(--color-danger)';
            resumeUploadInput.value = ''; // Clear the input
            clearResumeBtn.style.display = storedResume.filename ? 'inline-block' : 'none'; // Keep clear button if old file exists
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileContentBase64 = e.target.result.split(',')[1]; 
            const mimeType = file.type;
            
            storedResume.filename = file.name;
            storedResume.content = fileContentBase64;
            storedResume.mimeType = mimeType;
            updateResumeStatusUI(); // Update UI

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
                    // Status is already set by updateResumeStatusUI()
                }
            });
        };
        reader.onerror = function() {
            resumeUploadStatusSpan.textContent = 'Error reading file.';
            resumeUploadStatusSpan.style.color = 'var(--color-danger)';
            console.error("Error reading file:", reader.error);
            updateResumeStatusUI(); // Reflect that no new file is loaded
        }
        reader.readAsDataURL(file); 
    });

    // Clear Resume Button
    clearResumeBtn.addEventListener('click', () => {
        storedResume = { filename: null, content: null, mimeType: null };
        chrome.storage.local.remove(['resumeFilename', 'resumeContent', 'resumeMimeType'], () => {
            if (chrome.runtime.lastError) {
                console.error("Error clearing resume storage:", chrome.runtime.lastError);
                // Optionally show an error to the user
            } else {
                console.log("Stored resume cleared.");
            }
             updateResumeStatusUI(); // Update UI & expand card
        });
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
        const apiKeyForAIExtraction = apiTokenInput.value.trim(); // Needed if AI method is selected

        // Basic check if API key is needed but missing for AI extraction
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
            action: "getJobDescription", // New action type
            extractionMethod: currentExtractionMethod,
            // Send API key only if needed for AI extraction to limit exposure
            apiToken: currentExtractionMethod === 'ai' ? apiKeyForAIExtraction : null 
        }, (response) => {
            isPreviewing = false;
            previewBtn.disabled = false;
            previewBtn.textContent = 'Preview';
            previewOutput.style.color = 'var(--text-secondary)'; // Reset color

            if (chrome.runtime.lastError) {
                console.log("Preview message failed:", chrome.runtime.lastError);
                previewOutput.value = `Error: ${chrome.runtime.lastError.message}`;
                previewOutput.style.color = 'var(--color-danger)';
                return;
            }

            console.log('Preview response received:', response);
            if (response && response.success) {
                previewOutput.value = response.jobDescription || '[No description extracted]';
                 previewOutput.style.color = 'var(--text)'; // Use normal text color for success
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

        // --- Clear previous status/download --- 
        statusMessageDiv.textContent = '';
        statusMessageDiv.className = 'status-message'; // Reset classes
        downloadLink.style.display = 'none';
        downloadLink.href = '#';
        
        // --- Basic validation ---
        const apiToken = apiTokenInput.value.trim();
        if (!storedResume.filename || !storedResume.content || !storedResume.mimeType) {
            statusMessageDiv.textContent = 'Please upload your resume file first.';
            statusMessageDiv.classList.add('error');
            return;
        }
        if (!apiToken) {
            statusMessageDiv.textContent = 'Please enter your Google API Key.';
             statusMessageDiv.classList.add('error');
             apiTokenInput.focus(); // Focus the input for convenience
            return;
        }

        // --- Start Processing --- 
        isProcessing = true;
        createResumeBtn.disabled = true;
        createResumeBtn.textContent = 'Generating...'; 
        statusMessageDiv.textContent = `Processing (${selectedExtractionMethod} extraction): Contacting API...`; // Indicate method
        statusMessageDiv.classList.add('processing');

        console.log(`Sending request to background script (method: ${selectedExtractionMethod})...`);
        chrome.runtime.sendMessage({
            action: "createTailoredResume",
            resumeData: storedResume,
            apiToken: apiToken,
            extractionMethod: selectedExtractionMethod // Pass the selected method
        }, (response) => {
            // --- Stop Processing --- 
            isProcessing = false;
            createResumeBtn.disabled = false;
            createResumeBtn.textContent = 'Generate Tailored Summary';
            statusMessageDiv.className = 'status-message'; // Reset classes before adding new one

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
                     statusMessageDiv.classList.add('warning'); // Use warning color
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

}); 