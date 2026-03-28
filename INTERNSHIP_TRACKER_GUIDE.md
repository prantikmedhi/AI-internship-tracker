# Internship Tracker - Setup & Debugging Guide

## Issue Fixed ✅

**Problem**: Internship Tracker was saving blank rows with missing column headers
**Root Cause**: No validation of data before creating database rows
**Solution**: Added data validation to prevent incomplete rows from being saved

---

## How the Internship Tracker Works

### Database Structure

The tracker is stored in Notion with this schema:

```
Internship Tracker (Database)
├── Company (Title)          ← Required: Company name
├── Role (Rich Text)         ← Required: Job title/role
├── Apply URL (URL)          ← Required: Application link
├── Location (Rich Text)     ← Optional: Job location
├── Status (Select)          ← Default: "New"
├── Priority Score (Number)  ← Ranking score
├── Matched Skills (Multi-Select)  ← Skills you have
├── Missing Skills (Multi-Select)  ← Skills you need
├── Why This Fits (Rich Text)      ← Why it's a good match
├── Blocker Reason (Rich Text)     ← Any blockers
└── Apply Timestamp (Date)   ← When you applied
```

### Data Flow

```
Job Source (Internshala, LinkedIn, etc.)
        ↓
Job Search Module (internship_agent/jobs/search.py)
        ↓
Job Ranking Module (internship_agent/llm/ranking.py)
        ↓
Validation Check ← NEW! Stops incomplete data here
        ↓
Create Internship (internship_agent/notion/setup.py)
        ↓
Notion Internship Tracker Database
```

---

## Required Fields for Valid Rows

### Critical (Must Have)

These three fields are **required** to create a row. Without them, the function will return `None` and log an error:

1. **company** - Company name (string)
   - Example: `"Google"`, `"Microsoft"`, `"Startup X"`
   - Must not be empty

2. **role** - Job title/position (string)
   - Example: `"Software Engineer Intern"`, `"Product Manager"`
   - Must not be empty

3. **url** - Application URL (string)
   - Example: `"https://careers.google.com/jobs/..."`
   - Must not be empty

### Recommended (Optional but Useful)

These fields enhance the row but aren't required:

4. **location** - Job location (string)
   - Defaults to `"Remote"` if not provided
   - Example: `"San Francisco, CA"`, `"New York, NY"`

5. **priority_score** - Ranking score (number 0-100)
   - Defaults to `0` if not provided
   - Higher = better match

6. **matched_skills** - Skills you have (list of strings)
   - Defaults to `[]` if not provided
   - Example: `["Python", "React", "Docker"]`

7. **missing_skills** - Skills you need to learn (list of strings)
   - Defaults to `[]` if not provided
   - Example: `["Go", "Kubernetes"]`

8. **why_fits** - Why this role is a good fit (string)
   - Defaults to `""` if not provided
   - Example: `"Strong Python background, remote-friendly"`

9. **blocker** - Any concerns about the role (string)
   - Defaults to `""` if not provided
   - Example: `"Located in India, but I need US visa sponsorship"`

---

## How to Use Properly

### Creating a Row Correctly

```python
from internship_agent.notion import create_internship

job_data = {
    # REQUIRED - Will fail if missing
    "company": "Google",
    "role": "Software Engineer Intern",
    "url": "https://careers.google.com/...",

    # OPTIONAL but recommended
    "location": "Mountain View, CA",
    "priority_score": 95,
    "matched_skills": ["Python", "Algorithms", "System Design"],
    "missing_skills": ["Go"],
    "why_fits": "Perfect role for backend development experience",
    "blocker": "",  # No blockers
}

page_id = create_internship(job_data)

if page_id:
    print(f"✅ Created internship row: {page_id}")
else:
    print("❌ Failed to create row - check logs for details")
```

### Complete Example with Ranking

```python
from internship_agent.jobs.search import search_internships
from internship_agent.llm.ranking import rank_internship
from internship_agent.notion import create_internship, get_user_profile

# Step 1: Search for jobs
jobs = search_internships("Python internship", location="San Francisco")

# Step 2: Get user profile for ranking
profile = get_user_profile()

# Step 3: Rank each job
for job in jobs:
    # rank_internship adds: priority_score, matched_skills, missing_skills, why_fits, blocker
    ranked_job = rank_internship(profile, job)

    # Step 4: Create row (will now have all required + ranking data)
    page_id = create_internship(ranked_job)

    if page_id:
        print(f"✅ Saved: {job['company']} - {job['role']}")
    else:
        print(f"❌ Failed to save: {job['company']} - {job['role']}")
```

---

## Troubleshooting Blank Rows

### If You See Blank Rows in Notion

**Before (Old Behavior)**:
- Blank rows with no data
- No error messages
- No way to know what went wrong

**After (Fixed Behavior)**:
- Rows are only created if data is valid
- Clear error messages in logs
- You can fix the source data and retry

### Common Issues & Fixes

#### Issue 1: "Missing required fields: ['company', 'role']"

**Cause**: Job search returned incomplete data

**Fix**: Make sure the job source provides complete data
```python
# ❌ Wrong - job dict is incomplete
job = {"url": "https://..."}  # Missing company, role
create_internship(job)

# ✅ Right - ensure all required fields
job = {
    "company": "Company Name",
    "role": "Job Title",
    "url": "https://...",
    "location": "Location",
}
create_internship(job)
```

#### Issue 2: "Blocker Reason is empty" warning

**Cause**: No blocker data from ranking

**Fix**: This is OK - blocker is optional. Row will be created with empty blocker field.

**To avoid**: Ensure ranking module always returns blocker data:
```python
ranking = rank_internship(profile, job)
# ranked_job should have: priority_score, matched_skills, missing_skills, why_fits, blocker
```

#### Issue 3: "Database not found. Run init_notion() first."

**Cause**: Internship tracker database hasn't been created

**Fix**: Initialize the Notion workspace first
```python
from internship_agent.notion import init_notion
init_notion()  # Creates database and schema
```

---

## Checking the Logs

The validation now provides detailed logs:

### Success Log
```
ℹ️  create_internship: Creating row for Google
ℹ️  Database schema: ['Company', 'Role', 'Apply URL', ...]
ℹ️  Properties to save: ['Company', 'Role', 'Apply URL', 'Location', ...]
✓ Created page: abc123def456...
ℹ️  Saved data: {
    'company': 'Google',
    'role': 'SWE Intern',
    'location': 'Mountain View',
    'priority_score': 95,
    'has_matched_skills': True,
    'has_missing_skills': False,
    'has_why_fits': True,
    'has_blocker': False
}
```

### Failure Log
```
❌ create_internship: Cannot create row - missing required fields: ['company', 'role']
   Data provided: {'url': 'https://...'}
   Required: company, role, url
```

### Warning Log
```
⚠️  create_internship: Missing optional ranking fields: ['matched_skills', 'why_fits']
   Row will be created but ranking data will be empty
```

---

## Testing

### Test Case 1: Valid Complete Row
```python
test_job = {
    "company": "Google",
    "role": "SWE Intern",
    "url": "https://careers.google.com/jobs/123",
    "location": "Mountain View, CA",
    "priority_score": 90,
    "matched_skills": ["Python", "Algorithms"],
    "missing_skills": ["Go"],
    "why_fits": "Strong backend skills",
    "blocker": "",
}

page_id = create_internship(test_job)
assert page_id is not None, "Should create row with complete data"
print("✅ Test 1 passed: Valid row created")
```

### Test Case 2: Missing Required Field
```python
test_job = {
    "company": "Google",
    # Missing "role" and "url"
}

page_id = create_internship(test_job)
assert page_id is None, "Should NOT create row with missing required fields"
print("✅ Test 2 passed: Invalid row rejected")
```

### Test Case 3: Minimal Valid Row
```python
test_job = {
    "company": "Microsoft",
    "role": "PM Intern",
    "url": "https://careers.microsoft.com/jobs/456",
    # No optional fields
}

page_id = create_internship(test_job)
assert page_id is not None, "Should create row with just required fields"
print("✅ Test 3 passed: Minimal valid row created")
```

---

## Best Practices

✅ **DO:**
- Always provide company, role, and URL
- Add location for context
- Include ranking data when available
- Check logs for errors before retrying
- Use the guide to understand the data structure

❌ **DON'T:**
- Pass incomplete job dicts directly
- Ignore error logs
- Manually create rows with blank data
- Use empty strings for company/role
- Expect rankings if profile data is missing

---

## For Developers

### Modifying create_internship()

If you need to change the function:

1. **Keep validation checks first** - Do not remove the required field validation
2. **Add new fields to optional list** - If adding optional data, update the warning check
3. **Update the logged data** - Add new fields to the success log
4. **Test edge cases** - Missing fields, empty values, null values
5. **Check callers** - Ensure callers handle None returns

### Modifying Database Schema

If you change the database columns:

1. Update `create_internship_database()` to match new schema
2. Update the candidates dict to map new fields
3. Update the data validation to require new critical fields
4. Update this guide with new schema

---

**Last Updated**: 2026-03-27
**Version**: 2.0 (With Validation)
