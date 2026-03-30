/**
 * LLM Prompt Templates
 * All prompts for Ollama and Gemini
 */

export const RANKING_PROMPT = `
You are an expert job matching specialist. Analyze the following job against the user's profile and preferences. Provide a structured JSON response.

## User Profile
- **Skills**: {skills}
- **Experience Level**: {experience}
- **Career Goal**: {careerGoal}
- **Preferences**: {preferences}
- **Education**: {education}

## Job Details
- **Company**: {company}
- **Role**: {role}
- **Location**: {location}
- **Description**: {description}

## Scoring Rubric
Score jobs on a scale of 1-100:
- **90-100 (Exceptional)**: Exact or near-exact role match, 80%+ skills overlap, well-known company, perfect location fit
- **75-89 (Good)**: Relevant role, 50-70% skills match, some growth opportunity, acceptable location
- **55-74 (Average)**: Related role, 30-50% skills match, significant learning curve required
- **35-54 (Poor)**: Tangential connection, <30% skills match, many skill gaps
- **1-34 (Skip)**: Completely irrelevant to profile

## Response Format
Return ONLY valid JSON (no markdown, no code blocks):
{
  "priorityScore": <number 1-100>,
  "matchedSkills": [<list of matching technical skills found>],
  "missingSkills": [<list of required skills user lacks>],
  "whyFits": "<2-3 sentences explaining why this is a good/bad match>",
  "blocker": "<null if no blockers, otherwise brief description of critical gaps>"
}

Be strict with scoring - most jobs should score 40-70. Exceptional matches are rare.
`;

export const KEYWORD_EXTRACTION_PROMPT = `
The user sent this message: "{userMessage}"

The user's profile shows:
- Skills: {skills}
- Career Goal: {careerGoal}
- Preferences: {preferences}

Extract the job search parameters the user is looking for. Respond with ONLY valid JSON:
{
  "keyword": "<job title or skill to search for, e.g. 'Python Developer' or 'Data Science'>",
  "location": "<location if mentioned, otherwise empty string>",
  "reason": "<brief explanation of what the user is searching for>"
}

Be concise. Extract the actual intent, not random words.
`;

export const COVER_LETTER_PROMPT = `
Write a brief personalized cover letter for this job application.

**User Profile**:
- Name: {name}
- Skills: {skills}
- Experience: {experience}
- Career Goal: {careerGoal}

**Job Details**:
- Company: {company}
- Role: {role}
- Location: {location}

Write 3-4 short paragraphs highlighting why the user is a strong candidate. Focus on:
1. Why they're interested in the company/role
2. Key relevant skills and experience
3. What they can contribute
4. Closing with enthusiasm

Keep it professional and concise (200-300 words max).
`;

export const PROFILE_EXTRACTION_PROMPT = `
Extract structured profile information from the following resume/profile text:

{rawText}

Return a JSON object with these fields (use null if information is not provided):
{
  "name": "Full name",
  "aboutMe": "Brief summary of background",
  "skills": ["Skill 1", "Skill 2", ...],
  "education": ["Degree/University 1", "Degree/University 2", ...],
  "experience": "Brief professional experience summary",
  "projects": ["Project 1 description", "Project 2 description", ...],
  "certifications": ["Certification 1", "Certification 2", ...],
  "careerGoal": "What role/type of work user is targeting",
  "preferences": {
    "preferredLocation": "or 'remote' or 'any'",
    "preferredRole": "Job title preferences",
    "desiredSalary": "If mentioned, or null"
  }
}

Be thorough but concise. Extract what is actually present in the resume.
`;

export const INTERNSHIP_PIPELINE_PROMPT = `
The user is looking for an internship. Extract key search parameters from their message:
"{userMessage}"

User profile:
- Skills: {skills}
- Education: {education}
- Preferences: {preferences}

Respond with JSON:
{
  "keyword": "<internship role to search for>",
  "location": "<preferred location or empty>",
  "duration": "<in months if mentioned, or null>",
  "isPaidPreference": <true/false if stated>,
  "reason": "<brief intent summary>"
}
`;

/**
 * Helper to safely parse JSON from LLM responses
 * Handles responses with markdown code blocks or extra text
 */
export function extractJSONFromResponse(content: string): Record<string, unknown> | null {
  try {
    // Try direct parse first
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Continue to next strategy
      }
    }

    // Try to find JSON object in the response
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Continue
      }
    }

    // Last resort: array
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return { results: JSON.parse(arrayMatch[0]) };
      } catch {
        return null;
      }
    }

    return null;
  }
}
