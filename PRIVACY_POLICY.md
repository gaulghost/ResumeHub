# Privacy Policy for ResumeHub Chrome Extension

**Last Updated:** December 2, 2025

This Privacy Policy describes how the ResumeHub Chrome Extension ("ResumeHub", "we", "us", or "our") collects, uses, and handles your information when you use our extension.

**1. Information We Collect**

ResumeHub processes the following types of information to provide its core functionality:

* **User-Provided API Key:** To enable the resume tailoring features powered by Google's Generative AI, ResumeHub requires you to provide your own Google Generative AI API key. This key is stored locally on your device using `chrome.storage.local` and is sent directly to Google's API endpoints with each request you initiate.
* **Resume Content:** When you upload your resume file, its content is processed. The content is stored locally on your device using `chrome.storage.local` and is sent to Google's Generative AI API for parsing and tailoring against job descriptions. Resumes often contain Personally Identifiable Information (PII) such as your name, contact details, work history, and education.
* **Web Page Content (Job Descriptions):** When you activate the extension on a web page containing a job description, ResumeHub reads the text content of that page using Chrome's `activeTab` and `scripting` permissions. This extracted text is sent to Google's Generative AI API to either identify the core description or serve as the basis for tailoring your resume.
* **User Preferences:** We store your preferred theme (light/dark) and chosen extraction method using `chrome.storage.sync` to personalize your experience.

**2. How We Use Your Information**

Your information is used solely for the following purposes:

* To authenticate your requests to the Google Generative AI API using your provided API key.
* To send your resume content and extracted job description text to the Google Generative AI API for analysis, parsing, and generation of tailored resume content.
* To store your API key, resume data, and preferences locally on your browser for your convenience.
* To display the processed and tailored resume information within the extension's popup.

**3. Data Storage and Security**

* Your Google AI API Key and uploaded resume data (filename, content, type) are stored locally on your computer using Chrome's Storage API (`chrome.storage.local`).
* Your preferences (theme, extraction method) are stored using Chrome's Sync Storage API (`chrome.storage.sync`), which may sync across your logged-in Chrome profiles.
* We do not store your API key, resume content, or web page content on any external servers controlled by us. Data required for processing is sent directly from your browser to Google's Generative AI API endpoints.

**4. Data Sharing**

We do **not** sell or share your personal information with third parties, except as necessary to provide the extension's core functionality:

* **Google Generative AI API:** Your API key, resume content, and extracted web page text are sent to Google's servers for processing via their Generative AI API. Your use of this extension is subject to Google's own Privacy Policy and Terms of Service regarding their handling of data sent to their APIs. You can find Google's policies here: [https://policies.google.com/privacy](https://policies.google.com/privacy)

**5. User Control**

You can clear your stored API key and resume data at any time through the extension's popup interface. Uninstalling the extension will also remove all locally stored data.

**6. Changes to This Privacy Policy**

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy within the extension or on its web store listing.

**7. Contact Us**

If you have any questions about this Privacy Policy, please contact seeker.ent@gmail.com.
