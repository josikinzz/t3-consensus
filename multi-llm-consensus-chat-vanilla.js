// Configuration
const OPENROUTER_API_KEY = "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";
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Available LLM Models for selection
const SELECTABLE_LLMS = [
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', maxContextTokens: 64000, maxOutputTokens: 64000 },
    { id: 'openai/o4-mini-high', name: 'O4 Mini High', maxContextTokens: 100000, maxOutputTokens: 100000 },
    { id: 'openai/gpt-4.1', name: 'GPT-4.1', maxContextTokens: 100000, maxOutputTokens: 100000 },
    { id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1', maxContextTokens: 32768, maxOutputTokens: 32768 },
    { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', maxContextTokens: 32000, maxOutputTokens: 32000 },
    { id: 'openai/chatgpt-4o-latest', name: 'ChatGPT 4o', maxContextTokens: 4096, maxOutputTokens: 4096 },
    { id: 'google/gemini-2.5-flash-preview:thinking', name: 'Gemini 2.5 Flash Thinking', maxContextTokens: 16000, maxOutputTokens: 16000 },
    { id: 'google/gemini-2.5-pro-preview', name: 'Gemini Pro 2.5', maxContextTokens: 16000, maxOutputTokens: 16000 },
    { id: 'qwen/qwen3-30b-a3b:free', name: 'Qwen3 30B', maxContextTokens: 32000, maxOutputTokens: 32000 },
    { id: 'x-ai/grok-3-beta', name: 'Grok 3 Beta', maxContextTokens: 32000, maxOutputTokens: 32000 }
];

// All models including consensus-only models
const ALL_LLMS = [
    ...SELECTABLE_LLMS.map(model => {
        // Mark Gemini 2.5 Flash Thinking as the consensus model
        if (model.id === 'google/gemini-2.5-flash-preview:thinking') {
            return { ...model, isConsensusModel: true };
        }
        return model;
    })
];

// For backwards compatibility
const AVAILABLE_LLMS = SELECTABLE_LLMS;

// Consensus prompt template
const CONSENSUS_PROMPT_TEMPLATE = `You are a meticulous AI Analyst and Synthesizer. Your task is to analyze, compare, and synthesize information from [NUMBER] different AI model responses, which were all responses to the exact same initial prompt. Your goal is to identify areas of consensus and present a unified understanding.

You will analyze these responses to:
1. Identify key themes and categories addressed across all responses
2. Compare what each model said (or didn't say) about each theme
3. Determine consensus through majority agreement or sole substantive information
4. Synthesize the most reasonable and evidence-based conclusions

The original prompt that all models responded to:

## ORIGINAL_PROMPT_START
%%USER_PROMPT%%
## ORIGINAL_PROMPT_END

The following [NUMBER] model responses were generated in response to that prompt:

__MODEL_OUTPUT_BLOCK_GOES_HERE__

To analyze consensus, you'll use two classification systems:

**Consensus Type** (for the comparison table) - Describes the voting pattern:
- Unanimous: All outputs that address the theme agree
- Majority: More outputs agree than disagree (don't count "not addressed")
- Split: Equal numbers agree and disagree
- Single voice: Only one output addresses this theme
- No consensus: Outputs have incompatible positions

**Agreement Level** (for the consensus summary) - Describes the strength of consensus:
- Unanimous: All models agree
- Strong: Most models agree, few or no disagreements
- Moderate: More agree than disagree
- Weak: Barely more agreement than disagreement
- Single: Only one model addressed this

Note: "Not addressed" means a model didn't mention this theme at all. This is different from disagreement - only count actual positions when determining consensus.

Important guidelines:
- Be objective and base your analysis strictly on the provided text
- List supporting models by their code names (Model A, Model B, etc.) without counting
- Identify ALL significant themes across responses, not just the ones in examples
- Use clear, descriptive names for themes based on their actual content
- Do not introduce information not present in the responses
- Focus on creating a comprehensive, evidence-based synthesis

**CRITICAL FORMATTING INSTRUCTIONS:**
You MUST produce your response using EXACTLY the section markers shown below. Include ALL sections in the exact order shown. Use the exact section markers (## SECTION_NAME_START and ## SECTION_NAME_END) with no modifications. Do not add any text outside of these sections.

Your response must contain these exact sections in this exact order:

## COMPARISON_TABLE_START
| Theme/Category | Model A | Model B | Model C | Model D | Model E | Consensus Type |
|----------------|---------|---------|---------|---------|---------|----------------|
## COMPARISON_TABLE_END

## CONSENSUS_SUMMARY_START
| Theme/Category | Consensus Statement | Agreement Level | Supporting Models |
|----------------|-------------------|-----------------|------------------|
## CONSENSUS_SUMMARY_END

## VOTING_SUMMARY_START
**Theme: Theme 1**
- ✅ **Agreed:** Model A, Model B, Model C
- ❌ **Disagreed:** Model D
- ⚪ **Not addressed:** Model E
- 📊 **Type:** Majority consensus

**Theme: Theme 2**
- ✅ **Agreed:** Model A, Model B, Model C, Model D, Model E
- ❌ **Disagreed:** None
- ⚪ **Not addressed:** None
- 📊 **Type:** Unanimous consensus

**Theme: Theme 3**
- ✅ **Agreed:** Model A, Model C
- ❌ **Disagreed:** Model B, Model D
- ⚪ **Not addressed:** Model E
- 📊 **Type:** Split decision

**Theme: Theme 4**
- ✅ **Agreed:** Model B
- ❌ **Disagreed:** None
- ⚪ **Not addressed:** Model A, Model C, Model D, Model E
- 📊 **Type:** Single voice
## VOTING_SUMMARY_END

## DISAGREEMENTS_START
### **Theme: Theme 1**
- **Model A position:** [stance]
- **Model D position:** [different stance]
- **🔍 Significance:** This disagreement matters because [reason]

### **Theme: Theme 3**
- **Model A position:** [stance]
- **Model B position:** [different stance]
- **🔍 Significance:** This disagreement matters because [reason]
## DISAGREEMENTS_END

## SYNTHESIS_START
[Based on the original prompt and the consensus established above, write a comprehensive response that directly answers the original question. Use the consensus positions for each theme. Match the average tone and style of the original outputs.]
## SYNTHESIS_END

Remember: Use ONLY these section markers. Include ALL sections. Add NO text outside the sections.`;

// Global state
let apiKeyStatus = 'checking';
let individualResponses = [];
let consensusPromptText = '';
let isSubmitting = false;
let currentJsonData = null;
let currentJsonPrompt = '';
let currentConsensusText = ''; // Store consensus text for retry
let modelNameMapping = {};
let modelCodeMapping = {}; // Maps "Model A" -> actual model name
let jsonConversionPromptTemplate = ''; // Template for JSON conversion prompt

// Loading message arrays
const INDIVIDUAL_LOADING_MESSAGES = [
    "Querying the Shoggoths...",
    "Awakening the Digital Oracles...",
    "Summoning AI Wisdom...",
    "Consulting the Silicon Sages...",
    "Polling the Neural Networks...",
    "Gathering Digital Opinions...",
    "Waking the Model Collective...",
    "Channeling AI Consciousness...",
    "Invoking Machine Intelligence..."
];

const CONSENSUS_LOADING_MESSAGES = [
    "Engaging in AI Democracy...",
    "Assembling the Truth Tables...",
    "Polling the Robot Council...",
    "Synthesizing Digital Wisdom...",
    "Mediating AI Disagreements...",
    "Forging Computational Consensus...",
    "Harmonizing Neural Opinions...",
    "Building Algorithmic Agreement...",
    "Orchestrating Digital Debate..."
];

const JSON_LOADING_MESSAGES = [
    "Structuring the Data Matrix...",
    "Parsing Digital DNA...",
    "Compiling Insight Algorithms...",
    "Crystallizing Information...",
    "Weaving Data Tapestries...",
    "Architecting Knowledge...",
    "Encoding Wisdom Patterns...",
    "Organizing Thought Structures...",
    "Blueprinting Intelligence..."
];

// Loading animation state
let loadingInterval = null;
let currentMessageIndex = 0;

// Hardcoded model letter assignments
const MODEL_LETTER_ASSIGNMENTS = {
    'anthropic/claude-sonnet-4': 'A',
    'openai/o4-mini-high': 'B',
    'openai/gpt-4.1': 'C',
    'deepseek/deepseek-r1-0528': 'D',
    'anthropic/claude-opus-4': 'E',
    'openai/chatgpt-4o-latest': 'F',
    'google/gemini-2.5-flash-preview:thinking': 'G',
    'google/gemini-2.5-pro-preview': 'H',
    'qwen/qwen3-30b-a3b:free': 'I',
    'x-ai/grok-3-beta': 'J'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM Content Loaded, initializing app ===');
    initializeApp();
});

function initializeApp() {
    // Check API key status
    checkApiKey();
    
    // Populate model grid
    populateModelGrid();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load JSON conversion prompt template
    loadJsonConversionPrompt();
}

function checkApiKey() {
    if (OPENROUTER_API_KEY) {
        apiKeyStatus = 'valid';
        updateApiKeyStatus('valid');
    } else {
        apiKeyStatus = 'missing';
        updateApiKeyStatus('missing');
    }
}

function updateApiKeyStatus(status) {
    const statusElement = document.getElementById('apiKeyStatus');
    let html = '';
    
    switch (status) {
        case 'valid':
            html = '<div class="api-status-badge valid">✓ API Key Valid</div>';
            break;
        case 'missing':
            html = '<div class="api-status-badge missing">✗ API Key Missing</div>';
            break;
        case 'error':
            html = '<div class="api-status-badge error">✗ API Key Error</div>';
            break;
        case 'checking':
            html = '<div class="api-status-badge checking">Checking API Key...</div>';
            break;
    }
    
    statusElement.innerHTML = html;
}

async function loadJsonConversionPrompt() {
    try {
        const response = await fetch('json-conversion-prompt.txt');
        if (response.ok) {
            jsonConversionPromptTemplate = await response.text();
            console.log('JSON conversion prompt template loaded successfully');
        } else {
            console.error('Failed to load JSON conversion prompt template:', response.status);
            // Fallback to hardcoded prompt if file loading fails
            jsonConversionPromptTemplate = `Convert the following consensus analysis into a clean, structured JSON format. Extract and organize the key information into intuitive categories.

IMPORTANT: The consensus analysis uses anonymous model codes (Model A, Model B, etc.). Here is the mapping to actual model names:
{{MODEL_CODE_MAPPING}}

When creating the JSON output, replace the anonymous model codes with the actual model names using the mapping above.

Please structure the data as follows:
{
    "summary": {
        "totalThemes": number,
        "consensusStrength": "strong|moderate|weak",
        "mainConclusion": "brief summary",
        "consensusScore": number (0-100 representing overall consensus strength),
        "controversyCount": number (themes with split or no consensus),
        "participationRate": number (successful responses / total selected)
    },
    "themes": [
        {
            "name": "theme name",
            "consensusType": "unanimous|majority|split|single|none",
            "agreementLevel": "unanimous|strong|moderate|weak|single",
            "statement": "consensus statement",
            "supportingOutputs": ["Output 1", "Output 2", ...],
            "disagreements": [
                {
                    "output": "Output X",
                    "position": "position description",
                    "significance": "why this matters"
                }
            ],
            "importanceScore": number (1-10 based on how central this theme is)
        }
    ],
    "keyInsights": [
        "insight 1",
        "insight 2",
        "insight 3"
    ],
    "confidenceMetrics": {
        "unanimousThemes": number,
        "majorityThemes": number,
        "splitThemes": number,
        "singleVoiceThemes": number
    },
    "modelBehavior": {
        "mostAgreeable": ["Actual Model Name 1", "Actual Model Name 2"],
        "mostDivergent": ["Actual Model Name 3"],
        "coverageByModel": {"Actual Model Name 1": percentage, "Actual Model Name 2": percentage}
    }
}

Consensus analysis to convert:
{{CONSENSUS_TEXT}}

Return ONLY the JSON object, no other text.`;
        }
    } catch (error) {
        console.error('Error loading JSON conversion prompt template:', error);
        // Use fallback prompt
        jsonConversionPromptTemplate = `Convert the following consensus analysis into a clean, structured JSON format. Extract and organize the key information into intuitive categories.

IMPORTANT: The consensus analysis uses anonymous model codes (Model A, Model B, etc.). Here is the mapping to actual model names:
{{MODEL_CODE_MAPPING}}

When creating the JSON output, replace the anonymous model codes with the actual model names using the mapping above.

Please structure the data as follows:
{
    "summary": {
        "totalThemes": number,
        "consensusStrength": "strong|moderate|weak",
        "mainConclusion": "brief summary",
        "consensusScore": number (0-100 representing overall consensus strength),
        "controversyCount": number (themes with split or no consensus),
        "participationRate": number (successful responses / total selected)
    },
    "themes": [
        {
            "name": "theme name",
            "consensusType": "unanimous|majority|split|single|none",
            "agreementLevel": "unanimous|strong|moderate|weak|single",
            "statement": "consensus statement",
            "supportingOutputs": ["Output 1", "Output 2", ...],
            "disagreements": [
                {
                    "output": "Output X",
                    "position": "position description",
                    "significance": "why this matters"
                }
            ],
            "importanceScore": number (1-10 based on how central this theme is)
        }
    ],
    "keyInsights": [
        "insight 1",
        "insight 2",
        "insight 3"
    ],
    "confidenceMetrics": {
        "unanimousThemes": number,
        "majorityThemes": number,
        "splitThemes": number,
        "singleVoiceThemes": number
    },
    "modelBehavior": {
        "mostAgreeable": ["Actual Model Name 1", "Actual Model Name 2"],
        "mostDivergent": ["Actual Model Name 3"],
        "coverageByModel": {"Actual Model Name 1": percentage, "Actual Model Name 2": percentage}
    }
}

Consensus analysis to convert:
{{CONSENSUS_TEXT}}

Return ONLY the JSON object, no other text.`;
    }
}

function populateModelGrid() {
    const modelGrid = document.getElementById('modelGrid');
    
    // Default selected models
    const defaultSelectedIds = [
        'google/gemini-2.5-pro-preview',             // Gemini Pro 2.5
        'anthropic/claude-opus-4',                   // Claude Opus 4
        'openai/o4-mini-high',                       // O4 Mini High
        'deepseek/deepseek-r1-0528',                // DeepSeek R1
        'x-ai/grok-3-beta',                          // Grok 3 Beta
        'openai/gpt-4.1'                             // GPT-4.1
    ];
    
    let isExpanded = false;
    
    AVAILABLE_LLMS.forEach((model, index) => {
        const label = document.createElement('label');
        label.className = 'model-label neu-outset-sm';
        const isDefaultSelected = defaultSelectedIds.includes(model.id);
        const isDefaultModel = defaultSelectedIds.includes(model.id);
        
        // Hide non-default models initially
        if (!isDefaultModel) {
            label.classList.add('hidden-model');
            label.style.display = 'none';
        }
        
        label.innerHTML = `
            <input type="checkbox" value="${model.id}" class="neu-checkbox model-checkbox" ${isDefaultSelected ? 'checked' : ''}>
            <span>${model.name}</span>
        `;
        
        const checkbox = label.querySelector('input');
        
        // Add active class if default selected
        if (isDefaultSelected) {
            label.classList.add('active');
        }
        
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                label.classList.add('active');
            } else {
                label.classList.remove('active');
            }
            updateModelError();
        });
        
        modelGrid.appendChild(label);
    });
    
    // Function to expand/collapse model view
    function toggleModelExpansion(expand) {
        isExpanded = expand;
        const hiddenModels = modelGrid.querySelectorAll('.hidden-model');
        const expandBtn = document.getElementById('expandModelsBtn');
        const collapseBtn = document.getElementById('collapseModelsBtn');
        const expandedOptions = document.getElementById('expandedOptions');
        
        if (isExpanded) {
            hiddenModels.forEach(model => model.style.display = 'flex');
            expandedOptions.style.display = 'block';
            expandBtn.style.display = 'none';
            collapseBtn.style.display = 'block';
            modelGrid.classList.remove('compact');
        } else {
            hiddenModels.forEach(model => model.style.display = 'none');
            expandedOptions.style.display = 'none';
            expandBtn.style.display = 'block';
            collapseBtn.style.display = 'none';
            modelGrid.classList.add('compact');
        }
    }
    
    // Setup expand/collapse buttons
    const expandBtn = document.getElementById('expandModelsBtn');
    const collapseBtn = document.getElementById('collapseModelsBtn');
    
    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            toggleModelExpansion(true);
        });
    }
    
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            toggleModelExpansion(false);
        });
    }
    
    // Make the function available globally for select all
    window.toggleModelExpansion = toggleModelExpansion;
}

function setupEventListeners() {
    // Form submission
    const form = document.getElementById('userForm');
    form.addEventListener('submit', handleFormSubmit);
    
    // Select all checkbox
    const selectAll = document.getElementById('selectAll');
    selectAll.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.model-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
            const label = checkbox.closest('.model-label');
            if (e.target.checked) {
                label.classList.add('active');
                // Expand hidden models when selecting all
                if (window.toggleModelExpansion) {
                    window.toggleModelExpansion(true);
                }
            } else {
                label.classList.remove('active');
            }
        });
        updateModelError();
    });
    
    // User prompt copy button
    const userPromptCopyButton = document.querySelector('.user-prompt-copy');
    if (userPromptCopyButton) {
        userPromptCopyButton.addEventListener('click', function() {
            const promptText = document.getElementById('userPrompt').value;
            copyText(promptText);
        });
    }
    
    // Responses toggle button
    const responsesToggleBtn = document.getElementById('responsesToggleBtn');
    if (responsesToggleBtn) {
        responsesToggleBtn.addEventListener('click', function() {
            toggleResponsesSection();
        });
    }
    
    // Consensus toggle button
    const consensusToggleBtn = document.getElementById('consensusToggleBtn');
    if (consensusToggleBtn) {
        consensusToggleBtn.addEventListener('click', function() {
            toggleConsensusSection();
        });
    }
    
    // Analytics toggle button
    const analyticsToggleBtn = document.getElementById('analyticsToggleBtn');
    if (analyticsToggleBtn) {
        analyticsToggleBtn.addEventListener('click', function() {
            toggleAnalyticsSection();
        });
    }
    
}

function updateModelError() {
    const selectedModels = getSelectedModels();
    const errorElement = document.getElementById('modelError');
    if (selectedModels.length === 0) {
        errorElement.style.display = 'block';
    } else {
        errorElement.style.display = 'none';
    }
}

function getSelectedModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting || apiKeyStatus !== 'valid') return;
    
    const prompt = document.getElementById('userPrompt').value.trim();
    const selectedModelIds = getSelectedModels();
    
    if (!prompt || selectedModelIds.length === 0) {
        updateModelError();
        return;
    }
    
    isSubmitting = true;
    updateSubmitButton(true);
    clearPreviousResults();
    showResponseContainer();
    
    try {
        await processPrompt(prompt, selectedModelIds);
    } catch (error) {
        console.error('Error processing prompt:', error);
        showError('Application Error: ' + error.message);
    } finally {
        isSubmitting = false;
        updateSubmitButton(false);
    }
}

function updateSubmitButton(loading) {
    const button = document.getElementById('submitButton');
    const text = document.getElementById('submitText');
    
    if (loading) {
        text.textContent = 'Synthesize Consensus';
        button.classList.add('clicked');
        button.disabled = true;
        
        // Remove the pulse animation class after animation completes
        setTimeout(() => {
            button.classList.remove('clicked');
        }, 300);
    } else {
        text.textContent = 'Synthesize Consensus';
        button.disabled = false;
    }
}

// Loading animation functions
function startLoadingAnimation(textElement, messages) {
    // Validate inputs
    if (!textElement) {
        console.error('startLoadingAnimation: textElement is null or undefined');
        return;
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.error('startLoadingAnimation: messages array is invalid');
        return;
    }
    
    console.log('Starting loading animation for element:', textElement.id || 'unknown');
    
    stopLoadingAnimation(); // Clear any existing animation
    currentMessageIndex = 0;
    
    // Ensure the element is visible and ready
    if (textElement.style.display === 'none') {
        textElement.style.display = '';
    }
    
    // Set initial message immediately
    textElement.textContent = messages[0];
    textElement.classList.add('loading-text');
    
    // Force a reflow to ensure the initial text is set
    textElement.offsetHeight;
    
    // Start rotation with a slight delay to ensure initial display
    setTimeout(() => {
        loadingInterval = setInterval(() => {
            if (!textElement.parentNode) {
                // Element was removed from DOM, stop animation
                console.log('Loading animation element removed from DOM, stopping');
                stopLoadingAnimation();
                return;
            }
            
            textElement.classList.add('fade-out');
            
            setTimeout(() => {
                currentMessageIndex = (currentMessageIndex + 1) % messages.length;
                textElement.textContent = messages[currentMessageIndex];
                textElement.classList.remove('fade-out');
                textElement.classList.add('fade-in');
                
                setTimeout(() => {
                    textElement.classList.remove('fade-in');
                }, 300);
            }, 300);
        }, 2500);
    }, 100); // 100ms delay to ensure proper initialization
}

function stopLoadingAnimation() {
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
    
    // Clean up animation classes
    const textElements = document.querySelectorAll('.loading-text');
    textElements.forEach(el => {
        el.classList.remove('loading-text', 'fade-out', 'fade-in');
    });
}

// Individual card loading animations
const individualLoadingIntervals = new Map();

function startIndividualLoadingAnimation(textElement, cardIndex) {
    // Validate inputs
    if (!textElement) {
        console.error('startIndividualLoadingAnimation: textElement is null or undefined');
        return;
    }
    
    console.log('Starting individual loading animation for card:', cardIndex);
    
    // Stop any existing animation for this card
    stopIndividualLoadingAnimation(cardIndex);
    
    let messageIndex = 0;
    
    // Set initial message immediately
    textElement.textContent = INDIVIDUAL_LOADING_MESSAGES[0];
    textElement.classList.add('loading-text');
    
    // Force a reflow to ensure the initial text is set
    textElement.offsetHeight;
    
    // Start rotation with a slight delay to ensure initial display
    setTimeout(() => {
        const interval = setInterval(() => {
            if (!textElement.parentNode) {
                // Element was removed from DOM, stop animation
                console.log('Individual loading animation element removed from DOM, stopping');
                stopIndividualLoadingAnimation(cardIndex);
                return;
            }
            
            textElement.classList.add('fade-out');
            
            setTimeout(() => {
                messageIndex = (messageIndex + 1) % INDIVIDUAL_LOADING_MESSAGES.length;
                textElement.textContent = INDIVIDUAL_LOADING_MESSAGES[messageIndex];
                textElement.classList.remove('fade-out');
                textElement.classList.add('fade-in');
                
                setTimeout(() => {
                    textElement.classList.remove('fade-in');
                }, 300);
            }, 300);
        }, 2500);
        
        // Store the interval for this specific card
        individualLoadingIntervals.set(cardIndex, interval);
    }, 100); // 100ms delay to ensure proper initialization
}

function stopIndividualLoadingAnimation(cardIndex) {
    const interval = individualLoadingIntervals.get(cardIndex);
    if (interval) {
        clearInterval(interval);
        individualLoadingIntervals.delete(cardIndex);
        console.log('Stopped individual loading animation for card:', cardIndex);
    }
    
    // Clean up animation classes for this specific card
    const textElement = document.querySelector(`#loading-text-${cardIndex}`);
    if (textElement) {
        textElement.classList.remove('loading-text', 'fade-out', 'fade-in');
    }
}

function stopAllIndividualLoadingAnimations() {
    individualLoadingIntervals.forEach((interval, cardIndex) => {
        clearInterval(interval);
        console.log('Stopped individual loading animation for card:', cardIndex);
    });
    individualLoadingIntervals.clear();
    
    // Clean up animation classes for all individual loading text elements
    const textElements = document.querySelectorAll('[id^="loading-text-"]');
    textElements.forEach(el => {
        el.classList.remove('loading-text', 'fade-out', 'fade-in');
    });
}

function clearPreviousResults() {
    // Stop all individual loading animations
    stopAllIndividualLoadingAnimations();
    
    individualResponses = [];
    consensusPromptText = '';
    currentJsonPrompt = '';
    currentConsensusText = '';
    currentJsonData = null;
    
    // Reset responses section to expanded state
    const responsesContainer = document.getElementById('responsesContainer');
    const responsesToggleBtn = document.getElementById('responsesToggleBtn');
    if (responsesContainer && responsesToggleBtn) {
        responsesContainer.classList.remove('collapsed');
        responsesToggleBtn.style.display = 'none';
    }
    
    // Reset consensus tabs
    const consensusTabs = document.getElementById('consensusTabs');
    if (consensusTabs) {
        consensusTabs.style.display = 'none';
        // Reset to first tab
        const tabs = consensusTabs.querySelectorAll('.consensus-tab');
        const panes = document.querySelectorAll('.consensus-tab-pane');
        tabs.forEach((tab, index) => {
            if (index === 0) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        panes.forEach((pane, index) => {
            if (index === 0) {
                pane.classList.add('active');
                pane.style.display = 'block';
            } else {
                pane.classList.remove('active');
                pane.style.display = 'none';
            }
        });
    }
    
    document.getElementById('individualResponsesGrid').innerHTML = '';
    document.getElementById('consensusOutput').innerHTML = '';
    document.getElementById('consensusError').style.display = 'none';
    document.getElementById('groundingSources').style.display = 'none';
    
    // Clear consensus tab contents
    document.getElementById('rawConsensusOutput').value = '';
    document.getElementById('consensusPromptContent').textContent = '';
    
    document.getElementById('jsonVisualizationSection').style.display = 'none';
    document.getElementById('jsonVisualization').innerHTML = '';
    document.getElementById('jsonError').style.display = 'none';
    document.getElementById('analyticsContent').style.display = 'none';
    
    // Clear analytics content containers
    const controversyContent = document.getElementById('controversyContent');
    const agreementContent = document.getElementById('agreementContent');
    const behaviorContent = document.getElementById('behaviorContent');
    const flowContent = document.getElementById('flowContent');
    
    if (controversyContent) controversyContent.innerHTML = '';
    if (agreementContent) agreementContent.innerHTML = '';
    if (behaviorContent) behaviorContent.innerHTML = '';
    if (flowContent) flowContent.innerHTML = '';
    
    // Clear raw data content containers
    const jsonOutputContent = document.getElementById('jsonOutputContent');
    const rawPromptContent = document.getElementById('rawPromptContent');
    
    if (jsonOutputContent) jsonOutputContent.innerHTML = '';
    if (rawPromptContent) rawPromptContent.innerHTML = '';
}

// Consensus tabs functionality
function setupConsensusTabs() {
    const tabs = document.querySelectorAll('.consensus-tab');
    const panes = document.querySelectorAll('.consensus-tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active pane
            panes.forEach(pane => {
                pane.classList.remove('active');
                pane.style.display = 'none';
            });
            
            const targetPane = document.getElementById(`${targetTab}Tab`);
            if (targetPane) {
                targetPane.classList.add('active');
                targetPane.style.display = 'block';
            }
        });
    });
}

function setupConsensusCopyButtons(consensusText) {
    // Raw output copy button
    const copyRawBtn = document.querySelector('.copy-raw-consensus-btn');
    if (copyRawBtn) {
        copyRawBtn.addEventListener('click', () => {
            copyText(consensusText);
        });
    }
    
    // Consensus prompt copy button
    const copyPromptBtn = document.querySelector('.copy-consensus-prompt-btn');
    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', () => {
            copyText(consensusPromptText);
        });
    }
}

// Responses section collapse/expand functions
function collapseResponsesSection() {
    const responsesContainer = document.getElementById('responsesContainer');
    const responsesToggleBtn = document.getElementById('responsesToggleBtn');
    
    if (responsesContainer && responsesToggleBtn) {
        responsesContainer.classList.add('collapsed');
        responsesToggleBtn.style.display = 'flex';
    }
}

function expandResponsesSection() {
    const responsesContainer = document.getElementById('responsesContainer');
    const responsesToggleBtn = document.getElementById('responsesToggleBtn');
    
    if (responsesContainer && responsesToggleBtn) {
        responsesContainer.classList.remove('collapsed');
        // Keep the toggle button visible so users can collapse again
        responsesToggleBtn.style.display = 'flex';
    }
}

function toggleResponsesSection() {
    const responsesContainer = document.getElementById('responsesContainer');
    
    if (responsesContainer) {
        if (responsesContainer.classList.contains('collapsed')) {
            expandResponsesSection();
        } else {
            collapseResponsesSection();
        }
    }
}

function toggleConsensusSection() {
    const consensusContainer = document.getElementById('consensusContainer');
    
    if (consensusContainer) {
        if (consensusContainer.classList.contains('collapsed')) {
            consensusContainer.classList.remove('collapsed');
        } else {
            consensusContainer.classList.add('collapsed');
        }
    }
}

function toggleAnalyticsSection() {
    const analyticsContainer = document.getElementById('analyticsContainer');
    
    if (analyticsContainer) {
        if (analyticsContainer.classList.contains('collapsed')) {
            analyticsContainer.classList.remove('collapsed');
        } else {
            analyticsContainer.classList.add('collapsed');
        }
    }
}

function showResponseContainer() {
    document.getElementById('responseContainer').style.display = 'block';
}

async function processPrompt(prompt, selectedModelIds) {
    // Show individual responses section
    document.getElementById('individualResponsesSection').style.display = 'block';
    
    // Initialize response data
    const selectedModels = selectedModelIds.map(id => 
        AVAILABLE_LLMS.find(m => m.id === id)
    ).filter(m => m);
    
    individualResponses = selectedModels.map(model => ({
        id: model.id,
        modelId: model.id,
        modelName: model.name,
        text: null,
        isLoading: true,
        error: null
    }));
    
    // Display initial loading states
    displayIndividualResponses();
    
    // Query all models
    const results = await queryOpenRouterModels(prompt, selectedModelIds);
    
    // Update responses with results
    results.forEach((result, index) => {
        const response = individualResponses[index];
        response.isLoading = false;
        
        // Stop the loading animation for this individual card
        stopIndividualLoadingAnimation(index);
        
        if (result.success) {
            response.text = result.response;
        } else {
            response.error = result.error;
        }
    });
    
    // Update display
    displayIndividualResponses();
    
    // Check if all responses are finished (no loading states)
    const allFinished = individualResponses.every(r => !r.isLoading);
    if (allFinished) {
        // Auto-collapse the responses section once all are done
        setTimeout(() => {
            collapseResponsesSection();
        }, 1000); // Brief delay to let user see completion
    }
    
    // Check if we have successful responses
    const successfulResponses = individualResponses.filter(r => r.text && !r.error);
    if (successfulResponses.length === 0) {
        showConsensusError('No successful responses from individual LLMs to form a consensus.');
        return;
    }
    
    // Generate consensus
    await generateConsensus(prompt, successfulResponses);
}

async function queryOpenRouterModels(prompt, modelIds) {
    const requests = modelIds.map(modelId => querySingleModel(prompt, modelId));
    const results = await Promise.allSettled(requests);
    
    return results.map(result => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return {
                success: false,
                error: result.reason?.message || 'Unknown error'
            };
        }
    });
}

async function querySingleModel(prompt, modelId) {
    const modelInfo = ALL_LLMS.find(m => m.id === modelId);
    
    let maxTokens;
    if (modelInfo?.maxOutputTokens) {
        maxTokens = modelInfo.maxOutputTokens;
    } else if (modelInfo?.maxContextTokens) {
        maxTokens = Math.min(Math.floor(modelInfo.maxContextTokens * 0.75), 128000);
    } else {
        maxTokens = 4096;
    }
    
    maxTokens = Math.max(maxTokens, 256);
    
    const requestBody = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: false
    };
    
    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'PolyLLM'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return {
                success: false,
                error: data.error?.message || `HTTP ${response.status}`
            };
        }
        
        if (!data.choices || data.choices.length === 0) {
            return {
                success: false,
                error: 'No choices returned from model.'
            };
        }
        
        return {
            success: true,
            response: data.choices[0].message.content
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Network error'
        };
    }
}

function displayIndividualResponses() {
    const grid = document.getElementById('individualResponsesGrid');
    grid.innerHTML = '';
    
    individualResponses.forEach((response, index) => {
        const card = document.createElement('div');
        card.className = 'response-card neu-outset';
        
        const content = response.isLoading 
            ? `<div class="loading-message compact">
                 <div class="spinner-dark"></div>
                 <span class="loading-text" id="loading-text-${index}">Generating...</span>
               </div>`
            : response.error 
            ? `<p class="error-message">Error: ${response.error}</p>`
            : `<pre class="response-text">${response.text}</pre>`;
        
        card.innerHTML = `
            <div class="response-card-header">
                <h3 class="response-card-title" title="${escapeHtml(response.modelName)}">${escapeHtml(response.modelName)}</h3>
                ${response.text ? `<button type="button" class="copy-button response-copy" data-response-text="${escapeHtml(response.text)}" title="Copy response">
                    <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                        <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                    </svg>
                    <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                        <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                    </svg>
                </button>` : ''}
            </div>
            <div class="response-card-content neu-inset">
                ${content}
            </div>
        `;
        
        // Add event listener for copy button
        if (response.text) {
            const copyButton = card.querySelector('.response-copy');
            copyButton.addEventListener('click', function() {
                copyText(response.text);
            });
        }
        
        // Start loading animation for this card if it's loading
        if (response.isLoading) {
            const loadingTextElement = card.querySelector(`#loading-text-${index}`);
            if (loadingTextElement) {
                startIndividualLoadingAnimation(loadingTextElement, index);
            }
        }
        
        grid.appendChild(card);
    });
}

async function generateConsensus(userPrompt, successfulResponses) {
    console.log('=== generateConsensus called ===');
    console.log('User prompt:', userPrompt);
    console.log('Number of successful responses:', successfulResponses.length);
    
    // Show consensus section
    document.getElementById('consensusSection').style.display = 'block';
    document.getElementById('consensusLoading').style.display = 'block';
    
    // Start consensus loading animation with better error handling
    const consensusLoadingText = document.getElementById('consensusLoadingText');
    if (consensusLoadingText) {
        console.log('Starting consensus loading animation');
        startLoadingAnimation(consensusLoadingText, CONSENSUS_LOADING_MESSAGES);
    } else {
        console.error('consensusLoadingText element not found');
    }
    
    // Get selected consensus model from dropdown
    const selectedConsensusModelId = document.getElementById('consensusModelSelect')?.value;
    let consensusModel = ALL_LLMS.find(m => m.id === selectedConsensusModelId);
    
    if (!consensusModel) {
        // Fallback to default
        consensusModel = ALL_LLMS.find(m => m.isConsensusModel);
        if (!consensusModel) {
            consensusModel = AVAILABLE_LLMS[0];
        }
    }
    
    console.log('Using consensus model:', consensusModel.name, consensusModel.id);
    
    // Sort successful responses by their letter assignments for consistent order
    const sortedSuccessfulResponses = successfulResponses
        .filter(response => MODEL_LETTER_ASSIGNMENTS[response.modelId]) // Only include models with letter assignments
        .sort((a, b) => {
            const letterA = MODEL_LETTER_ASSIGNMENTS[a.modelId];
            const letterB = MODEL_LETTER_ASSIGNMENTS[b.modelId];
            return letterA.localeCompare(letterB);
        });
    
    // Create model code mapping using hardcoded assignments
    modelCodeMapping = {};
    console.log('=== DEBUG: sortedSuccessfulResponses ===');
    sortedSuccessfulResponses.forEach((response, index) => {
        console.log(`Response ${index}:`, {
            modelId: response.modelId,
            modelName: response.modelName,
            id: response.id
        });
        
        const letter = MODEL_LETTER_ASSIGNMENTS[response.modelId];
        console.log(`Looking up letter for ${response.modelId}: ${letter}`);
        
        if (letter) {
            const modelCode = `Model ${letter}`;
            modelCodeMapping[modelCode] = response.modelName;
            console.log(`Assigned ${modelCode} to ${response.modelName}`);
        } else {
            console.warn(`No letter assignment found for model: ${response.modelId}`);
        }
    });
    
    console.log('Final model code mapping:', modelCodeMapping);
    
    // Build consensus prompt
    let consensusPrompt = CONSENSUS_PROMPT_TEMPLATE;
    consensusPrompt = consensusPrompt.replace(/\[NUMBER\]/g, String(sortedSuccessfulResponses.length));
    consensusPrompt = consensusPrompt.replace(/%%USER_PROMPT%%/g, userPrompt);
    
    const MAX_CHARS_PER_MODEL_OUTPUT = 256000;
    const MAX_TOTAL_CHARS_FOR_ALL_OUTPUTS = 2000000;
    
    let totalCharsCollected = 0;
    const individualOutputsString = sortedSuccessfulResponses.map((r) => {
        let textToInclude = r.text || "(No text provided)";
        
        if (totalCharsCollected + textToInclude.length > MAX_TOTAL_CHARS_FOR_ALL_OUTPUTS) {
            const remainingCharsAllowed = Math.max(0, MAX_TOTAL_CHARS_FOR_ALL_OUTPUTS - totalCharsCollected);
            if (remainingCharsAllowed < textToInclude.length) {
                textToInclude = textToInclude.substring(0, remainingCharsAllowed) + "... (overall output truncated)";
            }
        }
        
        if (textToInclude.length > MAX_CHARS_PER_MODEL_OUTPUT) {
            textToInclude = textToInclude.substring(0, MAX_CHARS_PER_MODEL_OUTPUT) + "... (truncated)";
        }
        
        totalCharsCollected += textToInclude.length;
        
        // Use hardcoded model letter assignment
        const letter = MODEL_LETTER_ASSIGNMENTS[r.modelId];
        if (!letter) {
            console.error(`No letter assignment found for model: ${r.modelId}`);
            return '';
        }
        const modelCode = `Model ${letter}`;
        console.log(`Creating output block: ${modelCode.toUpperCase()}_START for ${r.modelName} (${r.modelId})`);
        
        return `## ${modelCode.toUpperCase()}_START\n${textToInclude}\n## ${modelCode.toUpperCase()}_END`;
    }).filter(output => output !== '').join("\n\n");
    
    const finalConsensusPrompt = consensusPrompt.replace(/__MODEL_OUTPUT_BLOCK_GOES_HERE__/g, individualOutputsString);
    consensusPromptText = finalConsensusPrompt;
    
    console.log('Consensus prompt generated, length:', finalConsensusPrompt.length);
    console.log('First 500 chars of prompt:', finalConsensusPrompt.substring(0, 500));
    
    try {
        const result = await querySingleModel(finalConsensusPrompt, consensusModel.id);
        
        document.getElementById('consensusLoading').style.display = 'none';
        stopLoadingAnimation(); // Stop consensus loading animation
        
        if (result.success) {
            displayConsensusOutput(result.response);
        } else {
            showConsensusError('Consensus generation failed: ' + result.error);
        }
    } catch (error) {
        document.getElementById('consensusLoading').style.display = 'none';
        stopLoadingAnimation(); // Stop consensus loading animation
        showConsensusError('Consensus generation failed: ' + error.message);
    }
}

function formatConsensusPromptDisplay(promptText, responses) {
    // Simple, clean display of the consensus prompt
    return `
        <div style="max-height: 600px; overflow-y: auto; padding: 0.5rem;">
            <pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: 'Monaco', 'Consolas', monospace; font-size: 0.75rem; line-height: 1.5; color: var(--neu-text-secondary);">${escapeHtml(promptText)}</pre>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function displayConsensusOutput(consensusText) {
    // Show the tabs
    document.getElementById('consensusTabs').style.display = 'flex';
    
    // Populate organized data tab
    const outputElement = document.getElementById('consensusOutput');
    outputElement.innerHTML = processConsensusOutput(consensusText);
    
    // Populate raw output tab
    const rawTextarea = document.getElementById('rawConsensusOutput');
    rawTextarea.value = consensusText;
    
    // Populate consensus prompt tab
    const promptContent = document.getElementById('consensusPromptContent');
    promptContent.textContent = consensusPromptText;
    
    // Setup tab switching
    setupConsensusTabs();
    
    // Setup copy buttons
    setupConsensusCopyButtons(consensusText);
    
    // Add event listeners for consensus copy buttons in organized view
    const copyButtons = outputElement.querySelectorAll('.consensus-copy-full');
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            copyText(consensusText);
        });
    });
    
    // Add event listener for blended output copy button
    const blendedCopyButton = outputElement.querySelector('.blended-output-copy');
    if (blendedCopyButton) {
        blendedCopyButton.addEventListener('click', function() {
            // Extract just the synthesis section text for copying
            const blendedContent = outputElement.querySelector('.blended-content');
            if (blendedContent) {
                copyText(blendedContent.textContent || blendedContent.innerText);
            }
        });
    }
    
    // Generate JSON visualization
    generateJsonVisualization(consensusText);
}

function processConsensusOutput(markdownText) {
    if (!markdownText) return '';
    
    // Extract sections using regex
    const sections = {
        comparisonTable: null,
        consensusSummary: null,
        votingSummary: null,
        disagreements: null,
        synthesis: null
    };
    
    // Extract comparison table
    const comparisonMatch = markdownText.match(/## COMPARISON_TABLE_START\s*([\s\S]*?)\s*## COMPARISON_TABLE_END/);
    if (comparisonMatch) {
        sections.comparisonTable = comparisonMatch[1].trim();
    }
    
    // Extract consensus summary
    const consensusMatch = markdownText.match(/## CONSENSUS_SUMMARY_START\s*([\s\S]*?)\s*## CONSENSUS_SUMMARY_END/);
    if (consensusMatch) {
        sections.consensusSummary = consensusMatch[1].trim();
    }
    
    // Extract voting summary
    const votingMatch = markdownText.match(/## VOTING_SUMMARY_START\s*([\s\S]*?)\s*## VOTING_SUMMARY_END/);
    if (votingMatch) {
        sections.votingSummary = votingMatch[1].trim();
    }
    
    // Extract disagreements
    const disagreementsMatch = markdownText.match(/## DISAGREEMENTS_START\s*([\s\S]*?)\s*## DISAGREEMENTS_END/);
    if (disagreementsMatch) {
        sections.disagreements = disagreementsMatch[1].trim();
    }
    
    // Extract synthesis
    const synthesisMatch = markdownText.match(/## SYNTHESIS_START\s*([\s\S]*?)\s*## SYNTHESIS_END/);
    if (synthesisMatch) {
        sections.synthesis = synthesisMatch[1].trim();
    }
    
    // Build formatted HTML
    let html = '<div class="consensus-output-container">';
    
    // Add synthesis first as the main output
    if (sections.synthesis) {
        html += `
            <div class="consensus-section">
                <div class="blended-output-header">
                    <h3 class="blended-output-title">🔀 Blended Output</h3>
                    <button type="button" class="copy-button blended-output-copy" title="Copy blended output">
                        <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                            <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                        </svg>
                        <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                        </svg>
                    </button>
                </div>
                <div class="neu-inset" style="padding: 1.5rem; border-radius: 12px; background-color: var(--neu-bg-darker); margin-bottom: 1.5rem;">
                    <div class="markdown-render-area blended-content" style="font-size: 0.95rem; line-height: 1.7;">
                        ${marked.parse(sections.synthesis)}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add comparison table in collapsible section
    if (sections.comparisonTable) {
        html += `
            <details class="neu-details consensus-details" style="margin-bottom: 1rem;">
                <summary style="padding: 1rem 1.5rem; font-weight: 600; color: var(--neu-text-secondary);">
                    <span>📊 Detailed Theme Comparison</span>
                </summary>
                <div class="details-content" style="padding: 1.5rem;">
                    <div class="markdown-render-area table-container" style="overflow-x: auto;">
                        ${marked.parse(sections.comparisonTable)}
                    </div>
                </div>
            </details>
        `;
    }
    
    // Add consensus summary in collapsible section
    if (sections.consensusSummary) {
        html += `
            <details class="neu-details consensus-details" style="margin-bottom: 1rem;">
                <summary style="padding: 1rem 1.5rem; font-weight: 600; color: var(--neu-text-secondary);">
                    <span>📋 Consensus Summary Table</span>
                </summary>
                <div class="details-content" style="padding: 1.5rem;">
                    <div class="markdown-render-area table-container" style="overflow-x: auto;">
                        ${marked.parse(sections.consensusSummary)}
                    </div>
                </div>
            </details>
        `;
    }
    
    // Add voting summary in collapsible section
    if (sections.votingSummary) {
        html += `
            <details class="neu-details consensus-details" style="margin-bottom: 1rem;">
                <summary style="padding: 1rem 1.5rem; font-weight: 600; color: var(--neu-text-secondary);">
                    <span>🗳️ Voting Analysis</span>
                </summary>
                <div class="details-content" style="padding: 1.5rem;">
                    <div class="markdown-render-area" style="font-size: 0.875rem;">
                        ${marked.parse(sections.votingSummary)}
                    </div>
                </div>
            </details>
        `;
    }
    
    // Add disagreements if any exist
    if (sections.disagreements && sections.disagreements.toLowerCase() !== 'none' && sections.disagreements.length > 10) {
        html += `
            <details class="neu-details consensus-details" style="margin-bottom: 1rem;">
                <summary style="padding: 1rem 1.5rem; font-weight: 600; color: var(--neu-error);">
                    <span>⚠️ Key Disagreements</span>
                </summary>
                <div class="details-content" style="padding: 1.5rem;">
                    <div class="markdown-render-area" style="font-size: 0.875rem;">
                        ${marked.parse(sections.disagreements)}
                    </div>
                </div>
            </details>
        `;
    }
    
    // Add copy button for the entire output
    html += `
        <div style="margin-top: 1.5rem; text-align: right;">
            <button type="button" class="copy-button neu-button consensus-copy-full" title="Copy full consensus output" style="padding: 0.5rem 1rem;">
                <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 0.5rem;">
                    <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                    <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                </svg>
                <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none; margin-right: 0.5rem;">
                    <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                </svg>
                Copy Full Output
            </button>
        </div>
    `;
    
    html += '</div>';
    
    // If no sections were parsed, fall back to simple display
    if (!sections.synthesis && !sections.comparisonTable && !sections.consensusSummary) {
        return `
            <div class="markdown-render-area" style="margin-top: 1rem; padding: 1rem;" class="neu-inset">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--neu-text-primary);">Consensus Output</h3>
                    <button type="button" class="copy-button consensus-copy-full" title="Copy consensus output">
                        <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                            <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                        </svg>
                        <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                        </svg>
                    </button>
                </div>
                <div>${marked.parse(markdownText)}</div>
            </div>
        `;
    }
    
    return html;
}

function showConsensusError(message) {
    const errorElement = document.getElementById('consensusError');
    errorElement.textContent = 'Consensus Error: ' + message;
    errorElement.style.display = 'block';
    document.getElementById('consensusLoading').style.display = 'none';
}

function showError(message) {
    // For now, show in console. Could add a global error display element
    console.error(message);
}

// Copy text functionality
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Find the button that was clicked
        const button = event.currentTarget;
        button.classList.add('copied');
        
        // Show checkmark icon
        const defaultIcon = button.querySelector('.copy-icon-default');
        const copiedIcon = button.querySelector('.copy-icon-copied');
        if (defaultIcon && copiedIcon) {
            defaultIcon.style.display = 'none';
            copiedIcon.style.display = 'block';
        }
        
        // Reset after 2 seconds
        setTimeout(() => {
            button.classList.remove('copied');
            if (defaultIcon && copiedIcon) {
                defaultIcon.style.display = 'block';
                copiedIcon.style.display = 'none';
            }
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text:', err);
    });
}

// JSON Visualization Functions
async function generateJsonVisualization(consensusText) {
    console.log('=== generateJsonVisualization called ===');
    
    // Store consensus text for potential retry
    currentConsensusText = consensusText;
    
    // Show JSON visualization section
    document.getElementById('jsonVisualizationSection').style.display = 'block';
    document.getElementById('jsonLoading').style.display = 'block';
    
    // Start JSON loading animation with better error handling
    const jsonLoadingText = document.getElementById('jsonLoadingText');
    if (jsonLoadingText) {
        console.log('Starting JSON loading animation');
        startLoadingAnimation(jsonLoadingText, JSON_LOADING_MESSAGES);
    } else {
        console.error('jsonLoadingText element not found');
    }
    
    try {
        // Convert consensus text to structured JSON
        const structuredData = await convertToStructuredData(consensusText);
        
        document.getElementById('jsonLoading').style.display = 'none';
        stopLoadingAnimation(); // Stop JSON loading animation
        
        console.log('convertToStructuredData returned:', !!structuredData);
        if (structuredData) {
            console.log('structuredData is valid, proceeding with displays...');
            // Store for later use
            currentJsonData = structuredData;
            
            // Show the analytics content
            document.getElementById('analyticsContent').style.display = 'block';
            
            // Create model name mapping
            createModelNameMapping(structuredData);
            
            // Display insights dashboard
            displayInsightsDashboard(structuredData);
            
            // Display synthesis view
            displayJsonVisualization(structuredData);
            
            // Populate raw data view
            console.log('About to call displayRawData with data:', !!structuredData);
            console.log('Type of structuredData:', typeof structuredData);
            console.log('Keys in structuredData:', structuredData ? Object.keys(structuredData) : 'N/A');
            displayRawData(structuredData);
            console.log('displayRawData call completed');
            
            // Setup view switching
            setupViewSwitching();
            
            // Load analytics content into collapsible sections
            loadAnalyticsContent();
        } else {
            console.log('structuredData is null/undefined, showing error');
            showJsonError('Failed to convert consensus to structured format');
        }
    } catch (error) {
        document.getElementById('jsonLoading').style.display = 'none';
        stopLoadingAnimation(); // Stop JSON loading animation
        showJsonError('JSON conversion failed: ' + error.message);
        console.error('JSON visualization error:', error);
    }
}

async function convertToStructuredData(consensusText) {
    // Get selected JSON model from dropdown
    const selectedJsonModelId = document.getElementById('jsonModelSelect')?.value;
    let jsonModel = ALL_LLMS.find(m => m.id === selectedJsonModelId);
    
    if (!jsonModel) {
        // Fallback to consensus model if JSON model not found
        jsonModel = ALL_LLMS.find(m => m.isConsensusModel);
        if (!jsonModel) {
            jsonModel = AVAILABLE_LLMS[0];
        }
    }
    
    console.log('Using JSON conversion model:', jsonModel.name, jsonModel.id);
    
    // Use the loaded template or fallback to hardcoded prompt
    let promptTemplate = jsonConversionPromptTemplate;
    if (!promptTemplate) {
        console.warn('JSON conversion prompt template not loaded, using hardcoded prompt');
        promptTemplate = `Convert the following consensus analysis into a clean, structured JSON format. Extract and organize the key information into intuitive categories.

IMPORTANT: The consensus analysis uses anonymous model codes (Model A, Model B, etc.). Here is the mapping to actual model names:
{{MODEL_CODE_MAPPING}}

When creating the JSON output, replace the anonymous model codes with the actual model names using the mapping above.

Please structure the data as follows:
{
    "summary": {
        "totalThemes": number,
        "consensusStrength": "strong|moderate|weak",
        "mainConclusion": "brief summary",
        "consensusScore": number (0-100 representing overall consensus strength),
        "controversyCount": number (themes with split or no consensus),
        "participationRate": number (successful responses / total selected)
    },
    "themes": [
        {
            "name": "theme name",
            "consensusType": "unanimous|majority|split|single|none",
            "agreementLevel": "unanimous|strong|moderate|weak|single",
            "statement": "consensus statement",
            "supportingOutputs": ["Output 1", "Output 2", ...],
            "disagreements": [
                {
                    "output": "Output X",
                    "position": "position description",
                    "significance": "why this matters"
                }
            ],
            "importanceScore": number (1-10 based on how central this theme is)
        }
    ],
    "keyInsights": [
        "insight 1",
        "insight 2",
        "insight 3"
    ],
    "confidenceMetrics": {
        "unanimousThemes": number,
        "majorityThemes": number,
        "splitThemes": number,
        "singleVoiceThemes": number
    },
    "modelBehavior": {
        "mostAgreeable": ["Actual Model Name 1", "Actual Model Name 2"],
        "mostDivergent": ["Actual Model Name 3"],
        "coverageByModel": {"Actual Model Name 1": percentage, "Actual Model Name 2": percentage}
    }
}

Consensus analysis to convert:
{{CONSENSUS_TEXT}}

Return ONLY the JSON object, no other text.`;
    }
    
    // Replace placeholders with actual values
    const modelCodeMappingText = Object.entries(modelCodeMapping)
        .map(([code, name]) => `${code} = ${name}`)
        .join('\n');
    
    const jsonPrompt = promptTemplate
        .replace('{{MODEL_CODE_MAPPING}}', modelCodeMappingText)
        .replace('{{CONSENSUS_TEXT}}', consensusText);

    // Store the JSON prompt globally for raw data display
    currentJsonPrompt = jsonPrompt;

    try {
        console.log('Calling querySingleModel for JSON conversion...');
        const result = await querySingleModel(jsonPrompt, jsonModel.id);
        console.log('JSON conversion result success:', result.success);
        
        if (result.success) {
            console.log('JSON conversion successful, parsing response...');
            // Try to parse the JSON response
            try {
                const jsonResponse = result.response.trim();
                console.log('JSON response length:', jsonResponse.length);
                const cleanJson = extractJsonFromResponse(jsonResponse);
                
                if (!cleanJson) {
                    console.error('extractJsonFromResponse returned null - malformed JSON detected');
                    console.error('Raw response sample:', jsonResponse.substring(0, 500) + '...');
                    return null;
                }
                
                console.log('Clean JSON length:', cleanJson.length);
                const parsedData = JSON.parse(cleanJson);
                console.log('JSON parsed successfully, returning data');
                return parsedData;
            } catch (parseError) {
                console.error('JSON parsing error:', parseError);
                console.error('Parse error details:', {
                    message: parseError.message,
                    stack: parseError.stack
                });
                console.error('Raw response sample:', result.response.substring(0, 500) + '...');
                return null;
            }
        } else {
            console.error('JSON conversion request failed:', result.error);
            return null;
        }
    } catch (error) {
        console.error('JSON conversion error:', error);
        return null;
    }
}

function extractJsonFromResponse(response) {
    console.log('Extracting JSON from response length:', response.length);
    
    // Step 1: Remove any markdown formatting
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Step 2: Remove common malicious content patterns before JSON extraction
    // Remove non-ASCII spam text patterns (like Bengali/Hindi spam)
    cleaned = cleaned.replace(/[\u0980-\u09FF\u0900-\u097F\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]+[^{\["]*?/g, '');
    
    // Remove suspicious patterns with "See Photos", "link added", etc.
    cleaned = cleaned.replace(/[^{\["]*?(see photos|link added|click here|visit now)[^{\["]*?/gi, '');
    
    // Remove URLs and suspicious link patterns
    cleaned = cleaned.replace(/https?:\/\/[^\s{}\[\]"]+/g, '');
    
    // Remove patterns with multiple consecutive non-English characters
    cleaned = cleaned.replace(/[^\x00-\x7F]{10,}/g, '');
    
    // Step 3: Find JSON object boundaries
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    } else {
        console.warn('No JSON object boundaries found');
        return null;
    }
    
    // Step 4: Additional cleaning within JSON boundaries
    // Remove any stray text that appears between JSON elements
    // Clean up between quotes and numbers/commas
    cleaned = cleaned.replace(/"\s*[^"{}\[\]:,\s]+\s*([,}\]])/g, '"$1');
    
    // Remove text that appears after values but before punctuation
    cleaned = cleaned.replace(/(\d+|true|false|null|"[^"]*")\s+[^,}\]"\s]+([,}\]])/g, '$1$2');
    
    // Try to fix common JSON issues
    try {
        // First attempt: parse as-is
        const testParse = JSON.parse(cleaned);
        console.log('JSON parsed successfully on first attempt');
        return cleaned;
    } catch (firstError) {
        console.log('First JSON parse attempt failed, trying advanced repair...');
        console.log('Parse error:', firstError.message);
        
        // Advanced repair attempts
        let repairedJson = cleaned;
        
        // Fix common quote issues
        repairedJson = repairedJson.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        
        // Fix trailing commas
        repairedJson = repairedJson.replace(/,\s*([}\]])/g, '$1');
        
        // Fix missing commas between properties
        repairedJson = repairedJson.replace(/"\s*"([^:}\]]+)"\s*:/g, '", "$1":');
        
        // Remove any remaining non-JSON text patterns
        repairedJson = repairedJson.replace(/[^{}\[\]":,\s\d\w\.-]/g, '');
        
        // Try parsing the repaired version
        try {
            const testParse = JSON.parse(repairedJson);
            console.log('JSON repaired successfully');
            return repairedJson;
        } catch (secondError) {
            console.error('JSON repair failed:', secondError.message);
            console.error('Original error:', firstError.message);
            console.error('Cleaned JSON sample:', cleaned.substring(0, 200) + '...');
            
            // Last resort: try to extract just the main structure
            try {
                const simpleExtract = cleaned.match(/{[^{}]*"summary"[^{}]*{[^}]*}[^{}]*}/)?.[0];
                if (simpleExtract) {
                    console.log('Attempting simple structure extraction');
                    JSON.parse(simpleExtract);
                    return simpleExtract;
                }
            } catch (simpleError) {
                console.error('Simple extraction also failed');
            }
            
            // Return null to indicate parsing failure
            return null;
        }
    }
}

function displayJsonVisualization(data) {
    const container = document.getElementById('jsonVisualization');
    
    const html = `
        <div class="json-viz-container">
            <!-- Summary Cards -->
            <div class="summary-cards">
                <div class="summary-card neu-inset">
                    <div class="summary-icon">📊</div>
                    <div class="summary-content">
                        <h3>${data.summary?.totalThemes || 0}</h3>
                        <p>Total Themes</p>
                    </div>
                </div>
                <div class="summary-card neu-inset">
                    <div class="summary-icon">${getConsensusIcon(data.summary?.consensusStrength)}</div>
                    <div class="summary-content">
                        <h3>${capitalizeFirst(data.summary?.consensusStrength || 'Unknown')}</h3>
                        <p>Overall Consensus</p>
                    </div>
                </div>
                <div class="summary-card neu-inset">
                    <div class="summary-icon">🎯</div>
                    <div class="summary-content">
                        <h3>${data.confidenceMetrics?.unanimousThemes || 0}</h3>
                        <p>Unanimous Themes</p>
                    </div>
                </div>
            </div>

            <!-- Main Conclusion -->
            ${data.summary?.mainConclusion ? `
                <div class="main-conclusion neu-inset">
                    <h3>🎯 Main Conclusion</h3>
                    <p>${escapeHtml(data.summary.mainConclusion)}</p>
                </div>
            ` : ''}

            <!-- Themes Breakdown -->
            <div class="themes-section">
                <h3 class="section-header">📋 Theme Analysis</h3>
                <div class="themes-grid">
                    ${(data.themes || []).map(theme => `
                        <div class="theme-card neu-outset">
                            <div class="theme-header">
                                <h4>${escapeHtml(theme.name)}</h4>
                                <span class="consensus-badge ${theme.consensusType}">${getConsensusIcon(theme.consensusType)} ${capitalizeFirst(theme.consensusType)}</span>
                            </div>
                            <p class="theme-statement">${escapeHtml(theme.statement || 'No statement available')}</p>
                            
                            <div class="theme-details">
                                <div class="agreement-level">
                                    <strong>Agreement:</strong> <span class="agreement-${theme.agreementLevel}">${capitalizeFirst(theme.agreementLevel || 'unknown')}</span>
                                </div>
                                
                                ${theme.supportingOutputs && theme.supportingOutputs.length > 0 ? `
                                    <div class="supporting-outputs">
                                        <strong>Supporting:</strong> ${theme.supportingOutputs.join(', ')}
                                    </div>
                                ` : ''}
                                
                                ${theme.disagreements && theme.disagreements.length > 0 ? `
                                    <details class="disagreements-details">
                                        <summary>⚠️ Disagreements (${theme.disagreements.length})</summary>
                                        <div class="disagreements-list">
                                            ${theme.disagreements.map(disagreement => `
                                                <div class="disagreement-item">
                                                    <strong>${disagreement.output}:</strong> ${escapeHtml(disagreement.position)}
                                                    ${disagreement.significance ? `<br><em>Significance: ${escapeHtml(disagreement.significance)}</em>` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </details>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Key Insights -->
            ${data.keyInsights && data.keyInsights.length > 0 ? `
                <div class="insights-section neu-inset">
                    <h3 class="section-header">💡 Key Insights</h3>
                    <ul class="insights-list">
                        ${data.keyInsights.map(insight => `
                            <li>${escapeHtml(insight)}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}

            <!-- Confidence Metrics -->
            ${data.confidenceMetrics ? `
                <div class="metrics-section neu-inset">
                    <h3 class="section-header">📈 Confidence Metrics</h3>
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <span class="metric-value">${data.confidenceMetrics.unanimousThemes || 0}</span>
                            <span class="metric-label">Unanimous</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${data.confidenceMetrics.majorityThemes || 0}</span>
                            <span class="metric-label">Majority</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${data.confidenceMetrics.splitThemes || 0}</span>
                            <span class="metric-label">Split</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${data.confidenceMetrics.singleVoiceThemes || 0}</span>
                            <span class="metric-label">Single Voice</span>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Copy JSON Button -->
            <div class="json-actions">
                <button type="button" class="copy-button neu-button json-copy-btn" title="Copy structured JSON">
                    <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 0.5rem;">
                        <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                        <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                    </svg>
                    <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none; margin-right: 0.5rem;">
                        <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                    </svg>
                    Copy Structured JSON
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Add event listener for JSON copy button
    const jsonCopyBtn = container.querySelector('.json-copy-btn');
    if (jsonCopyBtn) {
        jsonCopyBtn.addEventListener('click', function() {
            copyText(JSON.stringify(data, null, 2));
        });
    }
}

function getConsensusIcon(type) {
    const icons = {
        'unanimous': '🎯',
        'majority': '✅',
        'split': '⚖️',
        'single': '🗣️',
        'strong': '💪',
        'moderate': '👍',
        'weak': '🤏',
        'none': '❓'
    };
    return icons[type] || '📊';
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showJsonError(message) {
    const errorElement = document.getElementById('jsonError');
    errorElement.innerHTML = `
        <div class="error-content">
            <span class="error-text">JSON Conversion Error: ${escapeHtml(message)}</span>
            <button class="neu-button retry-json-btn" onclick="retryJsonConversion()">
                Retry JSON Conversion
            </button>
        </div>
    `;
    errorElement.style.display = 'block';
    document.getElementById('jsonLoading').style.display = 'none';
}

// Retry function for JSON conversion
function retryJsonConversion() {
    console.log('Retrying JSON conversion...');
    if (currentConsensusText) {
        // Hide error and retry
        document.getElementById('jsonError').style.display = 'none';
        generateJsonVisualization(currentConsensusText);
    } else {
        console.error('No consensus text available for retry');
    }
}

// New dashboard and view functions
function createModelNameMapping(data) {
    // The model names should already be in the JSON data from the conversion
    // This function is kept for compatibility but the mapping is done during JSON conversion
    console.log('Model mapping already handled during JSON conversion');
}

function displayInsightsDashboard(data) {
    const dashboard = document.getElementById('insightsDashboard');
    
    // Calculate metrics
    const consensusScore = data.summary?.consensusScore || calculateConsensusScore(data);
    const controversyCount = data.summary?.controversyCount || 
        (data.themes?.filter(t => t.consensusType === 'split' || t.consensusType === 'none').length || 0);
    const participationRate = data.summary?.participationRate || 
        Math.round((individualResponses.filter(r => r.text && !r.error).length / individualResponses.length) * 100);
    
    dashboard.innerHTML = `
        <div class="insight-metric">
            <div class="consensus-meter">
                <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--neu-bg-darker)" stroke-width="10"/>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="${getConsensusColor(consensusScore)}" 
                            stroke-width="10" stroke-dasharray="${Math.PI * 100}" 
                            stroke-dashoffset="${Math.PI * 100 * (1 - consensusScore / 100)}"/>
                </svg>
                <div class="consensus-meter-value">${consensusScore}%</div>
            </div>
            <div class="metric-label">Consensus Strength</div>
        </div>
        
        <div class="insight-metric">
            <div class="metric-icon">📊</div>
            <div class="metric-value">${data.summary?.totalThemes || 0}</div>
            <div class="metric-label">Total Themes</div>
        </div>
        
        <div class="insight-metric">
            <div class="metric-icon">⚠️</div>
            <div class="metric-value">${controversyCount}</div>
            <div class="metric-label">Controversial Topics</div>
        </div>
        
        <div class="insight-metric">
            <div class="metric-icon">✅</div>
            <div class="metric-value">${participationRate}%</div>
            <div class="metric-label">Model Success Rate</div>
        </div>
    `;
}

function calculateConsensusScore(data) {
    if (!data.confidenceMetrics) return 50;
    
    const metrics = data.confidenceMetrics;
    const total = (metrics.unanimousThemes || 0) + (metrics.majorityThemes || 0) + 
                  (metrics.splitThemes || 0) + (metrics.singleVoiceThemes || 0);
    
    if (total === 0) return 0;
    
    // Weighted scoring: unanimous=100, majority=75, single=50, split=25
    const score = ((metrics.unanimousThemes || 0) * 100 + 
                   (metrics.majorityThemes || 0) * 75 + 
                   (metrics.singleVoiceThemes || 0) * 50 + 
                   (metrics.splitThemes || 0) * 25) / total;
    
    return Math.round(score);
}

function getConsensusColor(score) {
    if (score >= 80) return 'var(--neu-success)';
    if (score >= 60) return 'var(--neu-accent)';
    if (score >= 40) return '#f59e0b';
    return 'var(--neu-error)';
}

function displayRawData(data) {
    try {
        console.log('=== displayRawData START ===');
        console.log('Data received:', !!data);
        console.log('Data type:', typeof data);
        
        const jsonString = JSON.stringify(data, null, 2);
        const promptText = currentJsonPrompt || 'JSON prompt will appear here after consensus generation...';
        
        console.log('JSON string created, length:', jsonString.length);
        console.log('First 100 chars of JSON:', jsonString.substring(0, 100));
        
        // Populate JSON Output Content
        const jsonOutputContainer = document.getElementById('jsonOutputContent');
        if (jsonOutputContainer) {
            const jsonHtml = `
                <div class="raw-data-actions">
                    <button class="neu-button copy-json-btn">Copy JSON</button>
                    <button class="neu-button download-json-btn">Download JSON</button>
                </div>
                <textarea id="rawJsonOutput" class="raw-data-textarea" readonly>${jsonString}</textarea>
            `;
            jsonOutputContainer.innerHTML = jsonHtml;
            
            // Setup JSON button actions
            const copyJsonBtn = jsonOutputContainer.querySelector('.copy-json-btn');
            if (copyJsonBtn) {
                copyJsonBtn.addEventListener('click', () => {
                    copyText(JSON.stringify(data, null, 2));
                });
            }
            
            const downloadJsonBtn = jsonOutputContainer.querySelector('.download-json-btn');
            if (downloadJsonBtn) {
                downloadJsonBtn.addEventListener('click', () => {
                    downloadJson(data);
                });
            }
        }
        
        // Populate Raw Prompt Content
        const rawPromptContainer = document.getElementById('rawPromptContent');
        if (rawPromptContainer) {
            const promptHtml = `
                <div class="raw-data-actions">
                    <button class="neu-button copy-prompt-btn">Copy Prompt</button>
                </div>
                <textarea id="rawPromptOutput" class="raw-data-textarea" readonly>${promptText}</textarea>
            `;
            rawPromptContainer.innerHTML = promptHtml;
            
            // Setup prompt button actions
            const copyPromptBtn = rawPromptContainer.querySelector('.copy-prompt-btn');
            if (copyPromptBtn) {
                copyPromptBtn.addEventListener('click', () => {
                    copyText(currentJsonPrompt);
                });
            }
        }
        
        console.log('=== displayRawData COMPLETE ===');
    } catch (error) {
        console.error('ERROR in displayRawData:', error);
        console.error('Error stack:', error.stack);
    }
}

function downloadJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consensus-analysis-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function setupViewSwitching() {
    const viewTabs = document.querySelectorAll('.view-tab');
    const viewPanes = document.querySelectorAll('.view-pane');
    
    viewTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetView = tab.dataset.view;
            
            // Update active tab
            viewTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active pane
            viewPanes.forEach(pane => {
                pane.classList.remove('active');
                pane.style.display = 'none';
            });
            
            const targetPane = document.getElementById(`${targetView}View`);
            if (targetPane) {
                targetPane.classList.add('active');
                targetPane.style.display = 'block';
                
                // Load analytics content if switching to analytics view
                if (targetView === 'analytics') {
                    loadAnalyticsContent();
                }
            }
        });
    });
}

// Analytics tabs are now replaced with collapsible sections
// This function is no longer needed as content loads directly into specific containers

function loadAnalyticsContent() {
    if (!currentJsonData) return;
    
    // Load content into specific collapsible section containers
    const controversyContainer = document.getElementById('controversyContent');
    const agreementContainer = document.getElementById('agreementContent');
    const behaviorContainer = document.getElementById('behaviorContent');
    const flowContainer = document.getElementById('flowContent');
    
    if (controversyContainer) {
        displayControversyHeatmap(controversyContainer, currentJsonData);
    }
    
    if (agreementContainer) {
        displayModelAgreementMatrix(agreementContainer, currentJsonData);
    }
    
    if (behaviorContainer) {
        displayModelBehavior(behaviorContainer, currentJsonData);
    }
    
    if (flowContainer) {
        displayConsensusFlow(flowContainer, currentJsonData);
    }
}

function displayControversyHeatmap(container, data) {
    const themes = data.themes || [];
    
    const html = `
        <div class="controversy-heatmap">
            ${themes.map(theme => {
                const controversyScore = getControversyScore(theme);
                const color = getHeatmapColor(controversyScore);
                const size = theme.importanceScore ? `${80 + theme.importanceScore * 4}%` : '100%';
                
                return `
                    <div class="heatmap-cell" style="background-color: ${color}; width: ${size}; height: ${size};">
                        <div class="heatmap-cell-title">${escapeHtml(theme.name)}</div>
                        <div class="heatmap-cell-score">${theme.consensusType}</div>
                        ${theme.disagreements && theme.disagreements.length > 0 ? 
                            `<div class="heatmap-cell-detail">${theme.disagreements.length} disagreements</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    container.innerHTML = html;
}

function getControversyScore(theme) {
    const scoreMap = {
        'unanimous': 0,
        'majority': 25,
        'single': 50,
        'split': 75,
        'none': 100
    };
    return scoreMap[theme.consensusType] || 50;
}

function getHeatmapColor(score) {
    // Blue (cool) to Red (hot) gradient
    const r = Math.round(255 * (score / 100));
    const b = Math.round(255 * (1 - score / 100));
    return `rgba(${r}, 0, ${b}, 0.7)`;
}

function displayModelAgreementMatrix(container, data) {
    const themes = data.themes || [];
    const modelNames = Object.values(modelCodeMapping);
    
    if (modelNames.length < 2 || themes.length === 0) {
        container.innerHTML = '<p>Not enough data for agreement matrix</p>';
        return;
    }
    
    // Calculate pairwise agreement scores
    const agreementMatrix = {};
    modelNames.forEach(model1 => {
        agreementMatrix[model1] = {};
        modelNames.forEach(model2 => {
            if (model1 === model2) {
                agreementMatrix[model1][model2] = 100; // Self-agreement is 100%
            } else {
                agreementMatrix[model1][model2] = calculatePairwiseAgreement(model1, model2, themes);
            }
        });
    });
    
    const html = `
        <div class="agreement-matrix-container">
            <h3>Model Agreement Matrix</h3>
            <p class="matrix-description">Shows percentage agreement between model pairs across all themes</p>
            <div class="agreement-matrix">
                <table class="matrix-table">
                    <thead>
                        <tr>
                            <th class="matrix-corner"></th>
                            ${modelNames.map(model => `<th class="matrix-header">${getShortModelName(model)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${modelNames.map(model1 => `
                            <tr>
                                <th class="matrix-row-header">${getShortModelName(model1)}</th>
                                ${modelNames.map(model2 => {
                                    const score = agreementMatrix[model1][model2];
                                    const colorClass = getAgreementColorClass(score);
                                    return `<td class="matrix-cell ${colorClass}" title="${model1} vs ${model2}: ${score}% agreement">${score}%</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="matrix-legend">
                <div class="legend-item"><span class="legend-color high-agreement"></span>High Agreement (80%+)</div>
                <div class="legend-item"><span class="legend-color medium-agreement"></span>Medium Agreement (60-79%)</div>
                <div class="legend-item"><span class="legend-color low-agreement"></span>Low Agreement (40-59%)</div>
                <div class="legend-item"><span class="legend-color no-agreement"></span>Poor Agreement (&lt;40%)</div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function calculatePairwiseAgreement(model1, model2, themes) {
    let agreements = 0;
    let comparableThemes = 0;
    
    themes.forEach(theme => {
        const supporting = theme.supportingOutputs || [];
        const disagreements = (theme.disagreements || []).map(d => d.output);
        
        // Check if both models addressed this theme
        const model1Addressed = supporting.includes(model1) || disagreements.includes(model1);
        const model2Addressed = supporting.includes(model2) || disagreements.includes(model2);
        
        if (model1Addressed && model2Addressed) {
            comparableThemes++;
            // Both models agree if they're both in supporting OR both in disagreements
            const model1Agrees = supporting.includes(model1);
            const model2Agrees = supporting.includes(model2);
            
            if (model1Agrees === model2Agrees) {
                agreements++;
            }
        }
    });
    
    return comparableThemes > 0 ? Math.round((agreements / comparableThemes) * 100) : 0;
}

function getShortModelName(fullName) {
    // Shorten model names for the matrix display
    const shortNames = {
        'Claude Sonnet 4': 'Claude-S4',
        'O4 Mini High': 'O4-Mini',
        'GPT-4.1': 'GPT-4.1',
        'DeepSeek R1': 'DS-R1',
        'Claude Opus 4': 'Claude-O4',
        'ChatGPT 4o': 'GPT-4o',
        'Gemini 2.5 Flash Thinking': 'Gemini-F',
        'Gemini Pro 2.5': 'Gemini-P',
        'Qwen3 30B': 'Qwen3',
        'Grok 3 Beta': 'Grok-3'
    };
    return shortNames[fullName] || fullName.substring(0, 8);
}

function getAgreementColorClass(score) {
    if (score >= 80) return 'high-agreement';
    if (score >= 60) return 'medium-agreement';
    if (score >= 40) return 'low-agreement';
    return 'no-agreement';
}

function displayModelBehavior(container, data) {
    const modelBehavior = data.modelBehavior || {};
    
    const html = `
        <div class="model-behavior-cards">
            ${modelBehavior.mostAgreeable ? `
                <div class="behavior-card neu-outset">
                    <h4>Most Agreeable Models</h4>
                    <ul>
                        ${modelBehavior.mostAgreeable.map(model => 
                            `<li>${model}</li>`
                        ).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${modelBehavior.mostDivergent ? `
                <div class="behavior-card neu-outset">
                    <h4>Most Divergent Models</h4>
                    <ul>
                        ${modelBehavior.mostDivergent.map(model => 
                            `<li>${model}</li>`
                        ).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
    
    container.innerHTML = html;
}

function displayConsensusFlow(container, data) {
    const themes = data.themes || [];
    const modelNames = Object.values(modelCodeMapping);
    
    if (themes.length === 0) {
        container.innerHTML = '<p>No themes available for consensus flow analysis</p>';
        return;
    }
    
    // Group themes by consensus type for flow visualization
    const consensusGroups = {
        'unanimous': themes.filter(t => t.consensusType === 'unanimous'),
        'majority': themes.filter(t => t.consensusType === 'majority'),
        'split': themes.filter(t => t.consensusType === 'split'),
        'single': themes.filter(t => t.consensusType === 'single'),
        'none': themes.filter(t => t.consensusType === 'none')
    };
    
    const html = `
        <div class="consensus-flow-container">
            <h3>Consensus Formation Flow</h3>
            <p class="flow-description">Shows how individual model positions combine to form different types of consensus</p>
            
            <div class="flow-summary-stats">
                <div class="flow-stat">
                    <span class="stat-number">${consensusGroups.unanimous.length}</span>
                    <span class="stat-label">Unanimous</span>
                </div>
                <div class="flow-stat">
                    <span class="stat-number">${consensusGroups.majority.length}</span>
                    <span class="stat-label">Majority</span>
                </div>
                <div class="flow-stat">
                    <span class="stat-number">${consensusGroups.split.length}</span>
                    <span class="stat-label">Split</span>
                </div>
                <div class="flow-stat">
                    <span class="stat-number">${consensusGroups.single.length}</span>
                    <span class="stat-label">Single Voice</span>
                </div>
            </div>
            
            <div class="flow-themes">
                ${Object.entries(consensusGroups).map(([type, themeList]) => {
                    if (themeList.length === 0) return '';
                    return `
                        <div class="flow-group ${type}-group">
                            <h4 class="flow-group-title">${capitalizeFirst(type)} Consensus (${themeList.length} themes)</h4>
                            <div class="flow-themes-list">
                                <div id="flow-group-${type}">
                                    ${themeList.slice(0, 3).map(theme => `
                                        <div class="flow-theme-item">
                                            <div class="theme-name">${escapeHtml(theme.name)}</div>
                                            <div class="theme-flow">
                                                <div class="supporting-models">
                                                    ${(theme.supportingOutputs || []).map(model => 
                                                        `<span class="model-badge supporting">${getShortModelName(model)}</span>`
                                                    ).join('')}
                                                </div>
                                                ${theme.disagreements && theme.disagreements.length > 0 ? `
                                                    <div class="disagreeing-models">
                                                        ${theme.disagreements.map(d => 
                                                            `<span class="model-badge disagreeing">${getShortModelName(d.output)}</span>`
                                                        ).join('')}
                                                    </div>
                                                ` : ''}
                                                <div class="consensus-arrow">→</div>
                                                <div class="consensus-result ${type}">${type.toUpperCase()}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                    ${themeList.length > 3 ? `
                                        <div class="more-themes-container">
                                            <button class="more-themes-btn" onclick="expandThemeGroup('flow-group-${type}', '${type}', this)" data-themes='${JSON.stringify(themeList)}'>
                                                +${themeList.length - 3} more themes
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).filter(html => html !== '').join('')}
            </div>
            
            <div class="flow-patterns">
                <h4>Consensus Patterns</h4>
                <div class="pattern-analysis">
                    ${generateConsensusPatterns(themes, modelNames)}
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function generateConsensusPatterns(themes, modelNames) {
    // Analyze which models tend to be in majority vs minority positions
    const modelStats = {};
    modelNames.forEach(model => {
        modelStats[model] = { agreements: 0, disagreements: 0, total: 0 };
    });
    
    themes.forEach(theme => {
        const supporting = theme.supportingOutputs || [];
        const disagreements = (theme.disagreements || []).map(d => d.output);
        
        supporting.forEach(model => {
            if (modelStats[model]) {
                modelStats[model].agreements++;
                modelStats[model].total++;
            }
        });
        
        disagreements.forEach(model => {
            if (modelStats[model]) {
                modelStats[model].disagreements++;
                modelStats[model].total++;
            }
        });
    });
    
    // Sort models by agreement rate
    const sortedModels = Object.entries(modelStats)
        .filter(([model, stats]) => stats.total > 0)
        .sort(([, a], [, b]) => (b.agreements / b.total) - (a.agreements / a.total));
    
    return `
        <div class="model-consensus-tendency">
            <h5>Model Consensus Tendency</h5>
            <div class="tendency-list">
                ${sortedModels.map(([model, stats]) => {
                    const agreementRate = Math.round((stats.agreements / stats.total) * 100);
                    const tendencyClass = agreementRate > 70 ? 'high-consensus' : agreementRate > 50 ? 'medium-consensus' : 'low-consensus';
                    return `
                        <div class="tendency-item ${tendencyClass}">
                            <span class="model-name">${getShortModelName(model)}</span>
                            <span class="agreement-bar">
                                <div class="bar-fill" style="width: ${agreementRate}%"></div>
                            </span>
                            <span class="agreement-rate">${agreementRate}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Theme expansion functions for consensus flow
function expandThemeGroup(groupId, type, buttonElement) {
    const container = document.getElementById(groupId);
    const themesData = JSON.parse(buttonElement.dataset.themes);
    
    if (!container || !themesData) return;
    
    // Render all themes
    const allThemesHtml = themesData.map(theme => `
        <div class="flow-theme-item">
            <div class="theme-name">${escapeHtml(theme.name)}</div>
            <div class="theme-flow">
                <div class="supporting-models">
                    ${(theme.supportingOutputs || []).map(model => 
                        `<span class="model-badge supporting">${getShortModelName(model)}</span>`
                    ).join('')}
                </div>
                ${theme.disagreements && theme.disagreements.length > 0 ? `
                    <div class="disagreeing-models">
                        ${theme.disagreements.map(d => 
                            `<span class="model-badge disagreeing">${getShortModelName(d.output)}</span>`
                        ).join('')}
                    </div>
                ` : ''}
                <div class="consensus-arrow">→</div>
                <div class="consensus-result ${type}">${type.toUpperCase()}</div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = allThemesHtml + `
        <div class="more-themes-container">
            <button class="more-themes-btn collapse-btn" onclick="collapseThemeGroup('${groupId}', '${type}', this)" data-themes='${JSON.stringify(themesData)}'>
                Show less
            </button>
        </div>
    `;
}

function collapseThemeGroup(groupId, type, buttonElement) {
    const container = document.getElementById(groupId);
    const themesData = JSON.parse(buttonElement.dataset.themes);
    
    if (!container || !themesData) return;
    
    // Render only first 3 themes
    const limitedThemesHtml = themesData.slice(0, 3).map(theme => `
        <div class="flow-theme-item">
            <div class="theme-name">${escapeHtml(theme.name)}</div>
            <div class="theme-flow">
                <div class="supporting-models">
                    ${(theme.supportingOutputs || []).map(model => 
                        `<span class="model-badge supporting">${getShortModelName(model)}</span>`
                    ).join('')}
                </div>
                ${theme.disagreements && theme.disagreements.length > 0 ? `
                    <div class="disagreeing-models">
                        ${theme.disagreements.map(d => 
                            `<span class="model-badge disagreeing">${getShortModelName(d.output)}</span>`
                        ).join('')}
                    </div>
                ` : ''}
                <div class="consensus-arrow">→</div>
                <div class="consensus-result ${type}">${type.toUpperCase()}</div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = limitedThemesHtml + `
        <div class="more-themes-container">
            <button class="more-themes-btn" onclick="expandThemeGroup('${groupId}', '${type}', this)" data-themes='${JSON.stringify(themesData)}'>
                +${themesData.length - 3} more themes
            </button>
        </div>
    `;
}