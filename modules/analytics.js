// Analytics Module
// Handles JSON conversion, data processing, and advanced visualizations

import { CONFIG, ALL_LLMS } from './config.js';
import { 
    extractJsonFromResponse, 
    showJsonError, 
    downloadJson, 
    calculateConsensusScore,
    getConsensusIcon,
    getControversyScore,
    getHeatmapColor,
    getShortModelName,
    getAgreementColorClass,
    escapeHtml,
    getSelectedJsonModel
} from './utils.js';
import { queryOpenRouterModels, loadJsonConversionPrompt } from './api.js';
import { startJsonLoading, stopJsonLoading } from './loading.js';
import { calculateAllMetrics } from './calculations.js';
import { refreshTooltips } from './tooltip.js';

// Generate JSON visualization and analytics
export async function generateJsonVisualization(consensusText, consensusPrompt, modelCodeMapping, userPrompt = null) {
    console.log('=== Starting JSON Visualization Generation ===');
    console.log('Consensus text length:', consensusText.length);
    console.log('Model code mapping:', modelCodeMapping);
    
    // Store for diagnostics
    window.lastJsonGenerationData = {
        consensusText,
        modelCodeMapping,
        userPrompt,
        timestamp: new Date().toISOString()
    };
    
    // Store user prompt globally for display
    window.originalUserPrompt = userPrompt;
    
    startJsonLoading();
    
    try {
        // Load the JSON conversion prompt template
        const promptFile = window.jsonPromptFile || 'prompts/json-conversion-prompt-v3.txt';
        let jsonPromptTemplate = await loadJsonConversionPrompt(promptFile);
        
        // Fallback chain
        if (!jsonPromptTemplate || jsonPromptTemplate.includes('404')) {
            console.log(`${promptFile} not found, trying fallbacks...`);
            
            // Try safe format
            jsonPromptTemplate = await loadJsonConversionPrompt('prompts/json-conversion-prompt-safe.txt');
            
            if (!jsonPromptTemplate || jsonPromptTemplate.includes('404')) {
                // Try v2
                jsonPromptTemplate = await loadJsonConversionPrompt('prompts/json-conversion-prompt-v2.txt');
            }
        }
        
        // Create model code mapping string
        const mappingString = Object.entries(modelCodeMapping)
            .map(([code, name]) => `${code}: ${name}`)
            .join('\n');
        
        // Convert codenames to real model names in the consensus text
        let convertedConsensusText = consensusText;
        Object.entries(modelCodeMapping).forEach(([codename, modelName]) => {
            const escapedCodename = codename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedCodename, 'gi');
            convertedConsensusText = convertedConsensusText.replace(regex, modelName);
        });
        
        console.log('Converted codenames to real model names for JSON conversion');
        
        // Build the JSON conversion prompt with converted text
        const jsonPrompt = jsonPromptTemplate
            .replace('{{MODEL_CODE_MAPPING}}', mappingString)
            .replace('{{CONSENSUS_TEXT}}', convertedConsensusText);
        
        // Store prompt globally for display in raw data tab
        window.currentJsonPrompt = jsonPrompt;
        window.jsonConversionPrompt = jsonPrompt; // Store specifically for raw data display
        
        // Get JSON conversion model from dropdown
        const selectedJsonModelId = getSelectedJsonModel();
        console.log('Using JSON model:', selectedJsonModelId);
        
        // Find the model details from ALL_LLMS
        const jsonModelDetails = ALL_LLMS.find(m => m.id === selectedJsonModelId);
        const jsonModel = jsonModelDetails || { 
            id: selectedJsonModelId,
            name: 'GPT-4.1',
            maxContextTokens: 100000,
            maxOutputTokens: 100000
        };
        console.log(`Using ${jsonModel.name} for JSON conversion`);
        
        console.log('Querying JSON conversion model...');
        
        // Query the JSON conversion model
        console.log('Sending prompt to JSON model, length:', jsonPrompt.length);
        const result = await queryOpenRouterModels([jsonModel], jsonPrompt, null);
        
        stopJsonLoading();
        
        // Store raw response for diagnostics and raw data display
        window.lastJsonGenerationData.rawResponse = result[0]?.response;
        window.jsonConversionResponse = result[0]?.response; // Store specifically for raw data display
        console.log('Raw JSON response received, length:', result[0]?.response?.length || 0);
        
        if (!result[0] || !result[0].success) {
            const error = result[0]?.error || 'Failed to convert to JSON';
            console.error('JSON model query failed:', error);
            throw new Error(error);
        }
        
        // Extract and parse JSON
        console.log('Attempting to extract JSON from response...');
        let rawJsonData;
        
        // First, try parsing the raw response directly
        try {
            rawJsonData = JSON.parse(result[0].response);
            console.log('Direct JSON parse successful!');
            window.lastJsonGenerationData.extractedJson = rawJsonData;
        } catch (directError) {
            console.log('Direct parse failed, trying extraction...');
            
            try {
                rawJsonData = extractJsonFromResponse(result[0].response);
                window.lastJsonGenerationData.extractedJson = rawJsonData;
                console.log('JSON extraction successful');
                console.log('Extracted structure:', {
                    themes: rawJsonData.themes?.length || 0,
                    hasInsights: !!rawJsonData.insights,
                    hasModelBehavior: !!rawJsonData.modelBehavior,
                    hasConsensusFormation: !!rawJsonData.consensusFormation
                });
            } catch (extractError) {
                console.error('JSON extraction failed:', extractError);
                window.lastJsonGenerationData.extractionError = extractError.message;
                
                // Show the raw response in the UI for manual inspection
                console.log('=== RAW RESPONSE FOR DEBUGGING ===');
                console.log(result[0].response);
                console.log('=== END RAW RESPONSE ===');
                
                // Try one more time with a simple regex approach
                try {
                    const simpleExtract = result[0].response.match(/\{[\s\S]*\}/)?.[0];
                    if (simpleExtract) {
                        // Remove any problematic escape sequences
                        const cleaned = simpleExtract
                            .replace(/\\"/g, '\"')
                            .replace(/\\'/g, "'")
                            .replace(/\\n/g, ' ')
                            .replace(/\\t/g, ' ')
                            .replace(/\\r/g, '');
                        rawJsonData = JSON.parse(cleaned);
                        console.log('Simple extraction successful!');
                    } else {
                        throw extractError;
                    }
                } catch (simpleError) {
                    throw new Error(`JSON extraction failed: ${extractError.message}`);
                }
            }
        }
        
        // Validate raw JSON structure before calculations
        const validation = validateJsonStructure(rawJsonData);
        if (!validation.valid) {
            console.error('JSON validation failed:', validation.errors);
            window.lastJsonGenerationData.validationErrors = validation.errors;
            throw new Error(`Invalid JSON structure: ${validation.errors.join(', ')}`);
        }
        
        // Calculate all metrics client-side
        console.log('Starting metric calculations...');
        const jsonData = calculateAllMetrics(rawJsonData);
        window.lastJsonGenerationData.calculatedData = jsonData;
        console.log('Metrics calculated successfully');
        
        // Store globally for other functions
        window.currentJsonData = jsonData;
        
        // Display visualization
        displayJsonVisualization(jsonData, jsonPrompt);
        
        // Show analytics section
        const analyticsSection = document.getElementById('jsonVisualizationSection');
        if (analyticsSection) {
            analyticsSection.style.display = 'block';
            console.log('Analytics section made visible');
        } else {
            console.error('Analytics section not found!');
        }
        
        // Also ensure the analytics container is not collapsed
        const analyticsContainer = document.getElementById('analyticsContainer');
        if (analyticsContainer) {
            analyticsContainer.classList.remove('collapsed');
            console.log('Analytics container uncollapsed');
        }
        
        return jsonData;
        
    } catch (error) {
        console.error('=== JSON Visualization Error ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        stopJsonLoading();
        
        // Provide detailed error with diagnostic options
        const errorMessage = buildDetailedErrorMessage(error);
        showEnhancedJsonError(errorMessage, error);
        throw error;
    }
}

// Display JSON visualization with multiple views
export function displayJsonVisualization(jsonData, jsonPrompt) {
    console.log('displayJsonVisualization called with data:', jsonData);
    
    // Store globally for other functions
    window.currentJsonData = jsonData;
    window.currentJsonPrompt = jsonPrompt;
    
    // Also ensure we have the original user prompt available
    if (!window.originalUserPrompt && window.lastUserPrompt) {
        window.originalUserPrompt = window.lastUserPrompt;
    }
    
    console.log('Storing data for analytics display:', {
        hasJsonData: !!jsonData,
        jsonDataKeys: jsonData ? Object.keys(jsonData).slice(0, 5) : [],
        hasJsonPrompt: !!jsonPrompt,
        jsonPromptLength: jsonPrompt?.length || 0,
        hasOriginalUserPrompt: !!window.originalUserPrompt,
        originalUserPromptLength: window.originalUserPrompt?.length || 0
    });
    
    // Build the complete analytics HTML content
    const analyticsHTML = buildAnalyticsHTML(jsonData, jsonPrompt);
    
    // Update the analytics content directly
    const analyticsContent = document.getElementById('analyticsContent');
    if (analyticsContent) {
        analyticsContent.innerHTML = analyticsHTML;
        console.log('Analytics content updated with HTML');
        // Refresh Lucide icons after adding content
        if (window.refreshLucideIcons) {
            window.refreshLucideIcons();
        }
        // Refresh tooltips for newly added content
        refreshTooltips();
    }
    
    // Setup analytics tabs
    setupAnalyticsTabs();
    
    // Hide loading and show analytics content
    const jsonLoading = document.getElementById('jsonLoading');
    const analyticsSection = document.getElementById('jsonVisualizationSection');
    
    if (jsonLoading) {
        jsonLoading.style.display = 'none';
    }
    
    if (analyticsSection) {
        analyticsSection.style.display = 'block';
    }
    
    if (analyticsContent) {
        analyticsContent.style.display = 'block';
    }
    
    // NEW: ensure raw data textareas are populated immediately once the analytics view is built
    requestAnimationFrame(() => {
        // Populate the raw data areas so they are ready even before the user clicks the Raw Data tab
        populateRawDataTextareas();
        setupRawDataCopyButtons();
    });
    
    console.log('Analytics visualization displayed successfully');
    
    // Refresh tooltips for newly added content
    refreshTooltips();
    
    // Show the shoggoth image after analytics are complete
    const shoggothImage = document.getElementById('shoggothImage');
    if (shoggothImage) {
        shoggothImage.style.display = 'block';
    }
}

// Build complete analytics HTML content
function buildAnalyticsHTML(jsonData, jsonPrompt) {
    return `
        <!-- Main Tabs -->
        <div class="view-tabs">
            <button class="view-tab active" data-view="synthesis">Summary & Analysis</button>
            <button class="view-tab" data-view="raw">Raw Data</button>
        </div>
        
        <!-- View Containers -->
        <div class="view-container">
            <!-- Summary & Analysis View (formerly Synthesis View) -->
            <div id="synthesisView" class="view-pane active">
                <!-- Consensus Snapshot -->
                <div class="consensus-snapshot-section">
                    ${buildDashboardHTML(jsonData.summary, jsonData.aiGeneratedInsights, jsonData.consensusEvolution)}
                </div>
                
                <!-- Summary Details -->
                <details class="neu-details synthesis-details" id="synthesisDetails">
                    <summary><span><i data-lucide="clipboard"></i> Summary Details</span></summary>
                    <div class="details-content">
                        <div id="jsonVisualization">
                            ${buildSynthesisHTML(jsonData)}
                        </div>
                    </div>
                </details>
                
                <!-- Move all analytics accordions here -->
                ${buildAnalyticsViewHTML(jsonData)}
            </div>
        
            
            <!-- Raw Data View -->
            <div id="rawView" class="view-pane" style="display: none;">
                ${buildRawDataHTML(jsonData, jsonPrompt)}
            </div>
        </div>
    `;
}


// Build raw data HTML content
function buildRawDataHTML(jsonData, jsonPrompt) {
    return `
        <div class="raw-data-container">
            <!-- Input Prompt Section -->
            <div class="raw-data-section">
                <div class="raw-data-header">
                    <h4><i data-lucide="file-text"></i> JSON Conversion Prompt</h4>
                    <div class="raw-data-actions">
                        <button class="copy-button copy-prompt-btn" title="Copy Prompt">
                            <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                                <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                            </svg>
                            <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                                <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <textarea id="analyticsPromptOutput" class="raw-data-textarea" readonly placeholder="The prompt sent to the JSON conversion model will appear here..."></textarea>
            </div>
            
            <!-- Output JSON Section -->
            <div class="raw-data-section">
                <div class="raw-data-header">
                    <h4><i data-lucide="code"></i> JSON Model Response</h4>
                    <div class="raw-data-actions">
                        <button class="copy-button copy-json-btn" title="Copy JSON">
                            <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                                <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                            </svg>
                            <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                                <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                            </svg>
                        </button>
                        <button class="icon-button" onclick="window.downloadJsonData()" title="Download JSON">
                            <i data-lucide="download"></i>
                        </button>
                    </div>
                </div>
                <textarea id="analyticsJsonOutput" class="raw-data-textarea" readonly placeholder="The raw response from the JSON conversion model will appear here..."></textarea>
            </div>
        </div>
    `;
}

// Build enhanced dashboard HTML with engaging insights
function buildDashboardHTML(summary, aiInsights, consensusEvolution) {
    if (!summary) {
        return '<div style="text-align:center; padding:1rem; color:var(--neu-text-secondary);">No data available</div>';
    }

    const getStrengthIcon = (score) => {
        if (score >= 80) return '<i data-lucide="target"></i>';
        if (score >= 60) return '<i data-lucide="handshake"></i>';
        if (score >= 40) return '<i data-lucide="scale"></i>';
        return '<i data-lucide="wind"></i>';
    };

    const consensusScore = summary.consensusScore || 0;
    const reliabilityIndex = summary.reliabilityIndex || consensusScore;

    return `
        ${summary.keyFinding ? `<div class="key-finding-card">"${summary.keyFinding}"</div>` : ''}
        <div class="snapshot-grid">
            <div class="metric-card consensus-strength">
                <div class="metric-icon">${getStrengthIcon(consensusScore)}</div>
                <div class="metric-value">${consensusScore}%</div>
                <div class="metric-label">Overall Agreement</div>
            </div>
            <div class="metric-card total-themes">
                <div class="metric-icon"><i data-lucide="clipboard"></i></div>
                <div class="metric-value">${summary.totalThemes || 0}</div>
                <div class="metric-label">Topics Found</div>
            </div>
            <div class="metric-card controversy-count">
                <div class="metric-icon"><i data-lucide="flame"></i></div>
                <div class="metric-value">${summary.controversyCount || 0}</div>
                <div class="metric-label">Disagreements</div>
            </div>
            ${reliabilityIndex !== consensusScore ? `
            <div class="metric-card reliability-index">
                <div class="metric-icon"><i data-lucide="shield-check"></i></div>
                <div class="metric-value">${reliabilityIndex}%</div>
                <div class="metric-label">Complete Agreement</div>
            </div>` : ''}
            ${aiInsights?.strongestConsensus ? `
            <div class="metric-card text-card strongest-agreement">
                <div class="metric-icon"><i data-lucide="sparkles"></i></div>
                <div class="metric-value">${aiInsights.strongestConsensus}</div>
                <div class="metric-label">Most Agreed Topic</div>
            </div>` : ''}
            ${aiInsights?.biggestControversy ? `
            <div class="metric-card text-card biggest-controversy">
                <div class="metric-icon"><i data-lucide="zap"></i></div>
                <div class="metric-value">${aiInsights.biggestControversy}</div>
                <div class="metric-label">Most Debated Topic</div>
            </div>` : ''}
            ${consensusEvolution?.formationPattern ? `
            <div class="metric-card text-card formation-pattern">
                <div class="metric-icon"><i data-lucide="waves"></i></div>
                <div class="metric-value">${consensusEvolution.formationPattern}</div>
                <div class="metric-label">Formation Pattern</div>
            </div>` : ''}
        </div>
    `;
}

// Helper function to get consensus type tooltips
function getConsensusTooltip(consensusType) {
    switch (consensusType?.toLowerCase()) {
        case 'unanimous':
            return 'All models that addressed this theme agree';
        case 'majority':
            return 'More models agree than disagree';
        case 'split':
            return 'Equal numbers agree and disagree';
        case 'single':
            return 'Only one model addressed this theme';
        default:
            return 'Consensus type not determined';
    }
}

// Helper function to get user-friendly consensus type names
function getUserFriendlyConsensusType(consensusType) {
    switch (consensusType?.toLowerCase()) {
        case 'unanimous':
            return 'All Agree';
        case 'majority':
            return 'Most Agree';
        case 'split':
            return 'Mixed Views';
        case 'single':
            return 'Only One Opinion';
        default:
            return consensusType || 'Unknown';
    }
}

// Helper function to get user-friendly relationship type names
function getUserFriendlyRelationshipType(relationshipType) {
    switch (relationshipType?.toLowerCase()) {
        case 'aligned':
            return 'think alike';
        case 'opposing':
            return 'think differently';
        case 'complementary':
            return 'complement each other';
        case 'independent':
            return 'independent views';
        default:
            return relationshipType || 'unknown';
    }
}

// Helper function to get models by mention type
function getModelsByMentionType(theme, mentionType) {
    if (!theme.modelPositions) return [];
    
    return Object.entries(theme.modelPositions)
        .filter(([model, position]) => position.mentionType === mentionType)
        .map(([model]) => model);
}

// Build synthesis HTML
function buildSynthesisHTML(jsonData) {
    let html = '';
    
    // Main conclusion
    if (jsonData.summary?.mainConclusion) {
        html += `
            <div class="main-conclusion">
                <h3><i data-lucide="clipboard"></i> Main Conclusion</h3>
                <p>${jsonData.summary.mainConclusion}</p>
            </div>
        `;
    }
    
    // Key insights
    if (jsonData.keyInsights && jsonData.keyInsights.length > 0) {
        html += `
            <div class="insights-section">
                <h3 class="section-header"><i data-lucide="lightbulb"></i> Key Insights</h3>
                <ul class="insights-list">
                    ${jsonData.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // Interactive Themes Explorer
    if (jsonData.themes && jsonData.themes.length > 0) {
        html += `
            <div class="themes-explorer-section">
                <div class="themes-explorer-header">
                    <h3 class="section-header"><i data-lucide="target"></i> All Topics & Opinions</h3>
                    <div class="themes-controls">
                        <div class="themes-search">
                            <input type="text" id="themeSearch" placeholder="Search topics..." class="theme-search-input">
                        </div>
                        <div class="themes-filters">
                            <select id="themeSortBy" class="theme-filter-select" data-tooltip="Order themes by different criteria to find patterns">
                                <option value="default">Sort by Default</option>
                                <option value="consensus-strength">Agreement Level</option>
                                <option value="controversy">Disagreement Level</option>
                                <option value="impact">Impact Score</option>
                                <option value="alphabetical">Alphabetical</option>
                            </select>
                            <select id="themeFilterBy" class="theme-filter-select" data-tooltip="Show only themes matching specific consensus patterns">
                                <option value="all">All Themes</option>
                                <option value="unanimous">All Agree</option>
                                <option value="majority">Most Agree</option>
                                <option value="split">Mixed Views</option>
                                <option value="controversial">Strong Disagreement</option>
                                <option value="high-impact">Important Topics</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="themes-grid" id="themesGrid">`;
        
        jsonData.themes.forEach(theme => {
            const icon = getConsensusIcon(theme.consensusType);
            const badgeClass = theme.consensusType?.toLowerCase() || 'none';
            const impactScore = theme.impactScore || theme.importanceScore || 5;
            const controversyScore = theme.controversyScore || 0;
            const consensusStrengthScore = theme.consensusStrengthScore || 50;
            
            html += `
                <div class="theme-card" data-impact="${impactScore}" data-controversy="${controversyScore}">
                    <div class="theme-header">
                        <h4>${theme.name}</h4>
                        <div class="theme-badges">
                            <span class="consensus-badge ${badgeClass}" data-tooltip="${getConsensusTooltip(theme.consensusType)}">${icon} ${getUserFriendlyConsensusType(theme.consensusType)} <i data-lucide="help-circle" class="tooltip-icon"></i></span>
                            ${impactScore >= 8 ? '<span class="impact-badge high" data-tooltip="This theme has high importance (8+/10) based on how many models mentioned it and its significance">Important <i data-lucide="help-circle" class="tooltip-icon"></i></span>' : ''}
                            ${controversyScore >= 70 ? '<span class="controversy-badge" data-tooltip="This theme has high disagreement (70%+ controversy score) among models">Controversial <i data-lucide="help-circle" class="tooltip-icon"></i></span>' : ''}
                        </div>
                    </div>
                    <p class="theme-statement">${theme.statement}</p>
                    <div class="theme-metrics">
                        <div class="metric-bar" data-tooltip="Percentage of models that agree on this theme out of those who mentioned it">
                            <label>Agreement Level <i data-lucide="help-circle" class="tooltip-icon"></i></label>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${consensusStrengthScore}%"></div>
                            </div>
                            <span class="metric-value">${consensusStrengthScore}%</span>
                        </div>
                        <div class="metric-bar controversy-bar" data-tooltip="Percentage of models that disagree on this theme out of those who mentioned it">
                            <label>Disagreement Level <i data-lucide="help-circle" class="tooltip-icon"></i></label>
                            <div class="progress-bar">
                                <div class="progress-fill controversy" style="width: ${controversyScore}%"></div>
                            </div>
                            <span class="metric-value">${controversyScore}%</span>
                        </div>
                    </div>
                    <div class="theme-details">
                        <div class="supporting-outputs">
                            <strong>Agree:</strong> ${(theme.supportingOutputs || []).join(', ') || 'None'}
                        </div>
                        ${theme.disagreements && theme.disagreements.length > 0 ? `
                        <div class="disagreeing-outputs">
                            <strong>Disagree:</strong> ${theme.disagreements.map(d => d.output).join(', ')}
                        </div>
                        ` : ''}
                    </div>
                    ${theme.mentionMetrics ? `
                    <div class="theme-mentions">
                        <div class="mention-quality-header">
                            <strong>Mention Quality</strong>
                            <span class="coverage-badge">${theme.mentionMetrics.coverageLabel}</span>
                        </div>
                        <div class="mention-breakdown">
                            <div class="direct-mentions">
                                <i data-lucide="target" class="mention-icon"></i>
                                <strong>Direct (${theme.mentionMetrics.direct}):</strong> 
                                ${getModelsByMentionType(theme, 'direct').join(', ') || 'None'}
                            </div>
                            <div class="indirect-mentions">
                                <i data-lucide="cloud" class="mention-icon"></i>
                                <strong>Indirect (${theme.mentionMetrics.indirect}):</strong> 
                                ${getModelsByMentionType(theme, 'indirect').join(', ') || 'None'}
                            </div>
                            <div class="omitted-mentions">
                                <i data-lucide="circle" class="mention-icon"></i>
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
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    // No download button in synthesis view - moved to raw data tab
    
    return html;
}

// Build analytics view HTML
function buildAnalyticsViewHTML(jsonData) {
    return `
        <!-- Model Agreement Matrix -->
        <details class="neu-details analytics-details">
            <summary><span><i data-lucide="handshake"></i> Model Agreement Matrix</span></summary>
            <div class="details-content">
                ${buildModelAgreementMatrix(jsonData)}
            </div>
        </details>
    `;
}

// Build controversy heatmap
function buildControversyHeatmap(jsonData) {
    if (!jsonData.themes || jsonData.themes.length === 0) {
        return '<p style="text-align: center; color: #a3b3cc;">No themes available for controversy analysis.</p>';
    }
    
    let html = '<div class="controversy-heatmap">';
    
    jsonData.themes.forEach(theme => {
        const score = getControversyScore(theme);
        
        // Add icon and class based on controversy level
        let iconName = '';
        let controversyClass = '';
        if (score >= 80) {
            iconName = 'flame'; // High controversy
            controversyClass = 'high-controversy';
        } else if (score >= 60) {
            iconName = 'zap'; // Medium controversy
            controversyClass = 'medium-controversy';
        } else if (score >= 40) {
            iconName = 'message-circle'; // Low controversy
            controversyClass = 'low-controversy';
        } else {
            iconName = 'check-circle'; // Minimal controversy
            controversyClass = 'minimal-controversy';
        }
        
        const agreeCount = theme.supportingOutputs?.length || 0;
        const disagreeCount = theme.disagreements?.length || 0;
        
        html += `
            <div class="heatmap-cell ${controversyClass}">
                <div class="heatmap-cell-title">
                    <i data-lucide="${iconName}" class="controversy-icon"></i>
                    <span>${theme.name}</span>
                </div>
                
                <div class="controversy-score-section">
                    <div class="controversy-label" data-tooltip="Percentage of models that disagree with this theme">
                        Controversy Score
                    </div>
                    <div class="controversy-progress">
                        <div class="controversy-bar-container">
                            <div class="controversy-bar" style="width: ${score}%"></div>
                        </div>
                        <div class="controversy-percentage">${score}%</div>
                    </div>
                </div>
                
                <div class="heatmap-cell-details">
                    <div class="agreement-stat agree-stat">
                        <i data-lucide="check" class="agreement-icon"></i>
                        <span><strong>${agreeCount}</strong> models agree</span>
                    </div>
                    <div class="agreement-stat disagree-stat">
                        <i data-lucide="x" class="agreement-icon"></i>
                        <span><strong>${disagreeCount}</strong> models disagree</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Build model agreement matrix
function buildModelAgreementMatrix(jsonData) {
    if (!jsonData.themes || jsonData.themes.length === 0) {
        return '<p style="text-align: center; color: #a3b3cc;">No data available for agreement matrix.</p>';
    }
    
    // Extract unique models
    const allModels = new Set();
    jsonData.themes.forEach(theme => {
        theme.supportingOutputs?.forEach(output => {
            // Clean up model names - trim whitespace and filter empty
            const cleanOutput = output.trim();
            if (cleanOutput) allModels.add(cleanOutput);
        });
        theme.disagreements?.forEach(d => {
            const cleanOutput = d.output?.trim();
            if (cleanOutput) allModels.add(cleanOutput);
        });
    });
    
    const models = Array.from(allModels).sort();
    
    if (models.length < 2) {
        return '<p style="text-align: center; color: #a3b3cc;">Not enough models for agreement matrix.</p>';
    }
    
    // Helper function to get display name - use full name for clarity
    const getDisplayName = (modelName) => {
        // Just return the model name as is for clarity
        return modelName;
    };
    
    let html = `
        <div class="agreement-matrix-container">
            <p class="matrix-description">Agreement percentage between each pair of models across all themes.</p>
            <div class="agreement-matrix" style="overflow-x: auto;">
                <table class="matrix-table">
                    <tr>
                        <td class="matrix-corner"></td>
                        ${models.map(model => `<th class="matrix-header" style="white-space: nowrap; padding: 8px;">${getDisplayName(model)}</th>`).join('')}
                    </tr>
    `;
    
    models.forEach(modelA => {
        html += `<tr><th class="matrix-row-header" style="white-space: nowrap; padding: 8px;">${getDisplayName(modelA)}</th>`;
        
        models.forEach(modelB => {
            if (modelA === modelB) {
                html += '<td class="matrix-cell diagonal">—</td>';
            } else {
                const agreement = calculatePairwiseAgreement(jsonData.themes, modelA, modelB);
                const colorClass = getAgreementColorClass(agreement);
                html += `<td class="matrix-cell ${colorClass}">${agreement}%</td>`;
            }
        });
        
        html += '</tr>';
    });
    
    html += `
                </table>
            </div>
            <div class="matrix-legend" data-tooltip="Agreement levels: High (90%+) = Very similar thinking, Medium (70-89%) = Generally aligned, Low (50-69%) = Some differences, Poor (<50%) = Often disagree">
                <div class="legend-item">
                    <div class="legend-color high-agreement"></div>
                    <span>High (90%+)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color medium-agreement"></div>
                    <span>Medium (70-89%)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color low-agreement"></div>
                    <span>Low (50-69%)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color no-agreement"></div>
                    <span>Poor (<50%)</span>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

// Build comprehensive model behavior analysis
function buildModelBehaviorAnalysis(jsonData) {
    // Check both possible locations for model behavior data
    const behavior = jsonData.calculatedModelBehavior || jsonData.modelBehavior;
    
    if (!behavior) {
        console.log('No model behavior data found in:', Object.keys(jsonData));
        return '<p style="text-align: center; color: #a3b3cc;">Model behavior analysis not available.</p>';
    }
    
    console.log('Model behavior data found:', behavior);
    let html = '';
    
    // Model Profiles Section
    console.log('Building model profiles, data:', behavior.modelProfiles);
    if (behavior.modelProfiles && Object.keys(behavior.modelProfiles).length > 0) {
        html += `
            <div class="model-profiles-section">
                <h4 class="behavior-section-title"><i data-lucide="brain"></i> Individual Models</h4>
                <div class="model-profiles-grid">
        `;
        
        Object.entries(behavior.modelProfiles).forEach(([modelName, profile]) => {
            const trustScore = profile.trustScore || 50;
            const agreementScore = profile.agreementScore || 50;
            const divergenceScore = profile.divergenceScore || 50;
            const uniqueContributions = profile.uniqueContributions || 0;
            const responseStyle = profile.responseStyle || 'balanced';
            const signatureMoves = profile.signatureMoves || [];
            
            // Try to get the actual unique contributions from the raw data
            const actualUniqueContributions = behavior.modelProfiles[modelName]?.actualUniqueContributions || 
                                            (jsonData.modelBehavior && jsonData.modelBehavior[modelName]?.uniqueContributions) || 
                                            [];
            
            // Get style icon and color
            const getStyleIcon = (style) => {
                switch (style) {
                    case 'concise': return '<i data-lucide="zap"></i>';
                    case 'detailed': return '<i data-lucide="file-text"></i>';
                    case 'creative': return '<i data-lucide="palette"></i>';
                    case 'analytical': return '<i data-lucide="flask-conical"></i>';
                    case 'balanced': return '<i data-lucide="scale"></i>';
                    default: return '<i data-lucide="bot"></i>';
                }
            };
            
            const getResponseStyleDescription = (style) => {
                switch (style) {
                    case 'concise': return 'Brief, to-the-point responses';
                    case 'detailed': return 'Comprehensive, thorough responses';
                    case 'creative': return 'Novel, imaginative approaches';
                    case 'analytical': return 'Data-driven, systematic responses';
                    case 'balanced': return 'Mix of different response styles';
                    default: return 'Response style not categorized';
                }
            };
            
            const getTrustClass = (score) => {
                if (score >= 80) return 'high-trust';
                if (score >= 60) return 'medium-trust';
                return 'low-trust';
            };
            
            html += `
                <div class="model-profile-card ${getTrustClass(trustScore)}">
                    <div class="model-profile-header">
                        <h5>${modelName}</h5>
                        <div class="response-style-badge" data-tooltip="Response style: ${getResponseStyleDescription(responseStyle)}">
                            ${getStyleIcon(responseStyle)} ${responseStyle}
                        </div>
                    </div>
                    
                    <div class="model-metrics">
                        <div class="metric-row" data-tooltip="Trust Score = (Agreement Rate × 70%) + (Coverage × 30%)\nMeasures overall reliability based on consensus alignment and topic coverage">
                            <span class="metric-label">Reliability Score <i data-lucide="help-circle" class="tooltip-icon"></i></span>
                            <div class="metric-bar-container">
                                <div class="metric-progress-bar">
                                    <div class="metric-fill trust" style="width: ${trustScore}%"></div>
                                </div>
                                <span class="metric-score">${trustScore}%</span>
                            </div>
                        </div>
                        
                        <div class="metric-row" data-tooltip="Agreement Rate = (Times Agreed / Times Mentioned) × 100%\nHow often this model agrees with consensus when it addresses a topic">
                            <span class="metric-label">Agrees With Others <i data-lucide="help-circle" class="tooltip-icon"></i></span>
                            <div class="metric-bar-container">
                                <div class="metric-progress-bar">
                                    <div class="metric-fill agreement" style="width: ${agreementScore}%"></div>
                                </div>
                                <span class="metric-score">${agreementScore}%</span>
                            </div>
                        </div>
                        
                        <div class="metric-row" data-tooltip="Divergence Score = 100% - Agreement Rate\nHow often this model offers contrarian or unique perspectives">
                            <span class="metric-label">Unique Opinions <i data-lucide="help-circle" class="tooltip-icon"></i></span>
                            <div class="metric-bar-container">
                                <div class="metric-progress-bar">
                                    <div class="metric-fill divergence" style="width: ${divergenceScore}%"></div>
                                </div>
                                <span class="metric-score">${divergenceScore}%</span>
                            </div>
                        </div>
                        
                        ${uniqueContributions > 0 ? `
                        <div class="unique-contributions" data-tooltip="Number of insights only this model provided">
                            <span class="contributions-badge"><i data-lucide="lightbulb"></i> ${uniqueContributions} unique ${uniqueContributions === 1 ? 'insight' : 'insights'}</span>
                            ${actualUniqueContributions.length > 0 ? `
                            <ul class="unique-insights-list">
                                ${actualUniqueContributions.map(insight => `<li>${insight}</li>`).join('')}
                            </ul>
                            ` : ''}
                        </div>
                        ` : ''}
                    </div>
                    
                    ${signatureMoves.length > 0 ? `
                    <div class="signature-moves" data-tooltip="Recurring behavioral patterns observed in this model's responses">
                        <h6>Typical Behavior:</h6>
                        <ul class="moves-list">
                            ${signatureMoves.map(move => `<li>${move}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Model Relationships Section
    console.log('Building model relationships, data:', behavior.modelRelationships);
    if (behavior.modelRelationships && behavior.modelRelationships.length > 0) {
        html += `
            <div class="model-relationships-section">
                <h4 class="behavior-section-title"><i data-lucide="handshake"></i> Model Similarities</h4>
                <div class="relationships-grid">
        `;
        
        behavior.modelRelationships.forEach(relationship => {
            const { modelA, modelB, agreementPercentage, relationshipType } = relationship;
            
            const getRelationshipIcon = (type) => {
                switch (type) {
                    case 'aligned': return '<i data-lucide="handshake"></i>';
                    case 'complementary': return '<i data-lucide="refresh-cw"></i>';
                    case 'opposing': return '<i data-lucide="swords"></i>';
                    case 'independent': return '<i data-lucide="user"></i>';
                    default: return '<i data-lucide="link"></i>';
                }
            };
            
            const getRelationshipTooltip = (type) => {
                switch (type) {
                    case 'aligned': return 'These models agree 80%+ of the time';
                    case 'complementary': return 'These models agree 60-79% of the time';
                    case 'opposing': return 'These models agree less than 40% of the time';
                    case 'independent': return 'These models have different focuses (40-60% agreement)';
                    default: return 'Relationship type not determined';
                }
            };
            
            const getRelationshipClass = (percentage) => {
                if (percentage >= 80) return 'strong-relationship';
                if (percentage >= 60) return 'moderate-relationship';
                return 'weak-relationship';
            };
            
            html += `
                <div class="relationship-card ${getRelationshipClass(agreementPercentage)}">
                    <div class="relationship-header">
                        <span class="model-name">${modelA}</span>
                        <div class="relationship-indicator" data-tooltip="${getRelationshipTooltip(relationshipType)}">
                            ${getRelationshipIcon(relationshipType)}
                            <span class="relationship-type">${getUserFriendlyRelationshipType(relationshipType)} <i data-lucide="help-circle" class="tooltip-icon"></i></span>
                        </div>
                        <span class="model-name">${modelB}</span>
                    </div>
                    <div class="agreement-percentage">
                        ${agreementPercentage}% agreement
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Summary Cards Section (existing functionality)
    html += '<div class="behavior-summary-cards">';
    
    if (behavior.mostAgreeable && behavior.mostAgreeable.length > 0) {
        html += `
            <div class="behavior-card neu-outset-sm">
                <h4><i data-lucide="trophy"></i> Models Matching Group Opinion</h4>
                <p>Models that consistently align with consensus:</p>
                <ul>
                    ${behavior.mostAgreeable.map(model => `<li>${model}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    if (behavior.mostDivergent && behavior.mostDivergent.length > 0) {
        html += `
            <div class="behavior-card neu-outset-sm">
                <h4><i data-lucide="lightbulb"></i> Models With Unique Views</h4>
                <p>Models that provide unique perspectives:</p>
                <ul>
                    ${behavior.mostDivergent.map(model => `<li>${model}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    if (behavior.patterns && Object.keys(behavior.patterns).length > 0) {
        html += `
            <div class="behavior-card neu-outset-sm">
                <h4><i data-lucide="bar-chart-3"></i> Behavioral Patterns</h4>
                <ul>
                    ${Object.entries(behavior.patterns).map(([pattern, description]) => 
                        `<li><strong>${pattern}:</strong> ${description}</li>`
                    ).join('')}
                </ul>
            </div>
        `;
    }
    
    html += '</div>';
    
    // If no content was generated, show a message
    if (html === '<div class="behavior-summary-cards"></div>') {
        console.log('No model behavior content generated');
        return `
            <div class="behavior-summary-cards">
                <div class="behavior-card neu-outset-sm">
                    <h4><i data-lucide="info"></i> Model Behavior Analysis</h4>
                    <p>Model behavior data is being calculated. Available data:</p>
                    <ul>
                        <li>Model profiles: ${behavior.modelProfiles ? Object.keys(behavior.modelProfiles).length : 0}</li>
                        <li>Model relationships: ${behavior.modelRelationships?.length || 0}</li>
                        <li>Most agreeable: ${behavior.mostAgreeable?.length || 0}</li>
                        <li>Most divergent: ${behavior.mostDivergent?.length || 0}</li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    console.log('Model behavior HTML length:', html.length);
    return html;
}

// Build consensus flow visualization
function buildConsensusFlow(jsonData) {
    if (!jsonData.themes || jsonData.themes.length === 0) {
        return '<p style="text-align: center; color: #a3b3cc;">No themes available for consensus flow.</p>';
    }
    
    // Group themes by consensus type
    const themesByType = {
        unanimous: [],
        majority: [],
        split: [],
        single: []
    };
    
    jsonData.themes.forEach(theme => {
        const type = theme.consensusType?.toLowerCase() || 'none';
        if (type in themesByType) {
            themesByType[type].push(theme);
        }
    });
    
    const total = jsonData.themes.length;
    
    return `
        <div class="consensus-flow-container">
            <h3>How Agreement Was Reached</h3>
            <p class="flow-description">How themes achieved different levels of consensus:</p>
            
            <div class="flow-stats-grid">
                <div class="flow-stat-card unanimous" data-tooltip="Themes where all models agree - strongest form of consensus">
                    <div class="flow-icon"><i data-lucide="target"></i></div>
                    <div class="flow-numbers">
                        <span class="stat-number">${themesByType.unanimous.length}</span>
                        <span class="stat-percentage">${Math.round((themesByType.unanimous.length / total) * 100)}%</span>
                    </div>
                    <div class="stat-label">All Agreed <i data-lucide="help-circle" class="tooltip-icon"></i></div>
                    ${themesByType.unanimous.length > 0 ? `
                        <div class="theme-examples">
                            ${themesByType.unanimous.slice(0, 2).map(t => `<div class="theme-example">• ${t.name}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="flow-stat-card majority" data-tooltip="Themes where most (but not all) models agree">
                    <div class="flow-icon"><i data-lucide="handshake"></i></div>
                    <div class="flow-numbers">
                        <span class="stat-number">${themesByType.majority.length}</span>
                        <span class="stat-percentage">${Math.round((themesByType.majority.length / total) * 100)}%</span>
                    </div>
                    <div class="stat-label">Most Agreed <i data-lucide="help-circle" class="tooltip-icon"></i></div>
                    ${themesByType.majority.length > 0 ? `
                        <div class="theme-examples">
                            ${themesByType.majority.slice(0, 2).map(t => `<div class="theme-example">• ${t.name}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="flow-stat-card split" data-tooltip="Themes where models are evenly divided in their positions">
                    <div class="flow-icon"><i data-lucide="scale"></i></div>
                    <div class="flow-numbers">
                        <span class="stat-number">${themesByType.split.length}</span>
                        <span class="stat-percentage">${Math.round((themesByType.split.length / total) * 100)}%</span>
                    </div>
                    <div class="stat-label">Mixed Views <i data-lucide="help-circle" class="tooltip-icon"></i></div>
                    ${themesByType.split.length > 0 ? `
                        <div class="theme-examples">
                            ${themesByType.split.slice(0, 2).map(t => `<div class="theme-example">• ${t.name}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="flow-stat-card single" data-tooltip="Themes mentioned by only one model - unique perspectives">
                    <div class="flow-icon"><i data-lucide="lightbulb"></i></div>
                    <div class="flow-numbers">
                        <span class="stat-number">${themesByType.single.length}</span>
                        <span class="stat-percentage">${Math.round((themesByType.single.length / total) * 100)}%</span>
                    </div>
                    <div class="stat-label">Only One Opinion <i data-lucide="help-circle" class="tooltip-icon"></i></div>
                    ${themesByType.single.length > 0 ? `
                        <div class="theme-examples">
                            ${themesByType.single.slice(0, 2).map(t => `<div class="theme-example">• ${t.name}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Calculate pairwise agreement between two models
function calculatePairwiseAgreement(themes, modelA, modelB) {
    let agreements = 0;
    let comparisons = 0;
    
    themes.forEach(theme => {
        const aSupports = theme.supportingOutputs?.includes(modelA) || false;
        const bSupports = theme.supportingOutputs?.includes(modelB) || false;
        
        const aDisagrees = theme.disagreements?.some(d => d.output === modelA) || false;
        const bDisagrees = theme.disagreements?.some(d => d.output === modelB) || false;
        
        if ((aSupports || aDisagrees) && (bSupports || bDisagrees)) {
            comparisons++;
            if (aSupports === bSupports) {
                agreements++;
            }
        }
    });
    
    return comparisons > 0 ? Math.round((agreements / comparisons) * 100) : 0;
}

// Simplified module - old complex functions removed

// Retry JSON conversion function
export async function retryJsonConversion(useSafeFormat = false) {
    if (!window.currentConsensusText || !window.currentJsonPrompt) {
        console.error('No consensus text or JSON prompt available for retry');
        return;
    }
    
    try {
        // If safe format requested, temporarily change the prompt file
        const originalPromptFile = window.jsonPromptFile;
        if (useSafeFormat) {
            window.jsonPromptFile = 'json-conversion-prompt-safe.txt';
        }
        
        await generateJsonVisualization(
            window.currentConsensusText, 
            window.currentConsensusPrompt, 
            window.modelCodeMapping
        );
        
        // Restore original
        if (useSafeFormat) {
            window.jsonPromptFile = originalPromptFile;
        }
    } catch (error) {
        console.error('Retry failed:', error);
        
        // If regular retry failed, offer safe format
        if (!useSafeFormat) {
            if (confirm('Regular format failed. Try with simplified safe format?')) {
                retryJsonConversion(true);
            }
        }
    }
}

// Setup analytics tabs functionality
function setupAnalyticsTabs() {
    // Setup main view tabs
    const viewTabs = document.querySelectorAll('.view-tab');
    const viewPanes = document.querySelectorAll('.view-pane');
    
    console.log('Setting up analytics tabs, found:', viewTabs.length, 'tabs and', viewPanes.length, 'panes');
    
    viewTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetView = tab.dataset.view;
            console.log('Tab clicked:', targetView);
            
            // Update tab states
            viewTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update pane visibility
            viewPanes.forEach(pane => {
                if (pane.id === `${targetView}View`) {
                    pane.classList.add('active');
                    pane.style.display = 'block';
                    console.log('Showing pane:', pane.id);
                    
                    // Refresh Lucide icons when analytics view is shown
                    if (targetView === 'analytics') {
                        console.log('Analytics view selected, refreshing Lucide icons');
                        // Use requestAnimationFrame to ensure DOM is updated before creating icons
                        requestAnimationFrame(() => {
                            if (window.refreshLucideIcons) {
                                window.refreshLucideIcons();
                            }
                        });
                    }
                    
                    // Load info content when info tab is selected
                    if (targetView === 'info') {
                        console.log('Loading info content');
                        loadAnalyticsInfo();
                    }
                    // Populate raw data when raw tab is selected
                    if (targetView === 'raw') {
                        console.log('Raw tab selected, refreshing content...');
                        
                        // Force refresh of the raw data content
                        const rawDataView = document.getElementById('rawView');
                        if (rawDataView) {
                            console.log('Raw data view found, checking content...');
                            // Check if content exists
                            if (!rawDataView.innerHTML || rawDataView.innerHTML.trim() === '') {
                                console.log('Raw data view is empty, rebuilding...');
                                // Rebuild the content if it's empty
                                if (window.currentJsonData) {
                                    rawDataView.innerHTML = buildRawDataHTML(window.currentJsonData, window.currentJsonPrompt);
                                }
                            }
                            
                            // Use requestAnimationFrame to ensure DOM is ready
                            requestAnimationFrame(() => {
                                // Refresh Lucide icons
                                if (window.refreshLucideIcons) {
                                    window.refreshLucideIcons();
                                }
                                
                                // Additional frame to ensure icons are rendered
                                requestAnimationFrame(() => {
                                    console.log('Populating raw data textareas after DOM update...');
                                    
                                    // Double-check that elements exist before populating
                                    const jsonTextarea = document.getElementById('analyticsJsonOutput');
                                    const promptTextarea = document.getElementById('analyticsPromptOutput');
                                    
                                    if (!jsonTextarea || !promptTextarea) {
                                        console.error('Textareas still not found after DOM update!', {
                                            jsonTextarea: !!jsonTextarea,
                                            promptTextarea: !!promptTextarea
                                        });
                                        // Try rebuilding the content
                                        if (window.currentJsonData || window.currentJsonPrompt) {
                                            console.log('Rebuilding raw data view content...');
                                            rawDataView.innerHTML = buildRawDataHTML(window.currentJsonData, window.currentJsonPrompt);
                                            // Try again after rebuild
                                            requestAnimationFrame(() => {
                                                populateRawDataTextareas();
                                                setupRawDataCopyButtons();
                                            });
                                            return;
                                        }
                                    }
                                    
                                    populateRawDataTextareas();
                                    setupRawDataCopyButtons();
                                });
                            });
                        } else {
                            console.error('Raw data view element not found!');
                        }
                    }
                } else {
                    pane.classList.remove('active');
                    pane.style.display = 'none';
                }
            });
        });
    });
    
    // No longer need raw data tabs since we show both sections at once
    
    // Don't populate immediately - wait for the raw tab to be clicked
    // This avoids issues with elements not being in the DOM yet
    console.log('Analytics tabs setup complete, raw data will populate when tab is clicked');
}

// Function to populate raw data textareas
function populateRawDataTextareas() {
    console.log('Populating raw data textareas...');
    
    const jsonTextarea = document.getElementById('analyticsJsonOutput');
    const promptTextarea = document.getElementById('analyticsPromptOutput');
    
    console.log('Found textareas:', {
        jsonTextarea: !!jsonTextarea,
        jsonTextareaId: jsonTextarea?.id,
        promptTextarea: !!promptTextarea,
        promptTextareaId: promptTextarea?.id,
        hasJsonData: !!window.currentJsonData,
        jsonDataKeys: window.currentJsonData ? Object.keys(window.currentJsonData).slice(0, 5) : 'none',
        hasUserPrompt: !!window.originalUserPrompt,
        userPromptLength: window.originalUserPrompt?.length || 0,
        hasJsonPrompt: !!window.currentJsonPrompt,
        jsonPromptLength: window.currentJsonPrompt?.length || 0
    });
    
    if (jsonTextarea) {
        // First priority: show the raw JSON response from the conversion
        if (window.jsonConversionResponse) {
            jsonTextarea.value = window.jsonConversionResponse;
            console.log('JSON textarea populated with raw response, length:', jsonTextarea.value.length);
        } else if (window.currentJsonData) {
            // Fallback: show the parsed JSON data
            try {
                const jsonString = JSON.stringify(window.currentJsonData, null, 2);
                jsonTextarea.value = jsonString;
                console.log('JSON textarea populated with parsed data, length:', jsonString.length);
            } catch (err) {
                console.error('Error stringifying JSON data:', err);
                jsonTextarea.value = 'Error converting JSON data: ' + err.message;
            }
        } else {
            jsonTextarea.value = 'No JSON data available yet.';
            console.log('No JSON data to display');
        }
        
        // Force a style update to ensure visibility
        jsonTextarea.style.display = 'block';
        jsonTextarea.style.visibility = 'visible';
    } else {
        console.error('JSON textarea not found in DOM!');
    }
    
    if (promptTextarea) {
        // Show the JSON conversion prompt that was sent to the model
        if (window.jsonConversionPrompt) {
            promptTextarea.value = window.jsonConversionPrompt;
            console.log('Prompt textarea populated with JSON conversion prompt, length:', promptTextarea.value.length);
        } else if (window.currentJsonPrompt) {
            // Fallback to currentJsonPrompt
            promptTextarea.value = window.currentJsonPrompt;
            console.log('Prompt textarea populated with current JSON prompt');
        } else {
            promptTextarea.value = 'No prompt data available yet.';
            console.log('No prompt data to display');
        }
        
        // Force a style update to ensure visibility
        promptTextarea.style.display = 'block';
        promptTextarea.style.visibility = 'visible';
    } else {
        console.error('Prompt textarea not found in DOM!');
    }
    
    // Debug: Check if textareas are actually visible
    if (jsonTextarea) {
        const jsonRect = jsonTextarea.getBoundingClientRect();
        console.log('JSON textarea visibility:', {
            width: jsonRect.width,
            height: jsonRect.height,
            visible: jsonRect.width > 0 && jsonRect.height > 0,
            computedDisplay: window.getComputedStyle(jsonTextarea).display,
            computedVisibility: window.getComputedStyle(jsonTextarea).visibility
        });
    }
}

// Store copy button handlers to avoid duplicate listeners
let copyJsonHandler = null;
let copyPromptHandler = null;

// Function to setup copy button handlers
function setupRawDataCopyButtons() {
    const copyJsonBtn = document.querySelector('.copy-json-btn');
    const copyPromptBtn = document.querySelector('.copy-prompt-btn');
    
    // Remove existing handlers if they exist
    if (copyJsonBtn && copyJsonHandler) {
        copyJsonBtn.removeEventListener('click', copyJsonHandler);
    }
    if (copyPromptBtn && copyPromptHandler) {
        copyPromptBtn.removeEventListener('click', copyPromptHandler);
    }
    
    // Define new handlers
    copyJsonHandler = () => {
        const jsonTextarea = document.getElementById('analyticsJsonOutput');
        if (jsonTextarea && jsonTextarea.value && jsonTextarea.value !== 'No JSON data available yet.') {
            window.copyText(jsonTextarea.value, copyJsonBtn);
        }
    };
    
    copyPromptHandler = () => {
        const promptTextarea = document.getElementById('analyticsPromptOutput');
        if (promptTextarea && promptTextarea.value && promptTextarea.value !== 'No prompt data available yet.') {
            window.copyText(promptTextarea.value, copyPromptBtn);
        }
    };
    
    // Add new handlers
    if (copyJsonBtn) {
        copyJsonBtn.addEventListener('click', copyJsonHandler);
    }
    
    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', copyPromptHandler);
    }
}

// Interactive Theme Explorer Functions
function setupThemeExplorer() {
    const searchInput = document.getElementById('themeSearch');
    const sortSelect = document.getElementById('themeSortBy');
    const filterSelect = document.getElementById('themeFilterBy');
    
    if (!searchInput || !sortSelect || !filterSelect) return;
    
    // Store original themes data
    if (!window.currentThemesData && window.currentJsonData?.themes) {
        window.currentThemesData = [...window.currentJsonData.themes];
    }
    
    // Event listeners
    searchInput.addEventListener('input', filterAndSortThemes);
    sortSelect.addEventListener('change', filterAndSortThemes);
    filterSelect.addEventListener('change', filterAndSortThemes);
    
    console.log('Theme explorer controls initialized');
}

function filterAndSortThemes() {
    if (!window.currentThemesData) return;
    
    const searchTerm = document.getElementById('themeSearch')?.value.toLowerCase() || '';
    const sortBy = document.getElementById('themeSortBy')?.value || 'default';
    const filterBy = document.getElementById('themeFilterBy')?.value || 'all';
    
    let filteredThemes = [...window.currentThemesData];
    
    // Apply search filter
    if (searchTerm) {
        filteredThemes = filteredThemes.filter(theme => 
            theme.name.toLowerCase().includes(searchTerm) ||
            theme.statement.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply type filter
    if (filterBy !== 'all') {
        filteredThemes = filteredThemes.filter(theme => {
            switch (filterBy) {
                case 'unanimous':
                    return theme.consensusType?.toLowerCase() === 'unanimous';
                case 'majority':
                    return theme.consensusType?.toLowerCase() === 'majority';
                case 'split':
                    return theme.consensusType?.toLowerCase() === 'split';
                case 'controversial':
                    return (theme.controversyScore || 0) >= 70;
                case 'high-impact':
                    return (theme.impactScore || theme.importanceScore || 0) >= 8;
                default:
                    return true;
            }
        });
    }
    
    // Apply sorting
    if (sortBy !== 'default') {
        filteredThemes.sort((a, b) => {
            switch (sortBy) {
                case 'consensus-strength':
                    return (b.consensusStrengthScore || 50) - (a.consensusStrengthScore || 50);
                case 'controversy':
                    return (b.controversyScore || 0) - (a.controversyScore || 0);
                case 'impact':
                    return (b.impactScore || b.importanceScore || 0) - (a.impactScore || a.importanceScore || 0);
                case 'alphabetical':
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });
    }
    
    // Update display
    updateThemesDisplay(filteredThemes);
    updateThemesSummary(filteredThemes.length, window.currentThemesData.length, searchTerm, filterBy);
}

function updateThemesDisplay(themes) {
    const themesGrid = document.getElementById('themesGrid');
    if (!themesGrid) return;
    
    if (themes.length === 0) {
        themesGrid.innerHTML = `
            <div class="no-themes-found">
                <div class="no-themes-icon"><i data-lucide="search"></i></div>
                <p>No themes match your current filters.</p>
                <button class="neu-button" onclick="clearThemeFilters()">Clear Filters</button>
            </div>
        `;
        // Refresh Lucide icons after adding content
        if (window.refreshLucideIcons) {
            window.refreshLucideIcons();
        }
        return;
    }
    
    let html = '';
    themes.forEach(theme => {
        const icon = getConsensusIcon(theme.consensusType);
        const badgeClass = theme.consensusType?.toLowerCase() || 'none';
        const impactScore = theme.impactScore || theme.importanceScore || 5;
        const controversyScore = theme.controversyScore || 0;
        const consensusStrengthScore = theme.consensusStrengthScore || 50;
        
        html += `
            <div class="theme-card" data-impact="${impactScore}" data-controversy="${controversyScore}">
                <div class="theme-header">
                    <h4>${theme.name}</h4>
                    <div class="theme-badges">
                        <span class="consensus-badge ${badgeClass}" data-tooltip="${getConsensusTooltip(theme.consensusType)}">${icon} ${theme.consensusType || 'Unknown'} <i data-lucide="help-circle" class="tooltip-icon"></i></span>
                        ${impactScore >= 8 ? '<span class="impact-badge high" data-tooltip="This theme has high importance (8+/10) based on how many models mentioned it and its significance">High Impact <i data-lucide="help-circle" class="tooltip-icon"></i></span>' : ''}
                        ${controversyScore >= 70 ? '<span class="controversy-badge" data-tooltip="This theme has high disagreement (70%+ controversy score) among models">Controversial <i data-lucide="help-circle" class="tooltip-icon"></i></span>' : ''}
                    </div>
                </div>
                <p class="theme-statement">${theme.statement}</p>
                <div class="theme-metrics">
                    <div class="metric-bar" data-tooltip="Percentage of models that agree on this theme out of those who mentioned it">
                        <label>Consensus Strength <i data-lucide="help-circle" class="tooltip-icon"></i></label>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${consensusStrengthScore}%"></div>
                        </div>
                        <span class="metric-value">${consensusStrengthScore}%</span>
                    </div>
                    ${controversyScore > 0 ? `
                    <div class="metric-bar controversy-bar" data-tooltip="Percentage of models that disagree on this theme out of those who mentioned it">
                        <label>Controversy Level <i data-lucide="help-circle" class="tooltip-icon"></i></label>
                        <div class="progress-bar">
                            <div class="progress-fill controversy" style="width: ${controversyScore}%"></div>
                        </div>
                        <span class="metric-value">${controversyScore}%</span>
                    </div>
                    ` : ''}
                </div>
                <div class="theme-details">
                    <div class="supporting-outputs">
                        <strong>Supporting:</strong> ${(theme.supportingOutputs || []).join(', ') || 'None'}
                    </div>
                    ${theme.disagreements && theme.disagreements.length > 0 ? `
                    <div class="disagreeing-outputs">
                        <strong>Disagreeing:</strong> ${theme.disagreements.map(d => d.output).join(', ')}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    themesGrid.innerHTML = html;
    // Refresh Lucide icons after adding content
    if (window.refreshLucideIcons) {
        window.refreshLucideIcons();
    }
}

function updateThemesSummary(shown, total, searchTerm, filterBy) {
    const summary = document.getElementById('themesSummary');
    if (!summary) return;
    
    let text = `Showing ${shown} of ${total} themes`;
    
    if (searchTerm) {
        text += ` matching "${searchTerm}"`;
    }
    
    if (filterBy !== 'all') {
        const filterLabels = {
            'unanimous': 'unanimous',
            'majority': 'majority',
            'split': 'split opinion',
            'controversial': 'controversial',
            'high-impact': 'high impact'
        };
        text += ` filtered by ${filterLabels[filterBy] || filterBy}`;
    }
    
    summary.textContent = text;
}

function clearThemeFilters() {
    document.getElementById('themeSearch').value = '';
    document.getElementById('themeSortBy').value = 'default';
    document.getElementById('themeFilterBy').value = 'all';
    filterAndSortThemes();
}

// Update the setupAnalyticsTabs function to include theme explorer setup
const originalSetupAnalyticsTabs = setupAnalyticsTabs;
function enhancedSetupAnalyticsTabs() {
    originalSetupAnalyticsTabs();
    
    // Add theme explorer setup
    setTimeout(() => {
        setupThemeExplorer();
        // Refresh icons after theme explorer is set up
        if (window.refreshLucideIcons) {
            window.refreshLucideIcons();
        }
    }, 100);
}

// Replace the original function
setupAnalyticsTabs = enhancedSetupAnalyticsTabs;

// Validate JSON structure
function validateJsonStructure(data) {
    const errors = [];
    
    // Check required top-level fields
    if (!data.themes || !Array.isArray(data.themes)) {
        errors.push('Missing or invalid "themes" array');
    }
    
    // Validate each theme
    if (data.themes && Array.isArray(data.themes)) {
        data.themes.forEach((theme, index) => {
            if (!theme.name) errors.push(`Theme ${index + 1}: missing name`);
            if (!theme.statement) errors.push(`Theme ${index + 1}: missing statement`);
            if (!theme.modelPositions || typeof theme.modelPositions !== 'object') {
                errors.push(`Theme ${index + 1}: missing or invalid modelPositions`);
            }
        });
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// Build detailed error message
function buildDetailedErrorMessage(error) {
    let message = `<div class="json-error-details">
        <h4>JSON Generation Failed</h4>
        <p class="error-summary">${error.message}</p>
    `;
    
    if (window.lastJsonGenerationData) {
        const data = window.lastJsonGenerationData;
        
        if (data.rawResponse) {
            message += `
        <details class="error-diagnostic">
            <summary>View Raw Response</summary>
            <textarea readonly class="raw-response-viewer">${data.rawResponse.substring(0, 1000)}${data.rawResponse.length > 1000 ? '...' : ''}</textarea>
        </details>`;
        }
        
        if (data.validationErrors) {
            message += `
        <details class="error-diagnostic">
            <summary>Validation Errors (${data.validationErrors.length})</summary>
            <ul class="validation-errors">
                ${data.validationErrors.map(e => `<li>${e}</li>`).join('')}
            </ul>
        </details>`;
        }
    }
    
    message += `
        <div class="error-actions">
            <button class="neu-button" onclick="window.retryJsonConversion()">Retry (Regular)</button>
            <button class="neu-button" onclick="window.retryJsonConversion(true)">Retry (Safe Format)</button>
            <button class="neu-button" onclick="window.showJsonDiagnostics()">Show Diagnostics</button>
            <button class="neu-button" onclick="window.manualJsonFix()">Manual Fix</button>
        </div>
        <div class="error-tips" style="margin-top: 1rem; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px;">
            <strong>Tips:</strong>
            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                <li>Try "Retry (Safe Format)" for a simpler JSON structure</li>
                <li>Use "Manual Fix" to edit the JSON directly</li>
                <li>Check "Show Diagnostics" to see the raw response</li>
            </ul>
        </div>
    </div>`;
    
    return message;
}

// Enhanced error display
function showEnhancedJsonError(message, error) {
    const errorElement = document.getElementById('jsonError');
    if (errorElement) {
        errorElement.innerHTML = message;
        errorElement.style.display = 'block';
        errorElement.classList.add('enhanced-error');
    }
    
    // Also show in analytics content area
    const analyticsContent = document.getElementById('analyticsContent');
    if (analyticsContent) {
        analyticsContent.innerHTML = `
            <div class="json-generation-error">
                ${message}
            </div>
        `;
        analyticsContent.style.display = 'block';
    }
}

// Show diagnostics window
window.showJsonDiagnostics = function() {
    const data = window.lastJsonGenerationData;
    if (!data) {
        alert('No diagnostic data available');
        return;
    }
    
    const diagnosticHtml = `
        <div class="diagnostics-window">
            <h3>JSON Generation Diagnostics</h3>
            <div class="diagnostic-section">
                <h4>Generation Info</h4>
                <p>Timestamp: ${data.timestamp}</p>
                <p>Consensus Length: ${data.consensusText?.length || 0} chars</p>
                <p>Model Count: ${Object.keys(data.modelCodeMapping || {}).length}</p>
            </div>
            
            <div class="diagnostic-section">
                <h4>Raw Response</h4>
                <textarea class="diagnostic-textarea" readonly>${data.rawResponse || 'No response captured'}</textarea>
            </div>
            
            <div class="diagnostic-section">
                <h4>Extraction Result</h4>
                <textarea class="diagnostic-textarea" readonly>${data.extractedJson ? JSON.stringify(data.extractedJson, null, 2) : 'Extraction failed'}</textarea>
            </div>
            
            <div class="diagnostic-section">
                <h4>Actions</h4>
                <button onclick="window.copyDiagnostics()" class="icon-button" title="Copy Diagnostics">
                    <i data-lucide="clipboard"></i>
                </button>
                <button onclick="window.downloadDiagnostics()" class="icon-button" title="Download Report">
                    <i data-lucide="download"></i>
                </button>
            </div>
        </div>
    `;
    
    // Create modal or replace content
    const analyticsContent = document.getElementById('analyticsContent');
    if (analyticsContent) {
        analyticsContent.innerHTML = diagnosticHtml;
    }
};

// Manual JSON fix interface
window.manualJsonFix = function() {
    const data = window.lastJsonGenerationData;
    const rawResponse = data?.rawResponse || '';
    
    const editorHtml = `
        <div class="json-editor-window">
            <h3>Manual JSON Editor</h3>
            <p>Edit the JSON below to fix any issues, then click "Apply Fix"</p>
            
            <div class="editor-section">
                <h4>Raw Response</h4>
                <textarea id="jsonEditorInput" class="json-editor-textarea">${rawResponse}</textarea>
            </div>
            
            <div class="editor-validation" id="editorValidation"></div>
            
            <div class="editor-actions">
                <button onclick="window.validateManualJson()" class="neu-button">Validate</button>
                <button onclick="window.applyManualFix()" class="neu-button primary">Apply Fix</button>
                <button onclick="window.retryJsonConversion()" class="neu-button">Cancel</button>
            </div>
        </div>
    `;
    
    const analyticsContent = document.getElementById('analyticsContent');
    if (analyticsContent) {
        analyticsContent.innerHTML = editorHtml;
    }
};

// Apply manual JSON fix
window.applyManualFix = async function() {
    const textarea = document.getElementById('jsonEditorInput');
    if (!textarea) return;
    
    try {
        const rawJsonData = extractJsonFromResponse(textarea.value);
        const validation = validateJsonStructure(rawJsonData);
        
        if (!validation.valid) {
            alert('JSON validation failed: ' + validation.errors.join('\n'));
            return;
        }
        
        // Process the fixed JSON
        const jsonData = calculateAllMetrics(rawJsonData);
        window.currentJsonData = jsonData;
        displayJsonVisualization(jsonData, window.currentJsonPrompt);
        
        // Show analytics section
        const analyticsSection = document.getElementById('jsonVisualizationSection');
        if (analyticsSection) {
            analyticsSection.style.display = 'block';
        }
        
    } catch (error) {
        alert('Failed to process JSON: ' + error.message);
    }
};

// Make functions globally available
window.downloadJsonData = () => {
    // Download the raw JSON response if available, otherwise the parsed data
    if (window.jsonConversionResponse) {
        // Create a blob with the raw response
        const blob = new Blob([window.jsonConversionResponse], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consensus-analysis-raw-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else if (window.currentJsonData) {
        downloadJson(window.currentJsonData, 'consensus-analysis.json');
    } else {
        alert('No JSON data available to download');
    }
};

// Copy diagnostics to clipboard
window.copyDiagnostics = function() {
    const data = window.lastJsonGenerationData;
    if (!data) return;
    
    const report = `JSON Generation Diagnostics Report
${'-'.repeat(50)}
Timestamp: ${data.timestamp}
Consensus Length: ${data.consensusText?.length || 0}
Model Count: ${Object.keys(data.modelCodeMapping || {}).length}

Raw Response:
${data.rawResponse || 'No response captured'}

Extraction Result:
${data.extractedJson ? JSON.stringify(data.extractedJson, null, 2) : 'Extraction failed'}

Errors:
${data.extractionError || 'None'}
${data.validationErrors ? '\nValidation: ' + data.validationErrors.join(', ') : ''}`;
    
    navigator.clipboard.writeText(report).then(() => {
        alert('Diagnostics copied to clipboard');
    });
};

// Download diagnostics as file
window.downloadDiagnostics = function() {
    const data = window.lastJsonGenerationData;
    if (!data) return;
    
    const report = {
        timestamp: data.timestamp,
        consensusLength: data.consensusText?.length || 0,
        modelMapping: data.modelCodeMapping,
        rawResponse: data.rawResponse,
        extractedJson: data.extractedJson,
        errors: {
            extraction: data.extractionError,
            validation: data.validationErrors
        }
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `json-diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Validate manual JSON input
window.validateManualJson = function() {
    const textarea = document.getElementById('jsonEditorInput');
    const validationDiv = document.getElementById('editorValidation');
    
    if (!textarea || !validationDiv) return;
    
    try {
        const jsonData = extractJsonFromResponse(textarea.value);
        const validation = validateJsonStructure(jsonData);
        
        if (validation.valid) {
            validationDiv.className = 'editor-validation valid';
            validationDiv.textContent = '✓ Valid JSON structure';
        } else {
            validationDiv.className = 'editor-validation invalid';
            validationDiv.innerHTML = `✗ Invalid: <ul>${validation.errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
        }
    } catch (error) {
        validationDiv.className = 'editor-validation invalid';
        validationDiv.textContent = `✗ ${error.message}`;
    }
};

// Diagnostic function for debugging raw data view
window.debugRawDataView = function() {
    console.log('=== Raw Data View Debug ===');
    const rawDataView = document.getElementById('rawView');
    console.log('Raw data view element:', rawDataView);
    console.log('Display style:', rawDataView?.style.display);
    console.log('Class list:', rawDataView?.classList.toString());
    console.log('Inner HTML length:', rawDataView?.innerHTML.length);
    console.log('Has container:', !!rawDataView?.querySelector('.raw-data-container'));
    
    const container = rawDataView?.querySelector('.raw-data-container');
    console.log('Container display:', container ? getComputedStyle(container).display : 'N/A');
    
    const textareas = rawDataView?.querySelectorAll('textarea');
    console.log('Textareas found:', textareas?.length);
    textareas?.forEach((ta, i) => {
        console.log(`Textarea ${i}: ID=${ta.id}, Value length=${ta.value.length}, Value preview:`, ta.value.substring(0, 50) + '...');
        const rect = ta.getBoundingClientRect();
        console.log(`Textarea ${i} bounds:`, {
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
        });
    });
    
    console.log('Window data:', {
        hasJsonData: !!window.currentJsonData,
        jsonDataSize: window.currentJsonData ? JSON.stringify(window.currentJsonData).length : 0,
        hasUserPrompt: !!window.originalUserPrompt,
        userPromptLength: window.originalUserPrompt?.length || 0,
        hasJsonPrompt: !!window.currentJsonPrompt,
        jsonPromptLength: window.currentJsonPrompt?.length || 0
    });
    
    // Try to populate manually
    console.log('Attempting manual population...');
    populateRawDataTextareas();
};

// Force populate function for testing
window.forcePopulateRawData = function() {
    console.log('Force populating raw data...');
    const rawTab = document.querySelector('.view-tab[data-view="raw"]');
    if (rawTab) {
        rawTab.click();
    } else {
        console.error('Raw tab not found!');
    }
};

window.retryJsonConversion = retryJsonConversion;
window.clearThemeFilters = clearThemeFilters;
window.populateRawDataTextareas = populateRawDataTextareas;

// Function to load and display analytics info
async function loadAnalyticsInfo() {
    const contentDiv = document.getElementById('analyticsInfoContent');
    if (!contentDiv) return;
    
    try {
        const response = await fetch('./analytics-info.md');
        if (!response.ok) throw new Error('Failed to load analytics info');
        
        const markdownText = await response.text();
        
        // Convert markdown to HTML with enhanced styling and color coding
        let html = markdownText
            // Headers with color coding
            .replace(/^### (.*$)/gm, '<h4 style="color: var(--neu-accent); margin: 1.5rem 0 0.75rem 0; font-size: 1.1rem; border-bottom: 1px solid var(--neu-border-light); padding-bottom: 0.5rem;">$1</h4>')
            .replace(/^## (.*$)/gm, '<h3 style="color: var(--neu-accent); margin: 2rem 0 1rem 0; font-size: 1.3rem; border-bottom: 2px solid var(--neu-accent); padding-bottom: 0.5rem;">$1</h3>')
            .replace(/^# (.*$)/gm, '<h2 style="color: var(--neu-accent); margin: 2.5rem 0 1.5rem 0; font-size: 1.6rem; text-align: center; background: linear-gradient(135deg, var(--neu-accent), var(--neu-accent-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">$1</h2>')
            
            // Enhanced code blocks with syntax highlighting colors
            .replace(/```[\s\S]*?```/g, (match) => {
                const code = match.replace(/```\w*\n?/g, '').replace(/```/g, '');
                return `<pre style="background: var(--neu-bg-darker); border: 1px solid var(--neu-border-medium); padding: 1.5rem; border-radius: var(--neu-radius); overflow-x: auto; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; margin: 1.5rem 0; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);"><code style="color: var(--neu-accent-light); font-size: 0.9rem;">${code}</code></pre>`;
            })
            
            // Inline code with accent background
            .replace(/`([^`]+)`/g, '<code style="background: rgba(79, 127, 255, 0.1); color: var(--neu-accent-light); padding: 0.25rem 0.5rem; border-radius: 4px; font-family: \'SF Mono\', Consolas, monospace; font-size: 0.9rem; border: 1px solid rgba(79, 127, 255, 0.2);">$1</code>')
            
            // Bold and italic with colors
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--neu-text-primary); font-weight: 600;">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em style="color: var(--neu-accent-light); font-style: italic;">$1</em>')
            
            // Enhanced lists with better styling
            .replace(/^- (.*$)/gm, '<li style="margin: 0.5rem 0; color: var(--neu-text-secondary); line-height: 1.6;">$1</li>')
            .replace(/^(\d+)\. (.*$)/gm, '<li style="margin: 0.5rem 0; color: var(--neu-text-secondary); line-height: 1.6;">$2</li>')
            
            // Special formatting for checkmarks and bullets
            .replace(/✅/g, '<span style="color: var(--neu-success);"><i data-lucide="check-circle"></i></span>')
            .replace(/❌/g, '<span style="color: var(--neu-error);"><i data-lucide="x-circle"></i></span>')
            .replace(/⚠️/g, '<span style="color: var(--neu-warning);"><i data-lucide="triangle-alert"></i></span>')
            .replace(/📊/g, '<i data-lucide="bar-chart-3"></i>')
            .replace(/📋/g, '<i data-lucide="clipboard"></i>')
            .replace(/⚡/g, '<i data-lucide="zap"></i>')
            .replace(/✨/g, '<i data-lucide="sparkles"></i>')
            .replace(/🔥/g, '<i data-lucide="flame"></i>')
            .replace(/🌊/g, '<i data-lucide="waves"></i>')
            .replace(/🎯/g, '<i data-lucide="target"></i>')
            .replace(/🤝/g, '<i data-lucide="handshake"></i>')
            .replace(/⚖️/g, '<i data-lucide="scale"></i>')
            .replace(/🌪️/g, '<i data-lucide="wind"></i>')
            .replace(/💡/g, '<i data-lucide="lightbulb"></i>')
            
            // Line breaks and paragraphs
            .replace(/\n\n/g, '</p><p style="margin: 1rem 0; color: var(--neu-text-secondary); line-height: 1.7;">')
            .replace(/^\s*(.+)$/gm, '<p style="margin: 1rem 0; color: var(--neu-text-secondary); line-height: 1.7;">$1</p>')
            
            // Wrap lists properly
            .replace(/(<li.*?<\/li>\s*)+/gs, (match) => {
                return `<ul style="margin: 1rem 0; padding-left: 1.5rem; border-left: 3px solid var(--neu-border-accent); padding-left: 2rem;">${match}</ul>`;
            })
            
            // Clean up and fix nesting
            .replace(/<p style="[^"]*"><\/p>/g, '')
            .replace(/<p style="[^"]*">(<h[234])/g, '$1')
            .replace(/(<\/h[234]>)<\/p>/g, '$1')
            .replace(/<p style="[^"]*">(<ul)/g, '$1')
            .replace(/(<\/ul>)<\/p>/g, '$1')
            .replace(/<p style="[^"]*">(<pre)/g, '$1')
            .replace(/(<\/pre>)<\/p>/g, '$1');
        
        contentDiv.innerHTML = html;
        // Refresh Lucide icons after adding content
        if (window.refreshLucideIcons) {
            window.refreshLucideIcons();
        }
        
    } catch (error) {
        console.error('Error loading analytics info:', error);
        contentDiv.innerHTML = `
            <div style="text-align: center; color: var(--neu-error); padding: 2rem;">
                <p>Failed to load analytics guide.</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">Check that analytics-info.md exists in the project root.</p>
            </div>
        `;
    }
}