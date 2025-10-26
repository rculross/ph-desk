# Skills Management System for PH Tools Desktop

## What We're Doing

This directory (`docs/skills/`) contains **custom Claude skills specifically designed for PH Tools Desktop and Planhat data**. These skills extend Claude's capabilities by providing specialized knowledge about:

- Planhat platform data schemas and entity relationships
- PH Tools Desktop export formats and structures
- Common analysis workflows for Planhat data
- Integration patterns (Salesforce mapping, etc.)

**Important**: This is a fully supported and documented feature of Claude. Skills are modular packages that provide specialized domain knowledge to Claude instances. We are creating program-specific skills that can be used both with claude.ai and via API integration.

### Why This Exists

As a desktop application for Planhat users, PH Tools Desktop handles complex data structures and workflows. Rather than repeatedly explaining Planhat schemas and data relationships to Claude, we package this knowledge into reusable skills that:

1. **Reduce context repetition** - No need to re-explain Planhat entity types every session
2. **Ensure consistency** - All Claude instances use the same canonical knowledge
3. **Enable powerful workflows** - Users export data from PH Tools and analyze it with Claude using these skills
4. **Support API integration** - The app can call Claude API and reference specific skills programmatically

**This IS possible and fully supported** - Skills are a core Claude feature documented at claude.ai/skills.

## Use Cases

### Use Case 1: Export → claude.ai Workflow

**Scenario**: A user exports Planhat issues data from PH Tools Desktop and wants to analyze it with Claude.

**Workflow**:
1. User clicks "Export to CSV" in IssuesExporter component
2. Data is exported in PH Tools format (with specific columns, relationships)
3. User opens claude.ai in browser
4. User uploads the CSV file + the `planhat-schemas` skill zip file
5. User asks: "Analyze these issues and identify patterns in customer feedback"
6. Claude has full context of Planhat data schemas and can analyze intelligently

**Why this works**: The skill provides Claude with knowledge of:
- What each column means (e.g., `issueType`, `priority`, `status`)
- Relationships between entities (Issues → Companies → Contacts)
- Common patterns and workflows in Planhat
- Export format specifics from PH Tools Desktop

### Use Case 2: API Integration Workflow

**Scenario**: PH Tools Desktop's LLM integration service calls Claude API with skill context.

**Workflow**:
1. User selects issues in the app and clicks "Analyze with AI"
2. `llm.service.ts` prepares the data and API request
3. Request includes a skill reference (e.g., "use planhat-schemas skill")
4. Claude API processes the request with skill context
5. Response is displayed in the app with intelligent analysis

**Implementation note**: This requires Claude API to support skill references in API calls. If not yet available, the skill content can be included in the system prompt as a workaround.

## Architecture

### Directory Structure

```
docs/skills/                          # Custom skills for PH Tools Desktop
├── SKILLS-OVERVIEW.md               # This file - foundational context
└── planhat-schemas/                 # Example skill (to be created)
    ├── SKILL.md                     # Required skill definition
    ├── references/                  # Optional detailed documentation
    │   ├── entity-schemas.md        # Planhat entity types and fields
    │   └── export-formats.md        # PH Tools export specifications
    └── assets/                      # Optional templates/examples
        └── example-export.csv       # Sample export file
```

### Relationship to skill-creator

The `skill-creator` skill lives in `.claude/skills/skill-creator/` (Claude Code's managed skills directory). It provides:

- **Scripts**: `init_skill.py`, `package_skill.py`, `validate_skill.py`
- **Templates**: Generates proper SKILL.md structure with YAML frontmatter
- **Workflow guidance**: How to create effective skills

**Key point**: We use skill-creator's scripts with `docs/skills/` as the target directory:

```bash
# Initialize a new skill in docs/skills/
python .claude/skills/skill-creator/scripts/init_skill.py planhat-schemas --path docs/skills

# Package a skill for distribution
python .claude/skills/skill-creator/scripts/package_skill.py docs/skills/planhat-schemas
```

### Why Separate from .claude/skills/?

- `.claude/skills/` - Claude Code's managed skills (skill-creator, etc.)
- `docs/skills/` - PH Tools Desktop program-specific skills

This separation ensures:
1. Program-specific skills are version controlled with the codebase
2. Skills can be distributed with the application
3. Clear distinction between tooling skills and domain skills
4. Skills can be updated as the application evolves

## Core Principles

### Principle 1: Skills Are Program Documentation

Skills should document PH Tools Desktop's data structures and workflows. If a user would need to explain something about the app or Planhat data to Claude, that knowledge belongs in a skill.

**Examples of what belongs in skills**:
- Planhat entity schemas (Issues, Companies, Workflows, Contacts, etc.)
- Export format specifications (CSV columns, Excel sheet structures)
- Data relationships (how Issues link to Companies, how Workflows work)
- Common analysis patterns (issue categorization, trend analysis)
- Integration mappings (Planhat ↔ Salesforce field mappings)

**Examples of what does NOT belong in skills**:
- General TypeScript knowledge (Claude already knows this)
- React/Electron patterns (covered in CLAUDE.md)
- Build/deployment instructions (covered in README.md)

### Principle 2: One Skill Per Domain

Create focused skills for specific domains rather than monolithic skills:

- `planhat-schemas` - Planhat data structures and relationships
- `export-formats` - PH Tools export specifications
- `salesforce-integration` - Salesforce mapping and sync workflows
- `workflow-analysis` - Common workflow analysis patterns

**Rationale**: Smaller, focused skills load faster and are easier to maintain.

### Principle 3: Skills Evolve with the App

When PH Tools Desktop changes, update relevant skills:

- **API changes** → Update `planhat-schemas` skill
- **New export formats** → Update `export-formats` skill
- **New integrations** → Create new skill or update existing

**Best practice**: Include skill updates in pull requests that change data structures or export logic.

### Principle 4: Use References for Large Documentation

Keep SKILL.md lean (< 5k words) by moving detailed documentation to `references/`:

```
planhat-schemas/
├── SKILL.md                    # Overview, when to use, how to use references
└── references/
    ├── issues-schema.md        # Detailed Issues entity documentation
    ├── companies-schema.md     # Detailed Companies entity documentation
    └── relationships.md        # How entities relate to each other
```

Claude will read reference files as needed. Include grep patterns in SKILL.md to help Claude find specific information.

### Principle 5: Include Example Data in Assets

Use `assets/` for example files that demonstrate data structures:

```
planhat-schemas/
└── assets/
    ├── sample-issues-export.csv      # Example issues export
    ├── sample-companies-export.xlsx  # Example companies export
    └── sample-workflow-export.json   # Example workflow export
```

These files help Claude understand the actual format of exported data.

## Workflow Guide

### Creating a New Skill

**Step 1: Determine if a new skill is needed**

Ask yourself:
- Does this knowledge fit in an existing skill? (If yes, update that skill instead)
- Is this domain-specific knowledge that Claude lacks? (If no, it doesn't belong in a skill)
- Will this be reused across multiple conversations? (If no, it doesn't need to be a skill)

**Step 2: Initialize the skill structure**

```bash
# From the project root
python .claude/skills/skill-creator/scripts/init_skill.py <skill-name> --path docs/skills
```

This creates:
```
docs/skills/<skill-name>/
├── SKILL.md                 # Edit this
├── scripts/                 # Delete if not needed
├── references/              # Keep if needed
└── assets/                  # Keep if needed
```

**Step 3: Populate SKILL.md**

Edit `SKILL.md` to include:
1. **YAML frontmatter** (required):
   ```yaml
   ---
   name: planhat-schemas
   description: This skill should be used when analyzing Planhat data exported from PH Tools Desktop. It provides schemas, relationships, and export format specifications.
   ---
   ```

2. **Purpose section**: What is this skill for? (2-3 sentences)

3. **When to use section**: Specific triggers (e.g., "Use this skill when analyzing CSV exports from PH Tools Desktop")

4. **How to use section**: Instructions for Claude on using bundled resources

**Step 4: Add references and assets**

- Add detailed docs to `references/` (schemas, API specs, etc.)
- Add example files to `assets/` (sample exports, templates)
- Reference these files from SKILL.md

**Step 5: Validate and package**

```bash
# Validate the skill
python .claude/skills/skill-creator/scripts/validate_skill.py docs/skills/<skill-name>

# Package for distribution
python .claude/skills/skill-creator/scripts/package_skill.py docs/skills/<skill-name>
```

This creates `<skill-name>.zip` that can be uploaded to claude.ai.

### Updating an Existing Skill

**When to update**:
- Application code changes that affect data structures
- New export formats added
- API endpoints change
- User feedback reveals missing knowledge

**Workflow**:
1. Edit relevant files in `docs/skills/<skill-name>/`
2. Update version/date in SKILL.md comments (optional but recommended)
3. Re-validate: `python .claude/skills/skill-creator/scripts/validate_skill.py docs/skills/<skill-name>`
4. Re-package: `python .claude/skills/skill-creator/scripts/package_skill.py docs/skills/<skill-name>`
5. Test with claude.ai using sample data
6. Commit changes to git with descriptive message

### Testing Skills

**Local testing (with Claude Code)**:
1. Make changes to skill in `docs/skills/<skill-name>/`
2. Copy skill to `.claude/skills/` temporarily
3. Start new Claude Code session
4. Verify skill loads and works as expected
5. Remove from `.claude/skills/` when done

**Testing with claude.ai**:
1. Package the skill: `python .claude/skills/skill-creator/scripts/package_skill.py docs/skills/<skill-name>`
2. Go to claude.ai in browser
3. Upload the skill zip file
4. Test with sample data from PH Tools Desktop
5. Verify Claude understands schemas and provides accurate analysis

**Testing with API (when supported)**:
1. Update `llm.service.ts` to reference the skill
2. Use the app's LLM integration features
3. Verify responses are accurate and context-aware

## Skill Naming Conventions

- Use **kebab-case** for skill directory names: `planhat-schemas`, `export-formats`
- Use **descriptive names** that indicate the domain: Not `helpers` but `workflow-analysis`
- Use **singular or plural** consistently: `planhat-schema` or `planhat-schemas` (pick one style)

## Version Control

All skills in `docs/skills/` should be:
- ✅ Committed to git (they are program documentation)
- ✅ Included in pull requests when relevant
- ✅ Updated when application data structures change
- ❌ NOT ignored or treated as build artifacts

**Packaged skill zips** (e.g., `planhat-schemas.zip`):
- ❌ Should NOT be committed to git (add `*.zip` to `.gitignore` in `docs/skills/`)
- ✅ Should be generated as needed for distribution
- ✅ Can be uploaded to releases for user distribution

## Quick Reference Commands

```bash
# Initialize new skill
python .claude/skills/skill-creator/scripts/init_skill.py <name> --path docs/skills

# Validate skill
python .claude/skills/skill-creator/scripts/validate_skill.py docs/skills/<name>

# Package skill
python .claude/skills/skill-creator/scripts/package_skill.py docs/skills/<name>

# Package to specific output directory
python .claude/skills/skill-creator/scripts/package_skill.py docs/skills/<name> ./dist
```

## Next Steps

To get started with the skills system:

1. **Read this document thoroughly** - Ensure you understand the purpose and workflows
2. **Create your first skill** - Start with `planhat-schemas` (Planhat data structures)
3. **Test with real data** - Export data from PH Tools, upload to claude.ai with skill
4. **Iterate** - Update skills as you discover gaps in knowledge or coverage
5. **Integrate with app** - Once skills are stable, integrate with `llm.service.ts` for API use

## Additional Resources

- **Claude Skills Documentation**: https://claude.ai/skills (official docs)
- **skill-creator skill**: `.claude/skills/skill-creator/SKILL.md` (detailed skill creation guide)
- **PH Tools Architecture**: `CLAUDE.md` (application architecture and patterns)
- **API Layer**: `src/api/` (how Planhat API integration works)
- **Export Services**: `src/services/export.service.ts`, `src/services/enhanced-export.service.ts`

## Troubleshooting

**Problem**: Skill doesn't load in claude.ai
- **Solution**: Ensure SKILL.md has valid YAML frontmatter and required `name` and `description` fields

**Problem**: Claude doesn't reference the skill content
- **Solution**: Make the `description` in YAML frontmatter more specific about when to use the skill

**Problem**: Skill is too large / hits token limits
- **Solution**: Move detailed documentation to `references/` files that load on-demand

**Problem**: Skill references are outdated after app changes
- **Solution**: Update skills in the same PR that changes data structures; add skill updates to PR checklist

**Problem**: Not sure if something belongs in a skill
- **Solution**: Ask: "Would a user need to explain this to Claude when analyzing exported data?" If yes, it belongs in a skill.
