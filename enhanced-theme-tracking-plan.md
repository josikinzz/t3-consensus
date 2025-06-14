# Enhanced Theme Tracking Plan: Direct Mentions, Indirect Mentions, and Omissions

## Executive Summary

This plan outlines enhancements to the Multi-LLM Consensus Engine to add granular tracking of how models address themes (direct mentions, indirect mentions, and omissions). The changes follow the application's data flow from user input through final display, ensuring all components remain synchronized.

## Current State Analysis

### What Works Well
1. **Consensus Generation**: Already tracks "not addressed" in voting breakdown
2. **JSON Schema**: Supports 4 stance types (agree/disagree/neutral/not_mentioned)
3. **Analytics**: Properly calculates metrics excluding not_mentioned models
4. **UI**: Progressive loading, interactive filtering, and visual indicators

### Gap Identified
- **Theme Cards**: Don't visualize which models didn't mention a theme
- **Granularity**: No distinction between direct and indirect mentions
- **Consensus Sections**: "Not addressed" data exists but isn't prominently displayed

## Implementation Flow (Following Page Function Order)

### Step 1: User Submits Prompt
User enters a prompt and selects models to query.

### Step 2: Model Responses Collected
Individual models respond to the prompt (no changes needed here).

### Step 3: Consensus Generation Phase
**File: `prompts/consensus-prompt-template.js`**

Add new "Mention Quality Analysis" section to the prompt template:

```javascript
// Add between CONSENSUS_SUMMARY_END and VOTING_SUMMARY_START markers:

## MENTION_QUALITY_START
### Mention Quality Analysis

Analyze how each model addresses each theme. Categorize mentions as:
- Direct: Model explicitly discusses the theme with clear, specific language
- Indirect: Model implies or alludes to the theme without explicit statement  
- Omitted: Model doesn't address the theme at all

For each theme, provide:
1. List of models with direct mentions
2. List of models with indirect mentions
3. List of models that omitted the theme
4. Coverage percentage and insight about engagement patterns

**Theme: [Theme Name]**
- 🎯 Direct mentions: llm-!, llm-@ (explicitly discussed with specific language)
- 💭 Indirect mentions: llm-# (implied or alluded to without explicit statement)
- ⚪ Omitted: llm-$, llm-% (theme not addressed at all)
- 📊 Coverage: 3/5 models addressed (60% - 2 direct, 1 indirect)
- 💡 Insight: Most models directly addressed this theme, showing strong engagement

[Continue for each theme...]
## MENTION_QUALITY_END
```

**Subtle adjustments to existing sections:**

1. **Voting Summary**: Can now focus purely on agreement/disagreement since mention quality is handled separately
   - Remove or simplify the "Not addressed" line since it's now covered in detail above
   - Keep the format otherwise identical

2. **Disagreements Section**: No changes needed, but can reference the Mention Quality Analysis when discussing why certain models might have disagreed (e.g., "As shown in the mention quality analysis, llm-$ only indirectly addressed this theme, which may explain the disagreement")

### Step 4: Progressive Consensus Display
**File: `modules/consensus.js`**

Add the new section to the progressive generation system:

```javascript
// 1. Update the section order - mentionQuality comes after consensusSummary:
const sectionOrder = ['detailedComparison', 'consensusSummary', 'mentionQuality', 'votingSummary', 'disagreements', 'synthesis'];

// 2. Add to stepPrompts object (around line 137) - note the ordering:
const stepPrompts = {
    consensusSummary: "Now output the consensus summary section...",
    mentionQuality: "Now output the mention quality analysis section. For each theme, analyze whether each model addressed it directly (with explicit language), indirectly (implied or alluded to), or omitted it entirely. Include coverage percentages and insights about engagement patterns.",
    votingSummary: "Now output the voting summary section...",
    // ... rest of prompts
};

// 3. Add to SECTION_LOADING_MESSAGES (around line 327):
mentionQuality: [
    "Analyzing mention patterns across models...",
    "Categorizing direct vs indirect references...",
    "Evaluating theme coverage and engagement..."
],

// 4. Update initializeProgressiveConsensusDisplay() to include new accordion:
// In the HTML template, insert after consensus summary accordion:
`<div class="accordion-item">
    <div class="accordion-header" data-section="mentionQuality">
        <span class="accordion-title">Mention Quality Analysis</span>
        <span class="loading-indicator" id="mentionQuality-loading"></span>
        <svg class="accordion-icon">...</svg>
    </div>
    <div class="accordion-content" id="mentionQuality-content">
        <div class="consensus-section-content"></div>
        <button class="copy-button" onclick="window.copySection('mentionQuality')">Copy</button>
    </div>
</div>`

// 5. Update getSectionMarker() to map 'mentionQuality' to 'MENTION_QUALITY'
// 6. Update getSectionDisplayName() to return "Mention Quality Analysis"
```

### Step 5: JSON Conversion Phase
**File: `prompts/json-conversion-prompt-v3.txt`**

Update the prompt to extract mention quality data:

```javascript
// Add to the instructions section:

"When reading the consensus text, pay special attention to the 'Mention Quality Analysis' section. 
For each theme, extract:
1. Which models had direct mentions (🎯)
2. Which models had indirect mentions (💭)  
3. Which models omitted the theme (⚪)

Map this information to the mentionType field:
- Models listed under 'Direct mentions' → mentionType: 'direct'
- Models listed under 'Indirect mentions' → mentionType: 'indirect'
- Models listed under 'Omitted' → mentionType: 'omitted'

// Update the JSON schema to include:
"mentionType": "direct|indirect|omitted"  // How the model addresses the theme

// Add validation rules:
- If stance is 'not_mentioned', mentionType must be 'omitted'
- If mentionType is 'omitted', stance must be 'not_mentioned'
- If mentionType is 'direct' or 'indirect', stance must be one of: 'agree', 'disagree', or 'neutral'"
```

### Step 6: Analytics Calculation Phase
**File: `modules/calculations.js`**

Enhance metric calculations to use mention quality:

```javascript
// In calculateMetrics() function, add to theme processing:

// Extract mention type counts
const directCount = positions.filter(p => p.mentionType === 'direct').length;
const indirectCount = positions.filter(p => p.mentionType === 'indirect').length;
const omittedCount = positions.filter(p => p.mentionType === 'omitted').length;

// Calculate enhanced metrics
const coverageScore = Math.round(((directCount + indirectCount) / totalModels) * 100);
const clarityScore = (directCount + indirectCount) > 0 
    ? Math.round((directCount / (directCount + indirectCount)) * 100)
    : 0;

// Add to theme object
theme.mentionMetrics = {
    direct: directCount,
    indirect: indirectCount,
    omitted: omittedCount,
    coverageScore,
    clarityScore,
    coverageLabel: `${directCount + indirectCount}/${totalModels} models addressed`
};

// Update model behavior analysis to track mention patterns
```

### Step 7: UI Display Phase
**File: `modules/analytics.js`**

Update theme cards to show mention quality:

```javascript
// In createThemeCard() function, add after the existing metrics section:

// Create mention quality section
const mentionSection = document.createElement('div');
mentionSection.className = 'theme-mentions';
mentionSection.innerHTML = `
    <div class="mention-quality-header">
        <strong>Mention Quality</strong>
        <span class="coverage-badge">${theme.mentionMetrics.coverageLabel}</span>
    </div>
    <div class="mention-breakdown">
        <div class="direct-mentions">
            <span class="mention-icon">🎯</span>
            <strong>Direct (${theme.mentionMetrics.direct}):</strong> 
            ${getModelsByMentionType(theme, 'direct').join(', ') || 'None'}
        </div>
        <div class="indirect-mentions">
            <span class="mention-icon">💭</span>
            <strong>Indirect (${theme.mentionMetrics.indirect}):</strong> 
            ${getModelsByMentionType(theme, 'indirect').join(', ') || 'None'}
        </div>
        <div class="omitted-mentions">
            <span class="mention-icon">⚪</span>
            <strong>Omitted (${theme.mentionMetrics.omitted}):</strong> 
            ${getModelsByMentionType(theme, 'omitted').join(', ') || 'None'}
        </div>
    </div>
    <div class="mention-metrics">
        <div class="coverage-bar">
            <div class="bar-label">Coverage: ${theme.mentionMetrics.coverageScore}%</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${theme.mentionMetrics.coverageScore}%"></div>
            </div>
        </div>
        <div class="clarity-bar">
            <div class="bar-label">Clarity: ${theme.mentionMetrics.clarityScore}%</div>
            <div class="progress-bar">
                <div class="progress-fill clarity-fill" style="width: ${theme.mentionMetrics.clarityScore}%"></div>
            </div>
        </div>
    </div>
`;

// Helper function to get models by mention type
function getModelsByMentionType(theme, mentionType) {
    return Object.entries(theme.modelPositions)
        .filter(([model, position]) => position.mentionType === mentionType)
        .map(([model]) => model);
}
```

### Step 8: CSS Styling
**File: `multi-llm-consensus-chat-vanilla.css`**

Add styles for mention quality display:

```css
/* Mention Quality Styles */
.theme-mentions {
    margin-top: 15px;
    padding: 15px;
    background: var(--surface-1);
    border-radius: 8px;
}

.mention-quality-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.coverage-badge {
    background: var(--accent-secondary);
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.85em;
}

.mention-breakdown > div {
    margin: 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.mention-icon {
    font-size: 1.2em;
}

.direct-mentions { color: var(--success-color); }
.indirect-mentions { color: var(--warning-color); }
.omitted-mentions { color: var(--text-secondary); }

.mention-metrics {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
}

.coverage-bar, .clarity-bar {
    margin: 8px 0;
}

.clarity-fill {
    background: var(--info-color);
}
```

## Benefits of This Approach

1. **Follows Natural Data Flow**: Changes are organized in the order they're processed
2. **Clear Dependencies**: Each step builds on the previous one
3. **Easy Testing**: Can test each phase independently
4. **Minimal Disruption**: Existing functionality remains unchanged
5. **Progressive Enhancement**: System works even if some components aren't updated

## New Consensus Section Order

After implementation, the consensus accordion sections will appear in this order:

1. **Detailed Comparison** - Comprehensive table of model responses
2. **Consensus Summary** - Overview of consensus findings
3. **Mention Quality Analysis** *(NEW)* - How directly/indirectly each model addressed themes
4. **Voting Breakdown** - Agreement/disagreement details (simplified)
5. **Disagreements** - Analysis of significant disagreements
6. **Synthesis** - Final unified response

## Implementation Time Estimate

- Step 1-2: No changes needed (0 min)
- Step 3: Update consensus prompt (15 min)
- Step 4: Add progressive display (20 min)
- Step 5: Update JSON conversion (10 min)
- Step 6: Enhance calculations (15 min)
- Step 7: Update UI display (20 min)
- Step 8: Add CSS styling (10 min)

**Total: ~1.5 hours**

## Notes on Subtle Adjustments

- **Voting Breakdown**: The "Not addressed" line can be removed or reduced to just a count since detailed omission tracking is now in the Mention Quality section
- **Disagreements Section**: Can optionally reference mention quality insights when explaining disagreements
- **No Breaking Changes**: All existing functionality continues to work exactly as before