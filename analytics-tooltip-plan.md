# Analytics Section Tooltip Enhancement Plan

## Overview
This plan outlines areas in the analytics section that would benefit from tooltips to improve understanding while keeping the interface simple and clean. All tooltips will use the question mark icon format with hover tooltips.

## Areas Requiring Tooltips

### 1. Consensus Snapshot Dashboard

#### Metric Cards
- **Consensus Strength** 
  - *Tooltip:* "Average agreement level across all themes (0-100%). Higher values indicate models are more aligned in their responses."
  
- **Key Themes**
  - *Tooltip:* "Total number of distinct topics or ideas identified across all model responses."
  
- **Controversial Areas**
  - *Tooltip:* "Themes where models strongly disagree (controversy score >40%) or have split opinions."
  
- **Reliability Index**
  - *Tooltip:* "Percentage of themes with unanimous agreement. Higher values indicate more consistent model responses."
  
- **Formation Pattern**
  - *Tooltip:* "How consensus formed across themes - uniform (consistent agreement) or varied (mixed patterns)."

### 2. Theme Cards

#### Theme Badges
- **Consensus Type Badge** (Unanimous/Majority/Split/Single)
  - *Tooltip:* 
    - Unanimous: "All models that addressed this theme agree"
    - Majority: "More models agree than disagree"
    - Split: "Equal numbers agree and disagree"
    - Single: "Only one model addressed this theme"
  
- **High Impact Badge**
  - *Tooltip:* "This theme has high importance (8+/10) based on how many models mentioned it and its significance."
  
- **Controversial Badge**
  - *Tooltip:* "This theme has high disagreement (70%+ controversy score) among models."

#### Theme Metrics
- **Consensus Strength Bar**
  - *Tooltip:* "Percentage of models that agree on this theme out of those who mentioned it."
  
- **Controversy Level Bar**
  - *Tooltip:* "Percentage of models that disagree on this theme out of those who mentioned it."

### 3. Theme Explorer Controls

#### Sort Options
- **Sort Dropdown**
  - *Tooltip:* "Order themes by different criteria to find patterns"
  
#### Filter Options  
- **Filter Dropdown**
  - *Tooltip:* "Show only themes matching specific consensus patterns"

### 4. Controversy Analysis Section

#### Heatmap Cells
- **Each Cell**
  - *Tooltip:* "Color intensity shows controversy level: Red (80%+) = High, Orange (60-79%) = Medium, Yellow (40-59%) = Low, Green (<40%) = Minimal"

### 5. Model Agreement Matrix

#### Matrix Headers
- **Matrix Title**
  - *Tooltip:* "Shows how often each pair of models agree when they both address the same theme. Higher percentages mean models think similarly."

#### Matrix Legend
- **Legend**
  - *Tooltip:* "Agreement levels: High (90%+) = Very similar thinking, Medium (70-89%) = Generally aligned, Low (50-69%) = Some differences, Poor (<50%) = Often disagree"

### 6. Model Behavior Patterns

#### Relationship Cards
- **Relationship Types**
  - *Tooltips:*
    - Aligned: "These models agree 80%+ of the time"
    - Complementary: "These models agree 60-79% of the time"  
    - Opposing: "These models agree less than 40% of the time"
    - Independent: "These models have different focuses (40-60% agreement)"

### 7. Consensus Flow Section

#### Flow Cards
- **Unanimous Agreement**
  - *Tooltip:* "Themes where all models agree - strongest form of consensus"
  
- **Majority Consensus**
  - *Tooltip:* "Themes where most (but not all) models agree"
  
- **Split Opinion**
  - *Tooltip:* "Themes where models are evenly divided in their positions"
  
- **Single Voice**
  - *Tooltip:* "Themes mentioned by only one model - unique perspectives"

## Implementation Guidelines

1. **Consistency**: Use the same question mark icon style throughout
2. **Brevity**: Keep tooltips concise (1-2 sentences max)
3. **Clarity**: Use plain language, avoid technical jargon
4. **Context**: Explain both what something is AND why it matters
5. **Visual Hierarchy**: Only add tooltips where genuine confusion might occur

## Priority Order

1. **High Priority** (Most confusing concepts)
   - Consensus types (Unanimous/Majority/Split/Single)
   - Trust Score calculation
   - Controversy vs Consensus scores
   - Relationship types

2. **Medium Priority** (Helpful context)
   - Dashboard metrics
   - Impact scores
   - Matrix interpretation
   - Filter/sort options

3. **Low Priority** (Nice to have)
   - Individual theme metrics
   - Flow card descriptions

## Visual Design

- Small help icon: `<i data-lucide="help-circle" class="tooltip-icon"></i>`
- Icon size: 14px
- Color: Subtle gray, brightens on hover
- Placement: After labels, inline with text
- Native HTML title attribute for accessibility

## Example Implementation

```html
<span class="metric-label">
  Consensus Strength 
  <i data-lucide="help-circle" class="tooltip-icon"></i>
</span>
```

With parent element having:
```html
<div class="metric-row" title="Average agreement level across all themes...">
```

This approach maintains simplicity while providing helpful context exactly when users need it.