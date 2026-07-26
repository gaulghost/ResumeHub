# Privacy Policy for ResumeHub Chrome Extension

**Last Updated:** July 25, 2026

This Privacy Policy describes how the ResumeHub Chrome Extension ("ResumeHub", "we", "us", or "our") collects, uses, and handles your information when you use our extension.

**1. Information We Collect**

ResumeHub processes the following types of information to provide its core functionality:

* **User-Provided API Key:** To enable the resume tailoring features powered by Google's Generative AI, ResumeHub may require you to provide your own Google Generative AI API key. This key is stored locally on your device using `chrome.storage.local` and is sent directly to Google's API endpoints with each request you initiate (when using the client-side AI path).
* **Resume Content:** When you upload your resume file, its content is processed. The content is stored locally on your device using `chrome.storage.local`. Depending on the feature path, resume content may also be sent to Google's Generative AI API and/or to ResumeHub's backend for parsing and tailoring assistance. Resumes often contain Personally Identifiable Information (PII) such as your name, contact details, work history, and education.
* **Web Page Content (Job Descriptions):** When you activate the extension on a web page containing a job description, ResumeHub reads the text content of that page using Chrome's `activeTab` and `scripting` permissions. This extracted text may be sent to Google's Generative AI API and/or ResumeHub's backend to identify the core description or serve as the basis for tailoring your resume and related features (such as salary estimation).
* **User Preferences:** We store your preferred theme (light/dark) and chosen extraction method using `chrome.storage.sync` to personalize your experience.
* **Anonymous Telemetry:** The extension may send anonymous usage/analytics events (for example feature usage and error signals) to ResumeHub's backend to help improve reliability and product quality.

**2. How We Use Your Information**

Your information is used solely for the following purposes:

* To authenticate your requests to the Google Generative AI API using your provided API key (when applicable).
* To send your resume content and extracted job description text to Google's Generative AI API and/or ResumeHub's backend for analysis, parsing, salary estimation, and generation of tailored resume content.
* To store your API key, resume data, and preferences locally on your browser for your convenience.
* To display the processed and tailored resume information within the extension's popup.
* To operate and improve ResumeHub via anonymous telemetry and aggregated usage analytics.

**3. Data Storage and Security**

* Your Google AI API Key and uploaded resume data (filename, content, type) are stored locally on your computer using Chrome's Storage API (`chrome.storage.local`).
* Your preferences (theme, extraction method) are stored using Chrome's Sync Storage API (`chrome.storage.sync`), which may sync across your logged-in Chrome profiles.
* ResumeHub's backend at **resumehub.duckdns.org** may receive:
  * Resume content for server-side parsing and tailoring assistance
  * Salary estimation requests (job title, company, location, and related fields)
  * Anonymous telemetry / usage analytics events
* Data required for client-side AI processing may also be sent directly from your browser to Google's Generative AI API endpoints.
* We apply reasonable technical safeguards on our backend (including access controls for administrative tooling and request size / rate limits). Absolute security cannot be guaranteed for any internet-connected service.

**4. Data Sharing**

We do **not** sell or share your personal information with third parties, except as necessary to provide the extension's core functionality:

* **Google Generative AI API:** Your API key (when provided), resume content, and extracted web page text may be sent to Google's servers for processing via their Generative AI API. Your use of this extension is subject to Google's own Privacy Policy and Terms of Service regarding their handling of data sent to their APIs. You can find Google's policies here: [https://policies.google.com/privacy](https://policies.google.com/privacy)
* **ResumeHub Backend:** As described in Section 3, certain requests are processed by our backend at resumehub.duckdns.org to support resume parsing/tailoring assistance, salary estimation, and anonymous telemetry.

**5. User Control**

You can clear your stored API key and resume data at any time through the extension's popup interface. Uninstalling the extension will also remove all locally stored data.

**6. Changes to This Privacy Policy**

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy within the extension or on its web store listing.

**7. Contact Us**

If you have any questions about this Privacy Policy, please contact seeker.ent@gmail.com.
