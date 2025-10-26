# Claude API Skills for Planhat Data Transformation

**Date**: October 24, 2025
**Status**: Planning
**Owner**: Rob Culross

## Overview

This plan describes a system for using Claude API Skills to intelligently transform Planhat data (workflows, Salesforce integrations, custom fields, etc.) based on natural language instructions.

## The Problem

Currently, when working with Planhat data:
- Users must manually edit complex JSON structures
- Changes require understanding nested object structures, validation rules, and entity relationships
- Simple changes like "add an email step to this workflow" require significant technical knowledge
- No way to leverage AI to intelligently modify Planhat configurations

## The Solution

Build an AI-powered transformation system that:
1. Takes a Planhat record (JSON)
2. Accepts a natural language instruction from the user
3. Uses Claude API with specialized Skills to transform the JSON
4. Returns the updated JSON to send back to Planhat

## What Are Claude API Skills?

Skills are packages uploaded to Anthropic that contain:
- **Expert knowledge** (instructions in markdown)
- **Executable code** (Python scripts for efficient operations)
- **Resources** (examples, schemas, validation rules)

When included in an API request, Claude can:
- Use the expert knowledge to understand domain-specific concepts
- Execute pre-written Python code (without generating it) to perform operations efficiently
- Apply consistent transformation logic across requests

## Proposed Architecture

### 1. Skill Development (Local)

Create skill folders in the project:
```
src/skills/
├── planhat-workflow-templates/
│   ├── instructions.md          # Expert knowledge about workflow structure
│   ├── transform.py             # Code to add/remove/modify workflow steps
│   └── examples/                # Sample workflows
│
├── planhat-salesforce-integration/
│   ├── instructions.md          # Salesforce integration expertise
│   ├── transform.py             # Field mapping, sync rules
│   └── examples/
│
├── planhat-custom-fields/
│   ├── instructions.md          # Custom field configuration
│   ├── transform.py             # Add/modify field definitions
│   └── examples/
│
└── planhat-conversations/
    ├── instructions.md          # Conversation data handling
    ├── transform.py             # Parse, analyze conversations
    └── examples/
```

### 2. Skill Upload (One-time per skill/version)

Use the Claude Skills API to upload each skill:
- Upload creates a `skill_id` for each skill
- Skills are versioned (can reference "latest" or specific versions)
- Skills are stored in Anthropic's infrastructure
- Updates require re-uploading with new version

### 3. Runtime Usage (In Desktop App)

When user wants to transform data:

```
User Flow:
1. User opens Planhat record (e.g., a workflow template)
2. User clicks "Transform with AI"
3. User types: "Add a step that sends an email to the account owner when a deal closes"
4. App determines entity type (workflow) - OR includes all skills and lets Claude choose
5. App calls Claude API with:
   - Current JSON
   - User's instruction
   - Relevant skill(s)
6. Claude executes transformation using skill knowledge + code
7. App receives updated JSON
8. User reviews and confirms changes
9. App sends updated JSON back to Planhat API
```

### 4. API Request Structure

```javascript
// Call to Claude API
{
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4000,
  messages: [
    {
      role: 'user',
      content: `Current workflow: ${JSON.stringify(workflowJson)}

User request: Add a step that sends an email to the account owner when a deal closes`
    }
  ],
  container: {
    skills: [
      {
        type: "custom",
        skill_id: "planhat-workflow-templates",
        version: "latest"
      }
      // Can include up to 8 skills total
      // Claude intelligently uses the most relevant one(s)
    ]
  }
}
```

## Benefits of This Approach

### 1. Token Efficiency
- Pre-written Python code in skills executes directly
- No token cost for generating counting/searching/validation code
- Expert knowledge is cached in the skill, not sent every time

### 2. Consistency
- Same transformation logic every time
- Validated schemas and examples in skills
- Predictable results

### 3. Scalability
- Can include multiple skills (up to 8) per request
- Claude automatically uses the most relevant skill
- Easy to add new entity types by creating new skills

### 4. Maintainability
- Skills are versioned
- Can update skills without changing app code
- Centralized expertise for each Planhat entity type

## Implementation Phases

### Phase 1: Foundation
1. Set up Skills API integration in desktop app
2. Create first skill (workflow templates) locally
3. Upload to Anthropic
4. Test basic transformation flow

### Phase 2: Core Skills
1. Create skills for primary Planhat entities:
   - Workflow templates
   - Salesforce integration
   - Custom fields
   - Conversations
2. Upload and test each

### Phase 3: UI Integration
1. Add "Transform with AI" button to relevant screens
2. Build natural language input interface
3. Add JSON diff viewer (before/after comparison)
4. Add confirmation step before applying changes

### Phase 4: Advanced Features
1. Multi-skill requests (let Claude choose best skill)
2. Skill usage analytics
3. Transformation history/undo
4. Batch transformations

## Technical Requirements

### Skills API Integration
- Service to upload skills to Anthropic
- Manage skill versions and IDs
- Track which skills are available

### LLM Service Extension
- Add `container` parameter support to `llmService.chat()`
- Handle skill-based responses
- Parse and validate returned JSON

### UI Components
- Natural language input for transformation requests
- JSON diff viewer
- Confirmation dialog
- Error handling for invalid transformations

### Storage
- Store skill IDs in app configuration
- Cache skill metadata locally
- Track transformation history

## Open Questions

1. **Skill Selection Strategy**:
   - Should app choose the skill based on entity type?
   - OR include all skills and let Claude choose?
   - Tradeoff: specificity vs. intelligence

2. **Validation**:
   - Should skills validate JSON before returning?
   - Should app validate before sending to Planhat?
   - What happens if transformation produces invalid JSON?

3. **Cost Management**:
   - Skills reduce token costs, but API calls still cost money
   - Should there be usage limits?
   - Track costs per entity type?

4. **Version Management**:
   - How often to update skills?
   - When to pin to specific versions vs. "latest"?
   - Migration strategy for skill updates?

## Success Metrics

- Reduction in time to modify Planhat configurations
- Percentage of successful transformations (valid JSON output)
- User satisfaction with natural language interface
- Cost per transformation vs. manual editing time saved

## References

- [Claude API Skills Guide](https://docs.claude.com/en/api/skills-guide)
- Planhat API Documentation
- Current LLM Integration: `src/services/llm.service.ts`
- Current Chat Interface: `src/components/llm/ChatInterface.tsx`

## Next Steps

1. Review and approve this plan
2. Research Skills API authentication and upload process
3. Design first skill (workflow templates) structure
4. Prototype basic transformation flow
