# Multi-LLM Consensus Engine - Project Overview

## Purpose
This is a vanilla JavaScript/HTML/CSS implementation of a Multi-LLM Consensus Engine (originally called PolyLLM). It queries multiple language models with the same prompt and synthesizes their responses into a consensus view with analytics.

## Architecture
The project was refactored from a large monolithic JavaScript file (2640 lines) into modular ES6 modules for better maintainability.

### File Structure
```
/multi-llm-consensus-vanilla/
├── consensus.html                          # Main HTML file
├── multi-llm-consensus-chat-vanilla.css   # Styles (flat design, previously neumorphic)
├── modules/                                # ES6 JavaScript modules
│   ├── app.js        # Main application coordinator
│   ├── config.js     # Configuration, API keys, model definitions
│   ├── api.js        # OpenRouter API integration
│   ├── utils.js      # Utility functions
│   ├── loading.js    # Loading animations
│   ├── ui.js         # DOM manipulation and UI components
│   ├── consensus.js  # Consensus generation logic
│   └── analytics.js  # JSON conversion and analytics visualization
└── CLAUDE.md         # This file

```

## Key Features
1. **Multi-Model Querying**: Queries multiple LLMs (Claude, GPT-4, Gemini, etc.) via OpenRouter API
2. **Consensus Synthesis**: Uses Gemini 2.5 Flash Thinking to synthesize individual responses
3. **Analytics Dashboard**: Converts consensus to structured JSON and displays insights
4. **Loading Animations**: Shows progress for each model and phase
5. **Responsive UI**: Collapsible sections, tabs, and copy functionality

## Technical Details

### Models Available
- Default selected: Claude Opus 4, DeepSeek R1, O4 Mini High
- Visible by default: Claude Opus 4, DeepSeek R1, O4 Mini High, Qwen3 30B, Grok 3 Beta, Gemini Pro 2.5
- Hidden models: Claude Sonnet 4, GPT-4.1, ChatGPT 4o, Gemini 2.5 Flash Thinking
- Consensus model: Gemini 2.5 Pro (configurable)
- JSON conversion model: GPT-4.1 (configurable)

### Codename System
To reduce bias, models are assigned anonymous codenames when presented to the consensus model:
- Claude Opus 4: `llm-!`
- DeepSeek R1: `llm-@`
- O4 Mini High: `llm-#`
- Qwen3 30B: `llm-$`
- Grok 3 Beta: `llm-%`
- Gemini Pro 2.5: `llm-^`
- Claude Sonnet 4: `llm-&`
- GPT-4.1: `llm-*`
- ChatGPT 4o: `llm-(`
- Gemini 2.5 Flash Thinking: `llm-)`

### UI Components
- **Outputs Section**: Individual model responses with copy buttons
- **Consensus Section**: Three tabs (Organized Data, Raw Output, Consensus Prompt)
- **Analytics Section**: Three tabs (Synthesis View, Analytics View, Raw Data)
  - Synthesis View: Enhanced dashboard with consensus snapshot, interactive theme explorer, and detailed breakdown
  - Analytics View: Comprehensive model behavior analysis, relationship mapping, and advanced visualizations  
  - Raw Data: JSON output and processing prompt with enhanced schema

### Recent Features Added
- **Progressive Consensus Generation**: Consensus sections now populate one-by-one in real-time
- **Conversation-Based Analysis**: Uses sequential API calls for more detailed, untruncated consensus
- **Real-time UI Updates**: Visual loading states and completion indicators for each section
- **Improved Model Agreement Matrix**: Fixed duplicates and unclear naming
- **Model Response Rate Removed**: Cleaned up analytics dashboard
- **Enhanced Analytics Foundation**: Major upgrade to JSON schema and data processing
  - Rich calculated metrics (consensus strength, controversy scores, impact ratings)
  - AI-generated insights (strongest consensus, biggest controversy, practical implications)
  - Model behavior profiles (trust scores, response styles, unique contributions)
  - Consensus evolution tracking (formation patterns, stability metrics)
- **Upgraded Dashboard**: Consensus Snapshot with engaging visual hierarchy
  - Dynamic consensus strength indicators with contextual icons
  - Key finding highlights and reliability indices
  - Strongest agreement and biggest disagreement callouts
- **Enhanced Theme Cards**: Interactive theme visualization
  - Progress bars for consensus strength and controversy levels
  - Impact badges for high-importance themes
  - Visual metrics showing supporting vs. disagreeing models
- **Interactive Theme Explorer**: Full-featured theme discovery system
  - Real-time search functionality (theme names and statements)
  - Multi-criteria sorting (consensus strength, controversy, impact, alphabetical)
  - Advanced filtering (unanimous, majority, split, controversial, high-impact)
  - Dynamic result summaries and no-results state
  - Mobile-responsive controls and layout
- **Model Behavior Analyzer**: Comprehensive model personality and relationship analysis
  - Individual model profiles with trust scores, agreement rates, divergence scores
  - Response style categorization (concise, detailed, creative, analytical, balanced)
  - Signature moves and behavioral tendencies for each model
  - Model relationship mapping with agreement percentages and relationship types
  - Visual trust level indicators and interactive model comparison
  - "Most Reliable" and "Most Innovative" model identification

### Recent Issues Fixed
- Analytics section not displaying: Fixed by simplifying DOM manipulation
- Default model selections missing: Added to UI module
- Loading animations: Working for individual cards
- Markdown table parsing: Added fallback for consensus tables
- Model agreement matrix duplicates and unclear names: Fixed with better data cleaning

## Important Notes
- Uses OpenRouter API (requires API key in localStorage)
- ES6 modules require server (won't work with file:// protocol)
- Marked.js library loaded from CDN for markdown parsing
- All copy/download functions exposed globally via window object

## Common Commands
```bash
# Run local server for development
python -m http.server 8000
# or
npx http-server
```

## API Key
Set in browser console:
```javascript
localStorage.setItem('OPENROUTER_API_KEY', 'your-key-here')
```

## Known Limitations
- Analytics View tab is placeholder only
- Some advanced analytics features not yet implemented
- Requires active internet connection for API calls
- Rate limits depend on OpenRouter account tier