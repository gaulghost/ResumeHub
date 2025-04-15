// ResumeHub content script

console.log("ResumeHub content script loaded.");

// This script runs in the context of the web page.
// It can access the DOM but has limited access to chrome.* APIs.
// It's primarily used here to facilitate extracting the job description.

// The actual extraction logic is injected from the background script 
// using chrome.scripting.executeScript for better security and control.

// Potential future use: listening for messages from the popup/background if needed.
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "someActionFromPopup") {
//     // Do something on the page
//     sendResponse({ result: "Action completed" });
//   }
// }); 