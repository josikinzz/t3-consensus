# Analytics System Technical Documentation

## Overview
The Analytics section employs a sophisticated three-phase process to transform consensus text into actionable insights:

1. **JSON Conversion Phase**: Uses GPT-4.1 to extract structured data from consensus text
2. **Client-Side Processing**: Performs calculations to generate metrics and scores
3. **Visualization Rendering**: Creates interactive dashboards with multiple analysis views

The system uses a fallback chain of prompts (v3 → safe → v2) to ensure reliable JSON extraction even with complex consensus outputs.

## Data Flow Architecture

### 1. JSON Conversion Process
The system uses a sophisticated prompt chain to extract structured data:

```javascript
// Primary prompt: json-conversion-prompt-v3.txt
// First fallback: json-conversion-prompt-safe.txt (uses single quotes)
// Second fallback: json-conversion-prompt-v2.txt (simplified structure)
```

The conversion extracts:
- **Themes**: Model positions, stances, and importance levels
- **Insights**: AI-generated patterns and conclusions
- **Model Behavior**: Response styles and tendencies
- **Consensus Formation**: How agreement developed

### 2. JSON Structure

The converted JSON follows this schema:

```json
{
  "themes": [{
    "name": "Theme title",
    "statement": "What models discussed",
    "modelPositions": {
      "modelName": {
        "stance": "support|disagree|neutral|not_mentioned",
        "mentioned": true|false
      }
    },
    "importance": "high|medium|low"
  }],
  "insights": {
    "keyFinding": "Most important insight",
    "strongestConsensus": "Where models agree most",
    "biggestControversy": "Where they disagree most",
    "practicalImplications": ["Real-world applications"]
  },
  "modelBehavior": {
    "modelName": {
      "responseStyle": "concise|detailed|creative|analytical|balanced",
      "tendencies": ["unique behaviors"]
    }
  },
  "consensusFormation": {
    "pattern": "convergent|divergent|polarized|uniform",
    "description": "How consensus developed"
  }
}
```

### 3. Client-Side Calculations

## Core Metrics & Calculations

### Theme-Level Metrics

#### **Consensus Strength** (0-100%)
```javascript
// For each theme:
consensusStrength = (supportingModels / modelsThatMentioned) × 100

// Overall consensus:
overallConsensus = average(all theme consensus strengths)
```
- Measures agreement level among models that discussed the theme
- Only includes models that explicitly mentioned the theme
- Tooltip: "Percentage of models supporting this theme out of those who mentioned it"

#### **Controversy Score** (0-100%)
```javascript
controversyScore = (disagreeingModels / modelsThatMentioned) × 100
```
- Measures disagreement level
- Inverse relationship with consensus strength
- Tooltip: "Percentage of models disagreeing with this theme"

#### **Impact Score** (0-10)
```javascript
// Importance weights:
high = 8, medium = 5, low = 3

impactScore = (importanceWeight × mentionRate) / 10
mentionRate = modelsThatMentioned / totalModels
```
- Combines theme importance with how many models discussed it
- Higher scores indicate themes that are both important and widely discussed

### Model-Level Metrics

#### **Trust Score** (0-100)
```javascript
trustScore = (agreementRate × 0.7) + (coverageScore × 0.3)

agreementRate = (timesAgreedWithMajority / timesMentioned) × 100
coverageScore = (themesMentioned / totalThemes) × 100
```
- Weighted combination of how often a model agrees and participates
- Tooltip: "How reliable this model is based on agreement patterns and participation"

#### **Agreement Score** (0-100%)
```javascript
agreementScore = (themesSupported / themesMentioned) × 100
```
- Percentage of themes where model took a supportive stance
- Only counts themes the model explicitly mentioned

#### **Divergence Score** (0-100%)
```javascript
divergenceScore = (themesDisagreed / themesMentioned) × 100
```
- Percentage of themes where model disagreed
- High divergence may indicate critical thinking or contrarian tendencies

### Relationship Metrics

#### **Model Agreement Percentage**
```javascript
// For each model pair:
sharedThemes = themes where both models have explicit stances
agreedThemes = shared themes where stances match

agreementPercentage = (agreedThemes / sharedThemes) × 100
```

#### **Relationship Classifications**
- **Aligned** (80-100%): "These models frequently agree"
- **Complementary** (60-79%): "Moderate agreement with some differences"
- **Independent** (40-60%): "Mixed agreement and disagreement"
- **Opposing** (0-39%): "These models often disagree"

### Global Metrics

#### **Overall Consensus Strength**
```javascript
overallStrength = weightedAverage(themeConsensusStrengths)
// Weighted by number of models mentioning each theme
```

#### **Reliability Index** (0-100)
```javascript
reliabilityIndex = average([
  participationRate,      // % of models that responded
  consistencyScore,       // How consistent agreement patterns are
  coverageCompleteness,   // How thoroughly themes were covered
  consensusDistribution   // How evenly consensus is distributed
])
```

## Visualization Components

### 1. Consensus Snapshot
A high-level dashboard displaying:

- **Consensus Strength Indicator**
  - Visual gauge with percentage
  - Color-coded: Green (>80%), Yellow (60-80%), Red (<60%)
  - Dynamic icon based on strength level

- **Key Metrics Grid**
  - Total themes identified
  - Controversial areas (>40% disagreement)
  - Key finding (AI-generated insight)
  - Reliability index with confidence level

### 2. Theme Explorer
Interactive cards with:

- **Visual Indicators**
  - Consensus type badge (Unanimous/Majority/Split/Single)
  - Impact level indicator for high-impact themes
  - Progress bars for consensus/controversy

- **Search & Filter System**
  ```javascript
  // Search: Matches theme names and statements
  // Sort: consensusStrength|controversy|impact|alphabetical
  // Filter: unanimous|majority|split|controversial|highImpact
  ```

- **Model Stance Display**
  - Green pills for supporting models
  - Red pills for disagreeing models
  - Gray text for neutral/not mentioned

### 3. Model Behavior Analyzer

#### Individual Profiles
- **Trust Score Gauge**: Visual indicator with percentage
- **Behavioral Metrics**: Agreement rate, divergence score, coverage
- **Response Style**: Classification with description
- **Signature Moves**: Unique tendencies (AI-identified)

#### Relationship Matrix
- **Interactive Grid**: Click cells for detailed comparison
- **Color Coding**: 
  - Dark green: Aligned (80-100%)
  - Light green: Complementary (60-79%)
  - Yellow: Independent (40-60%)
  - Orange/Red: Opposing (0-39%)
- **Tooltips**: Show exact percentage and relationship type

### 4. Analytics View Tab

#### Controversy Heatmap
- **Visual Grid**: Themes as rows, intensity shows controversy level
- **Color Scale**: Green (low) → Yellow (medium) → Red (high controversy)
- **Interactive**: Hover for exact scores and details

#### Model Agreement Matrix
- **Pairwise Comparisons**: Every model pair's agreement percentage
- **Symmetrical Grid**: Same data reflected across diagonal
- **Quick Insights**: Identify model clusters and outliers

#### Consensus Flow Visualization
- **Formation Patterns**:
  - **Convergent**: "Models reached agreement through discussion"
  - **Divergent**: "Initial agreement gave way to different views"
  - **Polarized**: "Models split into distinct camps"
  - **Uniform**: "Consistent agreement from start to finish"

## Tooltip System

The UI includes comprehensive tooltips explaining:

### Metric Tooltips
- **Consensus Strength**: "Percentage of models supporting this theme out of those who mentioned it"
- **Trust Score**: "How reliable this model is based on agreement patterns and participation"
- **Impact Score**: "Importance rating combined with how many models discussed this theme"
- **Agreement Rate**: "How often this model's position aligns with the majority consensus"

### Classification Tooltips
- **Response Styles**:
  - **Concise**: "Provides brief, focused responses"
  - **Detailed**: "Offers comprehensive, in-depth analysis"
  - **Creative**: "Brings unique perspectives and novel ideas"
  - **Analytical**: "Focuses on logical reasoning and evidence"
  - **Balanced**: "Combines multiple approaches effectively"

### Visual Indicator Tooltips
- **Color Meanings**: Explain green/yellow/red scales
- **Relationship Types**: Define aligned/complementary/independent/opposing
- **Consensus Types**: Clarify unanimous/majority/split/single classifications

## Error Handling & Edge Cases

### Division by Zero Protection
```javascript
// All percentage calculations include safeguards:
if (denominator === 0) return 0;
```

### Value Clamping
```javascript
// Ensure percentages stay within bounds:
Math.max(0, Math.min(100, calculatedValue))
```

### Missing Data Handling
- Models not mentioned: Excluded from calculations
- Empty themes: Filtered out before processing
- Malformed JSON: Fallback to simpler prompt versions

### Format Normalization
```javascript
// Handles both v3 detailed format and v2 simple format:
if (data.calculatedMetrics) {
  // Use pre-calculated values
} else {
  // Calculate client-side
}
```

## Color Coding System

### Consensus Strength Colors
- **Green** (#28a745): Strong consensus (>80%)
- **Yellow** (#ffc107): Moderate consensus (60-80%)
- **Red** (#dc3545): Weak consensus (<60%)

### Controversy Colors
- **Green** (#28a745): Low controversy (<20%)
- **Yellow** (#ffc107): Moderate controversy (20-40%)
- **Red** (#dc3545): High controversy (>40%)

### Trust Level Colors
- **Dark Green** (#1e7e34): Very reliable (>85%)
- **Green** (#28a745): Reliable (70-85%)
- **Yellow** (#ffc107): Moderate (50-70%)
- **Orange** (#fd7e14): Low reliability (<50%)

## Implementation Details

### Prompt Selection Logic
```javascript
// In analytics.js:
const promptFile = isSimpleFormat ? 
  'json-conversion-prompt-safe.txt' : 
  'json-conversion-prompt-v3.txt';

// Fallback chain on error:
// v3 (comprehensive) → safe (single quotes) → v2 (simplified)
```

### Key Functions

#### `generateAnalytics(consensusData, consensusText)`
1. Determines format (simple vs detailed)
2. Loads appropriate prompt
3. Calls OpenRouter API with GPT-4.1
4. Processes returned JSON
5. Renders all three view tabs

#### `calculateThemeMetrics(theme, totalModels)`
- Counts supporting/disagreeing/neutral positions
- Calculates consensus and controversy scores
- Determines consensus type classification
- Computes impact scores

#### `analyzeModelBehavior(analyticsData)`
- Calculates trust scores for each model
- Builds relationship matrix
- Identifies most reliable/innovative models
- Generates behavior profiles

### Performance Optimizations
- Batch DOM updates for smooth rendering
- Efficient search using lowercase matching
- Debounced filter updates
- Lazy loading of detailed analytics

## Tips for Effective Use

1. **Interpreting Consensus Strength**
   - 90-100%: Near-universal agreement, highly reliable
   - 70-89%: Strong majority, generally trustworthy
   - 50-69%: Moderate agreement, consider dissenting views
   - Below 50%: No clear consensus, examine individual positions

2. **Understanding Trust Scores**
   - High trust + High coverage = Most reliable model
   - High trust + Low coverage = Selective but accurate
   - Low trust + High coverage = Active but often disagrees
   - Low trust + Low coverage = Limited participation

3. **Using the Theme Explorer**
   - Start with high-impact themes for key insights
   - Filter by "controversial" to find disagreements
   - Sort by consensus strength to see agreements
   - Search for specific topics of interest

4. **Reading the Model Matrix**
   - Dark green cells indicate model pairs that think similarly
   - Red/orange cells show models with opposing views
   - Use this to understand model biases and perspectives

5. **Consensus Formation Patterns**
   - Uniform patterns suggest straightforward topics
   - Polarized patterns indicate fundamental disagreements
   - Convergent patterns show successful deliberation
   - Divergent patterns may need more discussion