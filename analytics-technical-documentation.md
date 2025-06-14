# Analytics System Technical Documentation

## Overview

The analytics system in the Multi-LLM Consensus Engine transforms raw consensus text into structured data and interactive visualizations. It consists of three main phases:

1. **JSON Conversion**: AI-powered extraction of structured data from consensus text
2. **Metric Calculation**: Client-side mathematical calculations on the extracted data
3. **Visualization**: Interactive dashboards displaying insights and patterns

## Data Flow Architecture

```
Consensus Text → JSON Conversion (GPT-4.1) → Raw JSON Data → 
Metric Calculations (Client-side) → Enhanced JSON → 
UI Rendering → Interactive Analytics Dashboard
```

## Phase 1: JSON Conversion

### Process
The system sends the consensus text to GPT-4.1 (configurable) with a specialized prompt that:
- Replaces anonymous model codes (llm-!, llm-@, etc.) with actual model names
- Extracts themes/topics discussed
- Classifies each model's position on each theme
- Identifies insights and patterns

### Prompt Evolution
The system includes three prompt versions with fallback support:

#### v3 (Primary) - Most Detailed
- Step-by-step instructions for accuracy
- Comprehensive JSON schema with all fields
- Critical JSON formatting rules to prevent parsing errors
- Example conversions for clarity

#### Safe Format - Simplified
- Uses single quotes to avoid escaping issues
- Minimal schema for reliability
- Reduced complexity for edge cases

#### v2 (Fallback) - Original
- Standard format without calculation instructions
- Basic theme extraction and classification

### JSON Structure Created

```json
{
  "themes": [
    {
      "name": "Theme Name",
      "statement": "What was concluded about this theme",
      "importance": "high|medium|low",
      "modelPositions": {
        "Model Name": {
          "stance": "agree|disagree|neutral|not_mentioned",
          "quote": "Optional relevant quote",
          "reasoning": "Brief explanation"
        }
      },
      "disagreements": []
    }
  ],
  "insights": {
    "mainConclusion": "Overall synthesis conclusion",
    "keyFindings": ["finding 1", "finding 2"],
    "surprisingPatterns": "Any unexpected observations",
    "practicalImplications": "What this means"
  },
  "modelBehavior": {
    "Model Name": {
      "responseStyle": "concise|detailed|balanced|creative|analytical",
      "tendencies": [],
      "uniqueContributions": []
    }
  },
  "consensusFormation": {
    "pattern": "convergent|divergent|polarized|uniform",
    "description": "How consensus developed"
  }
}
```

## Phase 2: Metric Calculations

All calculations are performed client-side in `calculations.js` for accuracy and transparency.

### Theme-Level Metrics

#### Consensus Strength Score
```
Consensus Strength = (Number of Supporting Models / Number of Models that Mentioned Theme) × 100
```
- Measures agreement level among models that addressed the theme
- 100% = All models that mentioned it agree
- 0% = No models agree

#### Controversy Score
```
Controversy Score = (Number of Disagreeing Models / Number of Models that Mentioned Theme) × 100
```
- Inverse of consensus strength
- High values indicate significant disagreement

#### Impact Score
```
Base Impact = importance level (high=8, medium=5, low=3)
Impact Score = Base Impact × (Models that Mentioned / Total Models)
```
- Combines importance with mention rate
- Clamped to 1-10 range
- Higher scores indicate themes that are both important and widely discussed

#### Consensus Type Classification
- **Unanimous**: All models agree (100% consensus)
- **Majority**: More than 50% of models agree, with more agreements than disagreements
- **Split**: Equal numbers agree and disagree
- **Single**: Only one model mentioned the theme
- **None**: No clear consensus pattern

#### Agreement Level
- **Unanimous**: 100% agreement rate
- **Strong**: 75-99% agreement rate
- **Moderate**: 50-74% agreement rate
- **Weak**: Below 50% agreement rate

### Summary Metrics

#### Overall Consensus Score
```
Average Consensus Score = Sum of all theme consensus scores / Number of themes
```

#### Reliability Index
```
Reliability Index = (Number of Unanimous Themes / Total Themes) × 100
```
- Measures consistency across the consensus
- Higher values indicate more reliable overall consensus

#### Controversy Count
Themes where either:
- Consensus type is "split"
- Controversy score > 40%

### Model Behavior Metrics

#### Agreement Score (per model)
```
Agreement Score = (Times Model Agreed / Times Model Mentioned Themes) × 100
```

#### Divergence Score
```
Divergence Score = 100 - Agreement Score
```

#### Trust Score
```
Trust Score = (Agreement Score × 0.7) + (Coverage Score × 0.3)
```
- Weighted combination of agreement tendency and topic coverage
- 70% weight on agreement, 30% on coverage

#### Coverage Score
```
Coverage Score = (Themes Model Mentioned / Total Themes) × 100
```

### Model Relationship Metrics

#### Agreement Percentage (between two models)
```
Agreement % = (Themes where both models have same stance / Themes both models mentioned) × 100
```

#### Relationship Classification
- **Aligned**: 80%+ agreement
- **Complementary**: 60-79% agreement
- **Independent**: 40-60% agreement
- **Opposing**: Below 40% agreement

### Consensus Evolution Metrics

#### Stability Score
```
Stability Score = 100 - Average Controversy Score
```
- Measures how stable the consensus is across themes

#### Emergent Themes
Count of themes that are:
- High impact (score >= 6)
- Not unanimous (emerged through discussion)

## Phase 3: Visualization Components

### Consensus Snapshot
High-level dashboard showing:
- **Consensus Strength**: Overall agreement percentage with contextual icon
- **Total Themes**: Count of distinct topics
- **Controversial Areas**: Count of high-disagreement themes
- **Reliability Index**: Percentage of unanimous themes
- **Strongest Agreement**: Theme with highest consensus
- **Biggest Controversy**: Theme with most disagreement
- **Formation Pattern**: How consensus developed

### Theme Explorer
Interactive theme cards with:
- **Search**: Real-time filtering by theme name or statement
- **Sort Options**: 
  - Consensus strength (highest to lowest)
  - Controversy (most to least controversial)
  - Impact (most to least important)
  - Alphabetical
- **Filter Options**:
  - Unanimous only
  - Majority consensus
  - Split opinions
  - Controversial (>40% controversy)
  - High impact (score >= 8)
- **Visual Indicators**:
  - Progress bars for consensus and controversy
  - Badges for consensus type, high impact, controversial
  - Model agreement visualization

### Model Behavior Analyzer
Comprehensive model analysis showing:
- **Individual Profiles**:
  - Trust/Reliability score with color coding
  - Response style classification
  - Agreement and divergence rates
  - Coverage percentage
  - Unique contributions count
  - Signature behavioral patterns
- **Relationship Mapping**:
  - Pairwise agreement percentages
  - Visual relationship indicators
  - Relationship type classification

### Analytics View Components

#### Controversy Heatmap
Visual grid showing:
- Themes on Y-axis
- Models on X-axis
- Color intensity indicating position:
  - Green: Agrees
  - Red: Disagrees
  - Yellow: Neutral
  - Gray: Not mentioned

#### Model Agreement Matrix
- Shows pairwise agreement percentages
- Color-coded cells (green=high, yellow=medium, red=low)
- Symmetric matrix with model names on both axes

#### Consensus Flow
Statistics on consensus patterns:
- Unanimous themes count
- Majority consensus count
- Split opinion count
- Single voice count

## Tooltip System

The system includes comprehensive tooltips (1-second delay on hover) explaining:

### Metric Tooltips
- **Consensus Strength**: "Average agreement level across all themes (0-100%). Higher values indicate models are more aligned in their responses."
- **Total Themes**: "Total number of distinct topics or ideas identified across all model responses."
- **Controversy Count**: "Themes where models strongly disagree (controversy score >40%) or have split opinions."
- **Reliability Index**: "Percentage of themes with unanimous agreement. Higher values indicate more consistent model responses."
- **Trust Score**: "Trust Score = (Agreement Rate × 70%) + (Coverage × 30%)\nMeasures overall reliability based on consensus alignment and topic coverage"

### Consensus Type Tooltips
- **Unanimous**: "All models that addressed this theme agree"
- **Majority**: "More models agree than disagree"
- **Split**: "Equal numbers agree and disagree"
- **Single**: "Only one model addressed this theme"

### Response Style Tooltips
- **Concise**: "Brief, to-the-point responses"
- **Detailed**: "Comprehensive, thorough responses"
- **Creative**: "Novel, imaginative approaches"
- **Analytical**: "Data-driven, systematic responses"
- **Balanced**: "Mix of different response styles"

### Relationship Tooltips
- **Aligned**: "These models agree 80%+ of the time"
- **Complementary**: "These models agree 60-79% of the time"
- **Independent**: "These models have different focuses (40-60% agreement)"
- **Opposing**: "These models agree less than 40% of the time"

## Color Coding System

### Consensus Strength Colors
- **90-100%**: Deep green (#10b981) - Very strong consensus
- **70-89%**: Green (#22c55e) - Strong consensus
- **50-69%**: Yellow (#eab308) - Moderate consensus
- **30-49%**: Orange (#f97316) - Weak consensus
- **0-29%**: Red (#ef4444) - Very weak consensus

### Trust Level Colors
- **80%+**: High trust (green accent)
- **60-79%**: Medium trust (yellow accent)
- **Below 60%**: Low trust (red accent)

### Relationship Strength Colors
- **80%+**: Strong relationship (green)
- **60-79%**: Moderate relationship (yellow)
- **Below 60%**: Weak relationship (red)

## Key Mathematical Insights

1. **Consensus vs Controversy**: These are inverse metrics. A theme cannot have both high consensus and high controversy.

2. **Trust Score Weighting**: The 70/30 split between agreement and coverage ensures models that consistently agree with consensus are valued, but coverage prevents gaming by only addressing easy topics.

3. **Impact Score Scaling**: Multiplying importance by mention rate ensures truly impactful themes are those both important AND widely discussed.

4. **Reliability Index**: Using only unanimous themes provides a strict measure of consensus quality.

5. **Model Relationships**: Calculated only on themes both models addressed, preventing bias from different coverage patterns.

## Error Handling

The system includes multiple safeguards:
- Division by zero protection in all calculations
- Fallback values for missing data
- Format normalization for different JSON structures
- Clamping of scores to valid ranges (0-100%, 1-10)
- Graceful handling of missing model positions

## Performance Considerations

- All calculations are performed client-side for instant updates
- JSON conversion is the only API call after consensus generation
- Metrics are calculated once and cached in the enhanced data structure
- UI updates use efficient DOM manipulation
- Search and filtering operate on pre-calculated data