/**
 * ResumeHub Popup Main Script
 * Simplified initialization to match original working pattern
 */

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Check if all required classes are available
        const requiredClasses = ['StateManager', 'UIManager', 'FileHandlers', 'ResumeProcessor', 'EventHandlers', 'AppController'];
        const missing = requiredClasses.filter(className => !window[className]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required classes:', missing);
            showError(`Missing components: ${missing.join(', ')}. Please reload the extension.`);
            return;
        }
        
        console.log('✅ All required classes found');
        console.log('🚀 Starting ResumeHub popup initialization...');
        
        // Initialize the application
        const app = new AppController();
        await app.initialize();
        
        // Expose for debugging
        window.ResumeHubApp = app;
        
        console.log('✅ ResumeHub popup initialized successfully');
        console.log('✅ ResumeHub initialized successfully');
        
    } catch (error) {
        console.error('❌ Failed to initialize ResumeHub:', error);
        showError(`Initialization failed: ${error.message}`);
    }
});

/**
 * Show error message to user
 */
function showError(message) {
    const statusDiv = document.getElementById('status-message');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'status-message error';
    }
}