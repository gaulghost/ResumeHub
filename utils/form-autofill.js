/**
 * Form auto-fill helpers: heuristics + optional AI mapping payload builders.
 * Page DOM mutation runs via chrome.scripting.executeScript in background.js.
 */

export function extractContactValues(resumeJSON = {}) {
    const contact = resumeJSON.contact || {};
    const fullName = (contact.name || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);

    const experience = Array.isArray(resumeJSON.experience) ? resumeJSON.experience : [];
    const education = Array.isArray(resumeJSON.education) ? resumeJSON.education : [];
    const skills = resumeJSON.skills;

    const latestJob = experience[0] || {};
    const latestEdu = education[0] || {};

    let skillsText = '';
    if (Array.isArray(skills)) {
        skillsText = skills.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).join(', ');
    } else if (skills && typeof skills === 'object') {
        skillsText = Object.values(skills).flat().filter(Boolean).join(', ');
    }

    const years = estimateYearsOfExperience(experience);

    return {
        fullName,
        firstName: parts[0] || '',
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
        email: (contact.email || '').trim(),
        phone: (contact.phone || '').trim(),
        linkedin: (contact.linkedin || '').trim(),
        github: (contact.github || '').trim(),
        portfolio: (contact.portfolio || '').trim(),
        location: (contact.location || resumeJSON.location || '').trim(),
        summary: (resumeJSON.summary || '').trim(),
        currentCompany: (latestJob.company || '').trim(),
        currentTitle: (latestJob.title || latestJob.role || '').trim(),
        yearsExperience: years != null ? String(years) : '',
        highestEducation: (latestEdu.degree || latestEdu.school || '').trim(),
        skills: skillsText,
    };
}

function estimateYearsOfExperience(experience = []) {
    if (!experience.length) return null;
    let minStart = null;
    let maxEnd = null;
    const now = new Date();
    for (const job of experience) {
        const start = parseLooseDate(job.startDate || job.start);
        const end = job.current || /present|current/i.test(String(job.endDate || job.end || ''))
            ? now
            : parseLooseDate(job.endDate || job.end);
        if (start && (!minStart || start < minStart)) minStart = start;
        if (end && (!maxEnd || end > maxEnd)) maxEnd = end;
    }
    if (!minStart || !maxEnd) return null;
    const years = (maxEnd - minStart) / (365.25 * 24 * 3600 * 1000);
    if (!Number.isFinite(years) || years < 0) return null;
    return Math.max(0, Math.round(years * 10) / 10);
}

function parseLooseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
    const m = String(value).match(/(\d{4})/);
    if (m) return new Date(Number(m[1]), 0, 1);
    return null;
}

/**
 * Build a compact resume snippet for AI field-mapping prompts.
 */
export function buildCompactResumeContext(resumeJSON = {}) {
    const values = extractContactValues(resumeJSON);
    const experience = (resumeJSON.experience || []).slice(0, 3).map((e) => ({
        title: e.title || e.role || '',
        company: e.company || '',
        dates: `${e.startDate || e.start || ''} - ${e.endDate || e.end || (e.current ? 'Present' : '')}`,
    }));
    return {
        contact: {
            name: values.fullName,
            email: values.email,
            phone: values.phone,
            linkedin: values.linkedin,
            location: values.location,
        },
        summary: values.summary,
        currentCompany: values.currentCompany,
        currentTitle: values.currentTitle,
        yearsExperience: values.yearsExperience,
        skills: values.skills,
        education: values.highestEducation,
        recentExperience: experience,
    };
}
