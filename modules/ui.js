// UI Components Module
// Handles DOM manipulation, event listeners, and UI component management

import { SELECTABLE_LLMS } from './config.js';
import { copyText, escapeHtml } from './utils.js';
import { apiKeyStatus } from './api.js';
import { startIndividualLoadingAnimation } from './loading.js';

// API key status display
export function updateApiKeyStatus(status) {
    // Update the API key saved container if it exists
    const apiKeySection = document.getElementById('apiKeySection');
    const savedContainer = apiKeySection?.querySelector('.api-key-saved-container');
    
    if (savedContainer) {
        const savedTextElement = savedContainer.querySelector('.api-key-saved-text');
        if (savedTextElement) {
            let icon = '';
            let text = '';
            let className = 'api-key-saved-text';
            
            switch (status) {
                case 'valid':
                    icon = '<i data-lucide="check-circle"></i>';
                    text = 'API Key Valid';
                    className += ' valid';
                    break;
                case 'missing':
                    icon = '<i data-lucide="x-circle"></i>';
                    text = 'API Key Missing';
                    className += ' error';
                    break;
                case 'error':
                    icon = '<i data-lucide="alert-circle"></i>';
                    text = 'API Key Error';
                    className += ' error';
                    break;
                case 'checking':
                    icon = '<i data-lucide="loader"></i>';
                    text = 'Checking API Key...';
                    className += ' checking';
                    break;
            }
            
            savedTextElement.className = className;
            savedTextElement.innerHTML = icon + ' ' + text;
            
            // Refresh Lucide icons after updating content
            if (window.refreshLucideIcons) {
                window.refreshLucideIcons();
            }
        }
    }
}

// Initialize API key input functionality
export function initializeApiKeyInput() {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKeySetBtn = document.getElementById('apiKeySetBtn');
    const apiKeySection = document.getElementById('apiKeySection');
    const apiKeyContainer = apiKeySection.querySelector('.api-key-container');
    
    // Check if we already have a valid API key
    const currentKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (currentKey) {
        // Hide the input section and show a compact saved status
        apiKeySection.innerHTML = `
            <div class="api-key-saved-container neu-outset">
                <div class="api-key-saved-content">
                    <span class="api-key-saved-text valid">
                        <i data-lucide="check-circle"></i>
                        API Key Valid
                    </span>
                    <button type="button" class="neu-button api-key-clear-btn" id="clearApiKeyBtn">
                        Clear Key
                    </button>
                </div>
            </div>
        `;
        
        // Refresh icons
        if (window.refreshLucideIcons) {
            window.refreshLucideIcons();
        }
        
        // Add event listener to clear button
        const clearBtn = document.getElementById('clearApiKeyBtn');
        clearBtn.addEventListener('click', () => {
            // Clear the key from localStorage
            localStorage.removeItem('OPENROUTER_API_KEY');
            
            // Update status
            updateApiKeyStatus('missing');
            
            // Restore the original input section
            apiKeySection.innerHTML = `
                <div class="api-key-container neu-outset">
                    <div class="api-key-input-group">
                        <input 
                            type="password" 
                            id="apiKeyInput" 
                            class="api-key-input neu-textarea" 
                            placeholder="Enter your OpenRouter API key..."
                            autocomplete="off"
                        >
                        <button type="button" id="apiKeySetBtn" class="neu-button neu-button-primary api-key-btn">
                            Set API Key
                        </button>
                    </div>
                    <p class="api-key-hint">Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a></p>
                </div>
            `;
            
            // Re-initialize the functionality
            initializeApiKeyInput();
        });
        
        updateApiKeyStatus('valid');
        return;
    }
    
    // Handle set API key button click
    apiKeySetBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }
        
        // Save to localStorage
        localStorage.setItem('OPENROUTER_API_KEY', apiKey);
        
        // Update status
        updateApiKeyStatus('valid');
        
        // Show success feedback
        apiKeySetBtn.textContent = 'API Key Set!';
        apiKeySetBtn.classList.add('success');
        
        // After success, collapse to saved state
        setTimeout(() => {
            apiKeySection.innerHTML = `
                <div class="api-key-saved-container neu-outset">
                    <div class="api-key-saved-content">
                        <span class="api-key-saved-text valid">
                            <i data-lucide="check-circle"></i>
                            API Key Valid
                        </span>
                        <button type="button" class="neu-button api-key-clear-btn" id="clearApiKeyBtn">
                            Clear Key
                        </button>
                    </div>
                </div>
            `;
            
            // Refresh icons and re-initialize
            if (window.refreshLucideIcons) {
                window.refreshLucideIcons();
            }
            initializeApiKeyInput();
        }, 2000);
    });
    
    // Handle enter key in input
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            apiKeySetBtn.click();
        }
    });
}

// Model grid population
export function populateModelGrid() {
    const modelGrid = document.getElementById('modelGrid');
    
    // All selectable LLMs are now visible by default
    const visibleModels = SELECTABLE_LLMS;
    const hiddenModels = [];
    
    // Default selected models: Claude Opus 4, O4 Mini High, Gemini 2.5 Pro
    const defaultSelectedModels = [
        'anthropic/claude-opus-4',
        'openai/o4-mini-high',
        'google/gemini-2.5-pro-preview'
    ];
    
    // Create checkboxes for visible models
    let modelGridHTML = '';
    visibleModels.forEach((model, index) => {
        const isChecked = defaultSelectedModels.includes(model.id) ? 'checked' : '';
        modelGridHTML += `
            <label class="model-label neu-checkbox-label" for="model-${index}">
                <input type="checkbox" class="neu-checkbox model-checkbox" id="model-${index}" value="${model.id}" ${isChecked}>
                <span>${model.name}</span>
            </label>
        `;
    });
    
    modelGrid.innerHTML = modelGridHTML;
    
    // Setup preset button handlers
    setupPresetButtons();
    
    // Add hidden models to the expanded section if there are any
    if (hiddenModels.length > 0) {
        const expandedOptions = document.getElementById('expandedOptions');
        if (expandedOptions) {
            // Find the model selection section and add hidden models
            const modelSelectionSection = expandedOptions.querySelector('.model-selection-section');
            if (modelSelectionSection) {
                let hiddenModelsHTML = '<div class="model-grid hidden-models" style="margin-top: 1rem;">';
                hiddenModels.forEach((model, index) => {
                    const actualIndex = visibleModels.length + index;
                    const isChecked = defaultSelectedModels.includes(model.id) ? 'checked' : '';
                    hiddenModelsHTML += `
                        <label class="model-label neu-checkbox-label hidden-model" for="model-${actualIndex}">
                            <input type="checkbox" class="neu-checkbox model-checkbox" id="model-${actualIndex}" value="${model.id}" ${isChecked}>
                            <span>${model.name}</span>
                        </label>
                    `;
                });
                hiddenModelsHTML += '</div>';
                modelSelectionSection.insertAdjacentHTML('beforebegin', hiddenModelsHTML);
            }
        }
    }
}

// Form validation
export function getSelectedModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox:checked');
    const selectedModels = [];
    
    checkboxes.forEach(checkbox => {
        const model = SELECTABLE_LLMS.find(m => m.id === checkbox.value);
        if (model) {
            selectedModels.push(model);
        }
    });
    
    return selectedModels;
}

export function updateModelError(show, message = '') {
    const errorElement = document.getElementById('modelError');
    if (errorElement) {
        if (show) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else {
            errorElement.style.display = 'none';
        }
    }
}

// Submit button state management
export function updateSubmitButton(state, text = '') {
    const submitButton = document.getElementById('submitButton');
    const submitText = document.getElementById('submitText');
    const submitSpinner = document.getElementById('submitSpinner');
    
    if (!submitButton || !submitText || !submitSpinner) return;
    
    switch (state) {
        case 'normal':
            submitButton.disabled = false;
            submitButton.classList.remove('loading-state');
            submitText.textContent = 'Synthesize Consensus';
            submitSpinner.style.display = 'none';
            break;
        case 'loading':
            submitButton.disabled = true;
            submitButton.classList.add('loading-state');
            submitText.textContent = text || 'Processing...';
            submitSpinner.style.display = 'none'; // No spinner for submit button
            break;
        case 'error':
            submitButton.disabled = false;
            submitButton.classList.remove('loading-state');
            submitText.textContent = 'Try Again';
            submitSpinner.style.display = 'none';
            break;
    }
}

// Response display functions
export function showResponseContainer() {
    const responseContainer = document.getElementById('responseContainer');
    if (responseContainer) {
        responseContainer.style.display = 'block';
    }
}

export function clearPreviousResults() {
    const individualResponsesGrid = document.getElementById('individualResponsesGrid');
    if (individualResponsesGrid) {
        individualResponsesGrid.innerHTML = '';
    }
    
    // Hide sections
    const sections = ['individualResponsesSection', 'consensusSection', 'jsonVisualizationSection'];
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
        }
    });
    
    // Clear content areas
    const contentAreas = ['consensusOutput', 'rawConsensusOutput', 'consensusPromptContent', 'analyticsContent'];
    contentAreas.forEach(areaId => {
        const area = document.getElementById(areaId);
        if (area) {
            area.innerHTML = '';
        }
    });
    
    // Hide error messages
    const errorElements = ['consensusError', 'jsonError'];
    errorElements.forEach(errorId => {
        const error = document.getElementById(errorId);
        if (error) {
            error.style.display = 'none';
        }
    });
}

// Individual response display
export function displayIndividualResponses(responses) {
    const grid = document.getElementById('individualResponsesGrid');
    const section = document.getElementById('individualResponsesSection');
    
    if (!grid || !section) return;
    
    // First create empty cards for loading animations
    createEmptyResponseCards(responses);
    section.style.display = 'block';
    
    // Show the collapse button for the outputs section
    const responsesToggleBtn = document.getElementById('responsesToggleBtn');
    if (responsesToggleBtn) {
        responsesToggleBtn.style.display = 'block';
    }
    
    // Then populate them with actual content
    setTimeout(() => {
        populateResponseCards(responses);
    }, 100);
}

// Create empty cards for loading animations
function createEmptyResponseCards(responses) {
    const grid = document.getElementById('individualResponsesGrid');
    if (!grid) return;
    
    let gridHTML = '';
    
    responses.forEach((response, index) => {
        gridHTML += `
            <div class="response-card neu-outset-sm" id="response-card-${index}">
                <div class="response-card-header">
                    <h3 class="response-card-title">${escapeHtml(response.model.name)}</h3>
                </div>
                <div class="response-card-content">
                    <!-- Loading content will be inserted here -->
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = gridHTML;
}

// Populate cards with actual response content
function populateResponseCards(responses) {
    responses.forEach((response, index) => {
        populateSingleResponseCard(response, index);
    });
}

// Update a single response card
export function updateSingleResponseCard(response, index) {
    populateSingleResponseCard(response, index);
}

// Populate a single response card
function populateSingleResponseCard(response, index) {
    const card = document.getElementById(`response-card-${index}`);
    if (!card) return;
    
    const contentElement = card.querySelector('.response-card-content');
    const headerElement = card.querySelector('.response-card-header');
    
    // Handle loading state
    if (response.loading) {
        // Start loading animation for this card
        startIndividualLoadingAnimation(index, response.model.name);
        return;
    }
    
    if (response.success) {
        // Add copy button to header
        headerElement.innerHTML = `
            <h3 class="response-card-title">${escapeHtml(response.model.name)}</h3>
            <button class="copy-button" onclick="window.copyText(\`${escapeHtml(response.response).replace(/`/g, '\\`')}\`, this)">
                <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                    <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                </svg>
                <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                    <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                </svg>
            </button>
        `;
        
        // Set content
        contentElement.innerHTML = `<div class="response-text">${escapeHtml(response.response)}</div>`;
    } else {
        // Error state
        card.classList.add('error');
        contentElement.innerHTML = `<div class="response-text">Error: ${escapeHtml(response.error || 'Unknown error')}</div>`;
    }
}

// Section collapse/expand functionality
export function setupSectionToggles() {
    // Responses section toggle
    const responsesToggleBtn = document.getElementById('responsesToggleBtn');
    const responsesContainer = document.getElementById('responsesContainer');
    
    if (responsesToggleBtn && responsesContainer) {
        responsesToggleBtn.addEventListener('click', () => {
            toggleSection(responsesContainer, 'responses');
        });
    }
    
    // Consensus section toggle
    const consensusToggleBtn = document.getElementById('consensusToggleBtn');
    const consensusContainer = document.getElementById('consensusContainer');
    
    if (consensusToggleBtn && consensusContainer) {
        consensusToggleBtn.addEventListener('click', () => {
            toggleSection(consensusContainer, 'consensus');
        });
    }
    
    // Analytics section toggle
    const analyticsToggleBtn = document.getElementById('analyticsToggleBtn');
    const analyticsContainer = document.getElementById('analyticsContainer');
    
    if (analyticsToggleBtn && analyticsContainer) {
        analyticsToggleBtn.addEventListener('click', () => {
            toggleSection(analyticsContainer, 'analytics');
        });
    }
}

function toggleSection(container, sectionType) {
    const isCollapsed = container.classList.contains('collapsed');
    
    if (isCollapsed) {
        container.classList.remove('collapsed');
    } else {
        container.classList.add('collapsed');
    }
}

// Tab management
export function setupTabs() {
    setupConsensusTabs();
    setupViewTabs();
}

function setupConsensusTabs() {
    const tabs = document.querySelectorAll('.consensus-tab');
    const panes = document.querySelectorAll('.consensus-tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update tab states
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update pane visibility
            panes.forEach(pane => {
                if (pane.id === `${targetTab}Tab`) {
                    pane.classList.add('active');
                    pane.style.display = 'block';
                } else {
                    pane.classList.remove('active');
                    pane.style.display = 'none';
                }
            });
        });
    });
}

function setupViewTabs() {
    const tabs = document.querySelectorAll('.view-tab');
    const panes = document.querySelectorAll('.view-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetView = tab.dataset.view;
            
            // Update tab states
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update pane visibility
            panes.forEach(pane => {
                if (pane.id === `${targetView}View`) {
                    pane.classList.add('active');
                    pane.style.display = 'block';
                } else {
                    pane.classList.remove('active');
                    pane.style.display = 'none';
                }
            });
        });
    });
}

// Model grid expand/collapse functionality
export function setupModelGridExpansion() {
    const expandBtn = document.getElementById('expandModelsBtn');
    const collapseBtn = document.getElementById('collapseModelsBtn');
    const expandedOptions = document.getElementById('expandedOptions');
    
    if (expandBtn && expandedOptions) {
        expandBtn.addEventListener('click', () => {
            expandedOptions.style.display = 'block';
            expandBtn.style.display = 'none';
            if (collapseBtn) collapseBtn.style.display = 'inline-flex';
        });
    }
    
    if (collapseBtn && expandedOptions) {
        collapseBtn.addEventListener('click', () => {
            expandedOptions.style.display = 'none';
            if (expandBtn) expandBtn.style.display = 'inline-flex';
            collapseBtn.style.display = 'none';
        });
    }
}

// Select all functionality
export function setupSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const modelCheckboxes = document.querySelectorAll('.model-checkbox');
            modelCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });
    }
    
    // Update select all state when individual checkboxes change
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('model-checkbox') && selectAllCheckbox) {
            const modelCheckboxes = document.querySelectorAll('.model-checkbox');
            const checkedBoxes = document.querySelectorAll('.model-checkbox:checked');
            
            selectAllCheckbox.checked = modelCheckboxes.length === checkedBoxes.length;
            selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < modelCheckboxes.length;
        }
    });
}

// Copy button functionality for various sections
export function setupCopyButtons() {
    // User prompt copy button
    const userPromptCopyBtn = document.querySelector('.user-prompt-copy');
    if (userPromptCopyBtn) {
        userPromptCopyBtn.addEventListener('click', () => {
            const userPrompt = document.getElementById('userPrompt');
            if (userPrompt && userPrompt.value.trim()) {
                copyText(userPrompt.value, userPromptCopyBtn);
            }
        });
    }
}

// Setup model preset buttons
function setupPresetButtons() {
    const cheapTestBtn = document.getElementById('cheapTestPreset');
    const expensiveBestBtn = document.getElementById('expensiveBestPreset');
    
    if (cheapTestBtn) {
        cheapTestBtn.addEventListener('click', () => {
            selectModelPreset('cheap');
        });
    }
    
    if (expensiveBestBtn) {
        expensiveBestBtn.addEventListener('click', () => {
            selectModelPreset('expensive');
        });
    }
}

// Select model preset
function selectModelPreset(presetType) {
    // First, uncheck all models
    const allCheckboxes = document.querySelectorAll('.model-checkbox');
    allCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    let modelsToSelect = [];
    let consensusModelValue = '';
    
    if (presetType === 'cheap') {
        // Cheap/Test: Gemini 2.5 Flash Thinking, GPT-4.1, ChatGPT 4o
        modelsToSelect = [
            'google/gemini-2.5-flash-preview:thinking',
            'openai/gpt-4.1', 
            'openai/chatgpt-4o-latest'
        ];
        // Set consensus model to Gemini 2.5 Flash Thinking
        consensusModelValue = 'google/gemini-2.5-flash-preview:thinking';
    } else if (presetType === 'expensive') {
        // Expensive/Best: All models visible by default (first 7)
        modelsToSelect = [
            'anthropic/claude-opus-4',
            'deepseek/deepseek-r1-0528',
            'openai/o4-mini-high',
            'mistralai/magistral-medium-2506',
            'x-ai/grok-3-beta',
            'google/gemini-2.5-pro-preview'
        ];
        // Set consensus model to Gemini 2.5 Pro
        consensusModelValue = 'google/gemini-2.5-pro-preview';
    }
    
    // Check the selected models
    modelsToSelect.forEach(modelId => {
        const checkbox = document.querySelector(`.model-checkbox[value="${modelId}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    
    // Set the consensus model dropdown
    const consensusModelSelect = document.getElementById('consensusModelSelect');
    if (consensusModelSelect && consensusModelValue) {
        consensusModelSelect.value = consensusModelValue;
    }
    
    // Automatically expand the "Show More Options" section
    const expandedOptions = document.getElementById('expandedOptions');
    const expandBtn = document.getElementById('expandModelsBtn');
    const collapseBtn = document.getElementById('collapseModelsBtn');
    
    if (expandedOptions && expandBtn && collapseBtn) {
        expandedOptions.style.display = 'block';
        expandBtn.style.display = 'none';
        collapseBtn.style.display = 'inline-flex';
    }
    
    // Update select all checkbox state
    updateSelectAllState();
    
    // Visual feedback
    const clickedButton = document.getElementById(presetType === 'cheap' ? 'cheapTestPreset' : 'expensiveBestPreset');
    if (clickedButton) {
        clickedButton.classList.add('preset-selected');
        setTimeout(() => {
            clickedButton.classList.remove('preset-selected');
        }, 200);
    }
}

// Update select all checkbox state
function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        const modelCheckboxes = document.querySelectorAll('.model-checkbox');
        const checkedBoxes = document.querySelectorAll('.model-checkbox:checked');
        
        selectAllCheckbox.checked = modelCheckboxes.length === checkedBoxes.length;
        selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < modelCheckboxes.length;
    }
}

// Make functions available globally for onclick handlers
window.copyText = copyText;