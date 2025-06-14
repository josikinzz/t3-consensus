// Main Application Module
// Coordinates all modules and handles the main application flow

import { checkApiKey } from './api.js';
import { 
    updateApiKeyStatus, 
    initializeApiKeyInput,
    populateModelGrid, 
    setupSectionToggles, 
    setupTabs, 
    setupModelGridExpansion, 
    setupSelectAll, 
    setupCopyButtons,
    getSelectedModels,
    updateModelError,
    updateSubmitButton,
    showResponseContainer,
    clearPreviousResults,
    displayIndividualResponses,
    updateSingleResponseCard
} from './ui.js';
import { queryOpenRouterModels } from './api.js';
import { generateConsensus } from './consensus.js';
import { generateJsonVisualization } from './analytics.js';
import { 
    startIndividualLoadingAnimation, 
    stopIndividualLoadingAnimation, 
    startButtonPulse,
    stopAllLoadingAnimations 
} from './loading.js';
import { showError } from './utils.js';
import { initTooltips } from './tooltip.js';

// Global application state
let isSubmitting = false;
let individualResponses = [];

// Initialize the application
export function initializeApp() {
    console.log('=== Initializing PolyLLM Application ===');
    
    // Initialize API key input
    initializeApiKeyInput();
    
    // Check API key status
    const apiStatus = checkApiKey();
    updateApiKeyStatus(apiStatus);
    
    // Populate model grid
    populateModelGrid();
    
    // Set up UI components
    setupSectionToggles();
    setupTabs();
    setupModelGridExpansion();
    setupSelectAll();
    setupCopyButtons();
    
    // Initialize tooltips
    initTooltips();
    
    // Set up main form submission
    setupFormSubmission();
    
    console.log('Application initialized successfully');
}

// Set up form submission handling
function setupFormSubmission() {
    const form = document.getElementById('userForm');
    
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

// Main form submission handler
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (isSubmitting) {
        console.log('Already processing, ignoring duplicate submission');
        return;
    }
    
    console.log('=== Starting form submission ===');
    
    // Get form data
    const userPrompt = document.getElementById('userPrompt')?.value?.trim();
    const selectedModels = getSelectedModels();
    
    // Validation
    if (!userPrompt) {
        showError('Please enter a prompt');
        return;
    }
    
    if (selectedModels.length === 0) {
        updateModelError(true, 'Please select at least one LLM');
        return;
    }
    
    // Clear previous error
    updateModelError(false);
    
    try {
        isSubmitting = true;
        
        // Start processing
        await processPrompt(userPrompt, selectedModels);
        
    } catch (error) {
        console.error('Form submission error:', error);
        showError(`Processing failed: ${error.message}`);
        updateSubmitButton('error');
    } finally {
        isSubmitting = false;
    }
}

// Main processing workflow
async function processPrompt(userPrompt, selectedModels) {
    console.log('Starting prompt processing workflow...');
    
    // Show pulse animation on submit button
    const submitButton = document.getElementById('submitButton');
    startButtonPulse(submitButton);
    
    // Clear previous results
    clearPreviousResults();
    
    // Show response container
    showResponseContainer();
    
    try {
        // Phase 1: Query individual models
        console.log('Phase 1: Querying individual models...');
        updateSubmitButton('loading', 'Querying Models...');
        
        // Create empty response cards with proper structure for loading
        const emptyResponses = selectedModels.map(model => ({ model, success: false, response: '', loading: true }));
        displayIndividualResponses(emptyResponses);
        
        individualResponses = await queryOpenRouterModels(
            selectedModels, 
            userPrompt, 
            {
                start: (index, modelName) => {
                    // Loading animation should already be running
                    console.log(`API query started for ${modelName}`);
                },
                stop: (index) => {
                    // Stop the loading animation for this specific card
                    stopIndividualLoadingAnimation(index);
                },
                onResponse: (index, response) => {
                    // Update the individual card as soon as the response arrives
                    console.log(`Response received from ${response.model.name}, updating card ${index}`);
                    updateSingleResponseCard(response, index);
                }
            }
        );
        
        // Check if we have any successful responses
        const successfulResponses = individualResponses.filter(r => r.success);
        if (successfulResponses.length === 0) {
            throw new Error('No models provided successful responses');
        }
        
        console.log(`${successfulResponses.length}/${individualResponses.length} models responded successfully`);
        
        // Phase 2: Generate consensus
        console.log('Phase 2: Generating consensus...');
        updateSubmitButton('loading', 'Building Consensus...');
        
        // Show consensus section first so loading animation is visible
        const consensusSection = document.getElementById('consensusSection');
        if (consensusSection) {
            consensusSection.style.display = 'block';
        }
        
        const consensusResult = await generateConsensus(selectedModels, individualResponses, userPrompt);
        
        // Phase 3: Show analytics button
        console.log('Phase 3: Showing analytics button...');
        
        // Show analytics section with button
        const analyticsSection = document.getElementById('jsonVisualizationSection');
        if (analyticsSection) {
            analyticsSection.style.display = 'block';
        }
        
        // Store consensus data for later use
        window.lastConsensusData = {
            consensusText: consensusResult.consensusText,
            consensusPrompt: consensusResult.consensusPrompt,
            codeMapping: consensusResult.codeMapping,
            userPrompt: userPrompt
        };
        
        // Show the analysis button
        showAnalysisButton();
        
        // Complete
        updateSubmitButton('normal');
        console.log('=== Processing completed successfully ===');
        
    } catch (error) {
        console.error('Processing error:', error);
        stopAllLoadingAnimations();
        updateSubmitButton('error');
        throw error;
    }
}

// Show analysis button in analytics section
function showAnalysisButton() {
    console.log('Showing analysis button...');
    
    // Hide loading and error states
    const jsonLoading = document.getElementById('jsonLoading');
    const jsonError = document.getElementById('jsonError');
    const analyticsContent = document.getElementById('analyticsContent');
    
    if (jsonLoading) jsonLoading.style.display = 'none';
    if (jsonError) jsonError.style.display = 'none';
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'analysisButtonContainer';
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0.5rem 1rem;
        text-align: center;
    `;
    
    // Create button
    const button = document.createElement('button');
    button.id = 'startAnalysisButton';
    button.className = 'neu-button neu-button-primary submit-button';
    button.textContent = 'Wanna See Some Stats??';
    
    // Add click handler
    button.addEventListener('click', handleAnalysisButtonClick);
    
    buttonContainer.appendChild(button);
    
    // Insert button container before analytics content
    const analyticsContentWrapper = document.getElementById('analyticsContentWrapper');
    if (analyticsContentWrapper && analyticsContent) {
        // Remove any existing button container
        const existingContainer = document.getElementById('analysisButtonContainer');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        analyticsContentWrapper.insertBefore(buttonContainer, analyticsContent);
    }
}

// Handle analysis button click
async function handleAnalysisButtonClick() {
    console.log('Analysis button clicked');
    
    const button = document.getElementById('startAnalysisButton');
    const buttonContainer = document.getElementById('analysisButtonContainer');
    
    if (!window.lastConsensusData) {
        console.error('No consensus data available');
        showError('No consensus data available for analysis');
        return;
    }
    
    try {
        // Disable button and show loading state
        if (button) {
            button.disabled = true;
            button.classList.add('loading-state');
            button.textContent = 'Creating Analytics...';
        }
        
        // Hide button container
        if (buttonContainer) {
            buttonContainer.style.display = 'none';
        }
        
        // Show loading state
        const jsonLoading = document.getElementById('jsonLoading');
        if (jsonLoading) {
            jsonLoading.style.display = 'block';
        }
        
        // Generate analytics
        await generateJsonVisualization(
            window.lastConsensusData.consensusText,
            window.lastConsensusData.consensusPrompt,
            window.lastConsensusData.codeMapping,
            window.lastConsensusData.userPrompt
        );
        
        // Remove button container after successful generation
        if (buttonContainer) {
            buttonContainer.remove();
        }
        
    } catch (error) {
        console.error('Analytics generation error:', error);
        
        // Re-enable button on error
        if (button) {
            button.disabled = false;
            button.classList.remove('loading-state');
            button.textContent = 'Generate Analytics';
        }
        
        // Show button container again
        if (buttonContainer) {
            buttonContainer.style.display = 'flex';
        }
        
        showError(`Analytics generation failed: ${error.message}`);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM Content Loaded ===');
    initializeApp();
});