# Client-Side Calculations Implementation

## Overview
Implemented client-side calculations for all analytics metrics to ensure accuracy. LLMs no longer perform any mathematical calculations.

## Changes Made

### 1. New Simplified JSON Prompt (`json-conversion-prompt-v2.txt`)
- Only asks for classifications and observations
- No percentages, scores, or calculations
- Focus on extracting:
  - Model positions (agree/disagree/neutral/not_mentioned)
  - Quotes and reasoning
  - Importance levels (high/medium/low)
  - Behavioral observations

### 2. New Calculations Module (`modules/calculations.js`)
Performs all calculations client-side:

#### Theme-Level Calculations:
- `consensusType`: Based on actual vote counts
- `agreementLevel`: Based on agreement ratios
- `consensusStrengthScore`: (agrees / mentioned) × 100
- `controversyScore`: (disagrees / mentioned) × 100
- `impactScore`: Based on importance and mention rate

#### Summary Calculations:
- `totalThemes`: Count of themes
- `consensusScore`: Average of all theme consensus scores
- `controversyCount`: Themes with split or high controversy
- `reliabilityIndex`: Based on unanimous themes ratio

#### Model Behavior Calculations:
- `agreementScore`: Model's agreement rate across themes
- `divergenceScore`: 100 - agreementScore
- `trustScore`: Weighted combination of agreement and coverage
- `coverageScore`: How many themes the model addressed
- Model relationships with agreement percentages

#### Confidence Metrics:
- Theme type counts (unanimous, majority, split, single)
- `overallAgreementRate`: Total agreements / total mentions

### 3. Updated Analytics Module
- Loads new prompt (`json-conversion-prompt-v2.txt`)
- Calls `calculateAllMetrics()` after receiving raw JSON
- All visualizations use calculated data

## Benefits

1. **100% Accurate Math**: No more LLM calculation errors
2. **Consistent Results**: Same input always produces same calculations
3. **Faster Processing**: Smaller LLM responses
4. **Cost Savings**: Less tokens used
5. **Easier Debugging**: Can inspect and adjust formulas
6. **Extensible**: Easy to add new metrics

## Example Flow

1. LLM provides:
```json
{
  "themes": [{
    "modelPositions": {
      "GPT-4": { "stance": "agree" },
      "Claude": { "stance": "agree" },
      "Gemini": { "stance": "disagree" }
    }
  }]
}
```

2. JavaScript calculates:
```javascript
consensusStrengthScore: 66.7  // (2/3) × 100
controversyScore: 33.3         // (1/3) × 100
consensusType: "majority"      // 2 > 1
```

## Testing
The system now guarantees mathematically correct results for all metrics, eliminating the unreliability of LLM arithmetic.