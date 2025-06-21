// Quick fix to add after line 771 in background.js

// Check if we have any meaningful content
const hasContent = !!(
    (originalResumeJSON.personalInfo && originalResumeJSON.personalInfo.name) ||
    originalResumeJSON.summary ||
    (originalResumeJSON.experience && originalResumeJSON.experience.length > 0) ||
    (originalResumeJSON.education && originalResumeJSON.education.length > 0) ||
    originalResumeJSON.skills
);

if (!hasContent) {
    console.error(`[${listenerId}] Resume appears empty after parsing. Raw JSON:`, JSON.stringify(originalResumeJSON, null, 2));
    sendResponse({ success: false, error: "Resume parsing succeeded but no meaningful content was found. Please check your resume file or try a different AI provider." });
    return;
}

console.log(`[${listenerId}] Content validation passed - resume has meaningful data`);
