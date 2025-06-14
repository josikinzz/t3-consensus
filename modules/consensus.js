// Consensus Engine Module
// Handles consensus generation, processing, and display

import { CONFIG, CONSENSUS_PROMPT_TEMPLATE, MODEL_CODENAMES, ALL_LLMS } from './config.js';
import { showConsensusError, createModelNameMapping, getSelectedConsensusModel } from './utils.js';
import { queryOpenRouterModels } from './api.js';
import { startConsensusLoading, stopConsensusLoading } from './loading.js';

// Generate consensus from individual responses using progressive conversation
export async function generateConsensus(selectedModels, individualResponses, userPrompt) {
    console.log('Starting progressive consensus generation...');
    
    // Don't use the overall loading bar anymore
    // startConsensusLoading();
    
    try {
        // Filter successful responses
        const successfulResponses = individualResponses.filter(r => r.success);
        
        if (successfulResponses.length === 0) {
            throw new Error('No successful responses available for consensus generation');
        }
        
        // Create model name mapping
        const { mapping, codeMapping } = createModelNameMapping(selectedModels);
        
        // Initialize progressive display
        initializeProgressiveConsensusDisplay();
        
        // Show consensus section immediately
        const consensusSection = document.getElementById('consensusSection');
        if (consensusSection) {
            consensusSection.style.display = 'block';
        }
        
        // Generate consensus step by step
        const result = await generateConsensusConversation(selectedModels, successfulResponses, userPrompt, mapping, codeMapping);
        
        // Don't use the overall loading bar anymore
        // stopConsensusLoading();
        
        // Mark consensus as complete
        markConsensusComplete();
        
        return result;
        
    } catch (error) {
        console.error('Consensus generation error:', error);
        // stopConsensusLoading();
        showConsensusError(`Failed to generate consensus: ${error.message}`);
        throw error;
    }
}

// Build the consensus prompt
function buildConsensusPrompt(successfulResponses, userPrompt, modelMapping) {
    let prompt = CONSENSUS_PROMPT_TEMPLATE;
    
    // Replace number placeholder
    prompt = prompt.replace(/\[NUMBER\]/g, successfulResponses.length);
    
    // Replace user prompt
    prompt = prompt.replace('%%USER_PROMPT%%', userPrompt);
    
    // Get the model codes for selected models
    const modelCodes = successfulResponses.map(r => modelMapping[r.model.id]);
    
    // Create dynamic comparison table
    const tableHeaders = modelCodes.join(' | ');
    const consensusTableHeader = `| Theme/Category | ${tableHeaders} | Consensus Type |`;
    const separatorLine = '|' + '-'.repeat(16) + '|' + modelCodes.map(() => '-'.repeat(9)).join('|') + '|' + '-'.repeat(16) + '|';
    const comparisonTable = `${consensusTableHeader}\n${separatorLine}`;
    
    // Replace the entire comparison table section
    prompt = prompt.replace(
        /## COMPARISON_TABLE_START[\s\S]*?## COMPARISON_TABLE_END/,
        `## COMPARISON_TABLE_START\n${comparisonTable}\n## COMPARISON_TABLE_END`
    );
    
    // Create dynamic voting examples using actual model codes
    const votingExamples = `**Theme: [Your Theme Name Here]**
- <i data-lucide="check"></i> **Agreed:** ${modelCodes.slice(0, Math.ceil(modelCodes.length * 0.6)).join(', ') || '[List models that agree]'}
- <i data-lucide="x"></i> **Disagreed:** ${modelCodes.slice(Math.ceil(modelCodes.length * 0.6), Math.ceil(modelCodes.length * 0.8)).join(', ') || 'None'}
- <i data-lucide="circle"></i> **Not addressed:** ${modelCodes.slice(Math.ceil(modelCodes.length * 0.8)).join(', ') || 'None'}
- <i data-lucide="bar-chart-3"></i> **Type:** [Unanimous/Majority/Split/Single voice]

**Theme: [Another Theme]**
- <i data-lucide="check"></i> **Agreed:** ${modelCodes.join(', ')}
- <i data-lucide="x"></i> **Disagreed:** None
- <i data-lucide="circle"></i> **Not addressed:** None
- <i data-lucide="bar-chart-3"></i> **Type:** Unanimous consensus`;
    
    // Replace the voting summary section
    prompt = prompt.replace(
        /## VOTING_SUMMARY_START[\s\S]*?## VOTING_SUMMARY_END/,
        `## VOTING_SUMMARY_START\n${votingExamples}\n## VOTING_SUMMARY_END`
    );
    
    // Update disagreements examples to use actual model codes
    const disagreementExamples = `### **Theme: [Theme Name]**
- **${modelCodes[0] || 'llm-X'} position:** [their stance]
- **${modelCodes[1] || 'llm-Y'} position:** [different stance]
- **<i data-lucide="search"></i> Significance:** This disagreement matters because [reason]`;
    
    // Replace the disagreements section
    prompt = prompt.replace(
        /## DISAGREEMENTS_START[\s\S]*?## DISAGREEMENTS_END/,
        `## DISAGREEMENTS_START\n${disagreementExamples}\n## DISAGREEMENTS_END`
    );
    
    // Build model output block with codenames only
    let modelOutputBlock = '';
    successfulResponses.forEach((response, index) => {
        const modelCode = modelMapping[response.model.id];
        modelOutputBlock += `\n## ${modelCode.toUpperCase()}_OUTPUT_START\n`;
        // Don't include the actual model name to reduce bias
        modelOutputBlock += `**Response:**\n${response.response}\n`;
        modelOutputBlock += `## ${modelCode.toUpperCase()}_OUTPUT_END\n`;
    });
    
    // Replace the model output block placeholder
    prompt = prompt.replace('__MODEL_OUTPUT_BLOCK_GOES_HERE__', modelOutputBlock);
    
    return prompt;
}

// Generate consensus through progressive conversation
async function generateConsensusConversation(selectedModels, successfulResponses, userPrompt, mapping, codeMapping) {
    // Build the initial prompt with step-by-step instruction
    const basePrompt = buildConsensusPrompt(successfulResponses, userPrompt, mapping) + 
        "\n\n**IMPORTANT: You will generate this analysis in steps. First, output ONLY the comparison table section (COMPARISON_TABLE_START to COMPARISON_TABLE_END). After I confirm receipt, I will ask you to continue with the next section. Do not output multiple sections in one response.**";
    
    const conversationHistory = [
        { role: 'user', content: basePrompt }
    ];
    
    const stepPrompts = {
        consensusSummary: "Now output the consensus summary section (CONSENSUS_SUMMARY_START to CONSENSUS_SUMMARY_END).",
        mentionQuality: "Now output the mention quality analysis section (MENTION_QUALITY_START to MENTION_QUALITY_END). For each theme, analyze whether each model addressed it directly (with explicit language), indirectly (implied or alluded to), or omitted it entirely. Include coverage percentages and insights about engagement patterns.",
        votingSummary: "Now output the voting summary section (VOTING_SUMMARY_START to VOTING_SUMMARY_END).",
        disagreements: "Now output the disagreements section (DISAGREEMENTS_START to DISAGREEMENTS_END).",
        synthesis: "Finally, output the synthesis section (SYNTHESIS_START to SYNTHESIS_END)."
    };
    
    const sections = {};
    let fullConsensusText = '';
    
    // Get consensus model from dropdown
    const selectedConsensusModelId = getSelectedConsensusModel();
    console.log('Using consensus model:', selectedConsensusModelId);
    
    // Find the model details from ALL_LLMS
    const consensusModelDetails = ALL_LLMS.find(m => m.id === selectedConsensusModelId);
    const consensusModel = consensusModelDetails || { 
        id: selectedConsensusModelId, 
        name: 'Gemini 2.5 Pro',
        maxContextTokens: 16000,
        maxOutputTokens: 16000
    };
    
    try {
        // Step 1: Generate comparison table
        console.log('Generating comparison table...');
        updateSectionLoadingState('comparisonTable', 'loading');
        
        let result = await queryOpenRouterModels([consensusModel], conversationHistory[0].content, null);
        if (!result[0] || !result[0].success) {
            throw new Error(result[0]?.error || 'Failed to generate comparison table');
        }
        
        const comparisonResponse = result[0].response;
        sections.comparisonTable = extractSectionFromResponse(comparisonResponse, 'COMPARISON_TABLE');
        fullConsensusText += comparisonResponse + '\n\n';
        
        updateConsensusSection('comparisonTable', sections.comparisonTable, codeMapping);
        conversationHistory.push({ role: 'assistant', content: comparisonResponse });
        
        // Steps 2-5: Sequential generation with immediate updates
        for (const [sectionKey, prompt] of Object.entries(stepPrompts)) {
            console.log(`Generating ${sectionKey}...`);
            updateSectionLoadingState(sectionKey, 'loading');
            
            conversationHistory.push({ role: 'user', content: prompt });
            
            // Convert conversation history to single prompt (OpenRouter doesn't support conversation history)
            const conversationPrompt = conversationHistory.map(msg => 
                `${msg.role === 'user' ? 'USER' : 'ASSISTANT'}: ${msg.content}`
            ).join('\n\n');
            
            result = await queryOpenRouterModels([consensusModel], conversationPrompt, null);
            if (!result[0] || !result[0].success) {
                throw new Error(result[0]?.error || `Failed to generate ${sectionKey}`);
            }
            
            const sectionResponse = result[0].response;
            sections[sectionKey] = extractSectionFromResponse(sectionResponse, getSectionMarker(sectionKey));
            fullConsensusText += sectionResponse + '\n\n';
            
            updateConsensusSection(sectionKey, sections[sectionKey], codeMapping);
            conversationHistory.push({ role: 'assistant', content: sectionResponse });
            
            // Brief pause to let user see the update
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Store globally for other functions
        window.currentConsensusText = fullConsensusText;
        window.currentConsensusPrompt = basePrompt;
        window.modelCodeMapping = codeMapping;
        
        // Setup copy buttons
        setupConsensusCopyButtons();
        
        // Update raw output and prompt tabs
        updateRawConsensusContent(fullConsensusText, basePrompt);
        
        return { consensusText: fullConsensusText, consensusPrompt: basePrompt, codeMapping };
        
    } catch (error) {
        console.error('Progressive consensus generation error:', error);
        throw error;
    }
}

// Helper function to get section marker
function getSectionMarker(sectionKey) {
    const markers = {
        consensusSummary: 'CONSENSUS_SUMMARY',
        mentionQuality: 'MENTION_QUALITY',
        votingSummary: 'VOTING_SUMMARY', 
        disagreements: 'DISAGREEMENTS',
        synthesis: 'SYNTHESIS'
    };
    return markers[sectionKey] || sectionKey.toUpperCase();
}

// Helper function to extract section content from response
function extractSectionFromResponse(response, marker) {
    const startMarker = `## ${marker}_START`;
    const endMarker = `## ${marker}_END`;
    
    const regex = new RegExp(`${startMarker}\\s*([\\s\\S]*?)\\s*${endMarker}`, 'i');
    const match = response.match(regex);
    
    if (match) {
        return match[1].trim();
    }
    
    // Fallback: return the whole response if markers not found
    console.warn(`Section markers not found for ${marker}, using full response`);
    return response.trim();
}

// Legacy function - kept for compatibility but now unused
export function displayConsensusOutput(consensusText, consensusPrompt, codeMapping) {
    // This function is now replaced by the progressive display system
    console.log('displayConsensusOutput called - using progressive display instead');
}

// Extract sections from consensus text
function extractConsensusSections(consensusText) {
    const sections = {};
    
    console.log('Extracting consensus sections from text length:', consensusText.length);
    
    // Extract synthesis section
    const synthesisMatch = consensusText.match(/## SYNTHESIS_START\s*([\s\S]*?)\s*## SYNTHESIS_END/);
    if (synthesisMatch) {
        sections.synthesis = synthesisMatch[1].trim();
        console.log('Found synthesis section, length:', sections.synthesis.length);
    }
    
    // Extract consensus summary table
    const consensusSummaryMatch = consensusText.match(/## CONSENSUS_SUMMARY_START\s*([\s\S]*?)\s*## CONSENSUS_SUMMARY_END/);
    if (consensusSummaryMatch) {
        sections.consensusSummary = consensusSummaryMatch[1].trim();
        console.log('Found consensus summary section, length:', sections.consensusSummary.length);
    }
    
    // Extract voting summary
    const votingSummaryMatch = consensusText.match(/## VOTING_SUMMARY_START\s*([\s\S]*?)\s*## VOTING_SUMMARY_END/);
    if (votingSummaryMatch) {
        sections.votingSummary = votingSummaryMatch[1].trim();
        console.log('Found voting summary section, length:', sections.votingSummary.length);
    }
    
    // Extract disagreements
    const disagreementsMatch = consensusText.match(/## DISAGREEMENTS_START\s*([\s\S]*?)\s*## DISAGREEMENTS_END/);
    if (disagreementsMatch) {
        sections.disagreements = disagreementsMatch[1].trim();
        console.log('Found disagreements section, length:', sections.disagreements.length);
    }
    
    // Extract comparison table
    const comparisonTableMatch = consensusText.match(/## COMPARISON_TABLE_START\s*([\s\S]*?)\s*## COMPARISON_TABLE_END/);
    if (comparisonTableMatch) {
        sections.comparisonTable = comparisonTableMatch[1].trim();
        console.log('Found comparison table section, length:', sections.comparisonTable.length);
    } else {
        console.log('Comparison table section NOT found in consensus text');
        console.log('Raw consensus text preview:', consensusText.substring(0, 500) + '...');
    }
    
    console.log('All sections found:', Object.keys(sections));
    return sections;
}

// Setup copy buttons for consensus tabs
function setupConsensusCopyButtons() {
    // Copy raw consensus button
    const copyRawBtn = document.querySelector('.copy-raw-consensus-btn');
    if (copyRawBtn) {
        copyRawBtn.onclick = () => {
            const rawTextarea = document.getElementById('rawConsensusOutput');
            if (rawTextarea && rawTextarea.value) {
                window.copyText(rawTextarea.value, copyRawBtn);
            }
        };
    }
    
    // Copy consensus prompt button
    const copyPromptBtn = document.querySelector('.copy-consensus-prompt-btn');
    if (copyPromptBtn) {
        copyPromptBtn.onclick = () => {
            const promptContent = document.getElementById('consensusPromptContent');
            if (promptContent && promptContent.textContent) {
                window.copyText(promptContent.textContent, copyPromptBtn);
            }
        };
    }
}

// Loading messages for each section
const SECTION_LOADING_MESSAGES = {
    comparisonTable: [
        "Aligning parallel universes of thought...",
        "The matrix reveals hidden patterns...",
        "Mapping constellations of digital opinion...",
        "Decoding the architecture of responses...",
        "Threads of logic weave into formation...",
        "The comparison chamber awakens..."
    ],
    
    consensusSummary: [
        "Crystallizing fragments of shared wisdom...",
        "The collective mind finds its center...",
        "Echoes of agreement ripple through the data...",
        "Discovering the hidden harmonies...",
        "Where scattered thoughts become one voice...",
        "The synthesis engine hums to life..."
    ],
    
    mentionQuality: [
        "Analyzing mention patterns across models...",
        "Categorizing direct vs indirect references...",
        "Evaluating theme coverage and engagement...",
        "Mapping the depth of discourse...",
        "Tracing explicit and implicit connections...",
        "Illuminating patterns of attention and omission..."
    ],
    
    votingSummary: [
        "The silent ballot unfolds its secrets...",
        "Tallying whispers in the digital assembly...",
        "Each voice casts its weight upon the scales...",
        "The democracy of minds takes shape...",
        "Counting stars in the constellation of opinion...",
        "The algorithmic council reveals its leanings..."
    ],
    
    disagreements: [
        "Where parallel paths diverge in the mist...",
        "Mapping the fault lines of digital discourse...",
        "The spectrum of dissent comes into focus...",
        "Tracing shadows where consensus cannot reach...",
        "Documenting the beautiful chaos of disagreement...",
        "The divergence matrix materializes..."
    ],
    
    synthesis: [
        "The final pattern emerges from the static...",
        "All threads converge at the loom's center...",
        "The master algorithm speaks its conclusion...",
        "Forging unity from scattered fragments...",
        "The last piece of the puzzle clicks into place...",
        "From many streams, one river flows..."
    ]
};

// Get random loading message for section
function getRandomLoadingMessage(sectionKey) {
    const messages = SECTION_LOADING_MESSAGES[sectionKey] || ['Processing...'];
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
}

// Create loading animation for section
function createSectionLoadingAnimation(sectionKey) {
    return `
        <div class="section-loading-container compact">
            <div class="loading-spinner compact"></div>
            <div class="loading-message">${getRandomLoadingMessage(sectionKey)}</div>
        </div>
    `;
}

// Initialize progressive consensus display
function initializeProgressiveConsensusDisplay() {
    const consensusOutput = document.getElementById('consensusOutput');
    
    // Show skeleton/placeholder for all sections immediately
    consensusOutput.innerHTML = `
        <div class="consensus-section" id="comparisonTable-section">
            <details class="neu-details consensus-details" open>
                <summary style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i data-lucide="clipboard"></i> Detailed Comparison</span>
                    <button class="copy-button" onclick="window.copyConsensusSection('comparisonTable', this)" title="Copy section content">
                        <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                            <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                        </svg>
                        <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                        </svg>
                    </button>
                </summary>
                <div class="details-content">
                    <div class="section-loading-placeholder">Waiting to start...</div>
                </div>
            </details>
        </div>
        
        <div class="consensus-section" id="consensusSummary-section">
            <details class="neu-details consensus-details">
                <summary style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i data-lucide="bar-chart-3"></i> Consensus Summary</span>
                    <button class="copy-button" onclick="window.copyConsensusSection('consensusSummary', this)" title="Copy section content">
                        <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                            <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                        </svg>
                        <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                        </svg>
                    </button>
                </summary>
                <div class="details-content">
                    <div class="section-loading-placeholder">Waiting for comparison table...</div>
                </div>
            </details>
        </div>
        
        <div class="consensus-section" id="mentionQuality-section">
            <details class="neu-details consensus-details">
                <summary style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i data-lucide="bar-chart-2"></i> Mention Quality Analysis</span>
                    <button class="copy-button" onclick="window.copyConsensusSection('mentionQuality', this)" title="Copy section content">
                        <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                            <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                        </svg>
                        <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                        </svg>
                    </button>
                </summary>
                <div class="details-content">
                    <div class="section-loading-placeholder">Waiting for previous sections...</div>
                </div>
            </details>
        </div>
        
        <div class="consensus-section" id="votingSummary-section">
            <details class="neu-details consensus-details">
                <summary style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i data-lucide="square-check"></i> Voting Breakdown</span>
                    <button class="copy-button" onclick="window.copyConsensusSection('votingSummary', this)" title="Copy section content">
                        <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                            <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                        </svg>
                        <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                        </svg>
                    </button>
                </summary>
                <div class="details-content">
                    <div class="section-loading-placeholder">Waiting for previous sections...</div>
                </div>
            </details>
        </div>
        
        <div class="consensus-section" id="disagreements-section">
            <details class="neu-details consensus-details">
                <summary style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i data-lucide="zap"></i> Disagreements</span>
                    <button class="copy-button" onclick="window.copyConsensusSection('disagreements', this)" title="Copy section content">
                        <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                            <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                        </svg>
                        <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                        </svg>
                    </button>
                </summary>
                <div class="details-content">
                    <div class="section-loading-placeholder">Waiting for previous sections...</div>
                </div>
            </details>
        </div>
        
        <div class="consensus-section" id="synthesis-section">
            <details class="neu-details consensus-details">
                <summary style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i data-lucide="clipboard"></i> Synthesis</span>
                    <button class="copy-button" onclick="window.copyConsensusSection('synthesis', this)" title="Copy section content">
                        <svg class="copy-icon copy-icon-default" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1.5A1.5 1.5 0 0112 3v8a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 014 11V3a1.5 1.5 0 011.5-1.5h5zm0 1h-5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3a.5.5 0 00-.5-.5z"/>
                            <path d="M13 4.5V12a1.5 1.5 0 01-1.5 1.5H6v1h5.5A2.5 2.5 0 0014 12V4.5h-1z"/>
                        </svg>
                        <svg class="copy-icon copy-icon-copied" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                        </svg>
                    </button>
                </summary>
                <div class="details-content">
                    <div class="section-loading-placeholder">Waiting for previous sections...</div>
                </div>
            </details>
        </div>
    `;
    
    // Show consensus tabs
    const consensusTabs = document.getElementById('consensusTabs');
    if (consensusTabs) {
        consensusTabs.style.display = 'flex';
    }
    
    // Refresh Lucide icons for newly added content
    if (window.refreshLucideIcons) {
        window.refreshLucideIcons();
    }
}

// Update loading state for a specific section
function updateSectionLoadingState(sectionKey, state) {
    const sectionElement = document.getElementById(`${sectionKey}-section`);
    if (!sectionElement) return;
    
    const detailsContent = sectionElement.querySelector('.details-content');
    const detailsElement = sectionElement.querySelector('details');
    if (!detailsContent) return;
    
    switch (state) {
        case 'loading':
            // Auto-expand the section when loading starts
            if (detailsElement) {
                detailsElement.open = true;
            }
            
            detailsContent.innerHTML = createSectionLoadingAnimation(sectionKey);
            
            // Start message cycling after 3 seconds
            setTimeout(() => {
                if (sectionElement.querySelector('.section-loading-container')) {
                    const intervalId = cycleLoadingMessage(sectionElement, sectionKey);
                    sectionElement.dataset.messageInterval = intervalId;
                }
            }, 3000);
            break;
        case 'completed':
            // Clear message cycling interval if exists
            if (sectionElement.dataset.messageInterval) {
                clearInterval(parseInt(sectionElement.dataset.messageInterval));
                delete sectionElement.dataset.messageInterval;
            }
            break;
    }
}

// Cycle through loading messages
function cycleLoadingMessage(sectionElement, sectionKey) {
    const messages = SECTION_LOADING_MESSAGES[sectionKey];
    let currentIndex = Math.floor(Math.random() * messages.length);
    
    const interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % messages.length;
        const messageElement = sectionElement.querySelector('.loading-message');
        if (messageElement) {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                messageElement.textContent = messages[currentIndex];
                messageElement.style.opacity = '1';
            }, 300);
        }
    }, 3000);
    
    return interval;
}

// Update consensus section with content
function updateConsensusSection(sectionKey, content, codeMapping) {
    const sectionElement = document.getElementById(`${sectionKey}-section`);
    if (!sectionElement) return;
    
    const detailsContent = sectionElement.querySelector('.details-content');
    
    // Convert codenames and parse markdown
    const processedContent = replaceCodenamesWithNames(content, codeMapping);
    const htmlContent = parseMarkdown(processedContent);
    
    // Replace loading placeholder with actual content
    if (sectionKey === 'comparisonTable') {
        detailsContent.innerHTML = `<div class="table-container markdown-render-area">${htmlContent}</div>`;
    } else {
        detailsContent.innerHTML = `<div class="markdown-render-area">${htmlContent}</div>`;
    }
    
    // Update visual state
    sectionElement.classList.add('completed');
    
    // Auto-open this section
    const details = sectionElement.querySelector('details');
    details.open = true;
    
    // Auto-collapse outputs section when comparison table completes
    if (sectionKey === 'comparisonTable') {
        collapseOutputsSection();
    }
    
    // Collapse the previous section (if not synthesis)
    collapsePreviousSection(sectionKey);
    
    // Update next section's loading state
    updateNextSectionState(sectionKey);
    
    // Refresh Lucide icons for newly added content
    if (window.refreshLucideIcons) {
        window.refreshLucideIcons();
    }
}

// Auto-collapse the outputs section
function collapseOutputsSection() {
    const responsesContainer = document.getElementById('responsesContainer');
    if (responsesContainer) {
        // Add a delay to let users see the transition
        setTimeout(() => {
            responsesContainer.classList.add('collapsed');
        }, 1000);
    }
}

// Collapse the previous section when a new one completes
function collapsePreviousSection(currentSectionKey) {
    const sectionOrder = ['comparisonTable', 'consensusSummary', 'mentionQuality', 'votingSummary', 'disagreements', 'synthesis'];
    const currentIndex = sectionOrder.indexOf(currentSectionKey);
    
    // Don't collapse if this is the first section
    if (currentIndex <= 0) return;
    
    const previousSectionKey = sectionOrder[currentIndex - 1];
    const previousElement = document.getElementById(`${previousSectionKey}-section`);
    
    if (previousElement) {
        const previousDetails = previousElement.querySelector('details');
        if (previousDetails) {
            // Add a small delay for smooth transition
            setTimeout(() => {
                previousDetails.open = false;
            }, 500);
        }
    }
}

// Update next section's loading state
function updateNextSectionState(completedSection) {
    const sectionOrder = ['comparisonTable', 'consensusSummary', 'mentionQuality', 'votingSummary', 'disagreements', 'synthesis'];
    const currentIndex = sectionOrder.indexOf(completedSection);
    const nextSection = sectionOrder[currentIndex + 1];
    
    if (nextSection) {
        const nextElement = document.getElementById(`${nextSection}-section`);
        if (nextElement) {
            const nextPlaceholder = nextElement.querySelector('.loading-placeholder');
            if (nextPlaceholder) {
                nextPlaceholder.textContent = `Next: ${getSectionDisplayName(nextSection)}...`;
                nextPlaceholder.classList.add('next-loading');
            }
        }
    }
}

// Get display name for section
function getSectionDisplayName(sectionKey) {
    const displayNames = {
        comparisonTable: 'comparison table',
        consensusSummary: 'consensus summary',
        mentionQuality: 'mention quality analysis',
        votingSummary: 'voting breakdown',
        disagreements: 'disagreements analysis',
        synthesis: 'final synthesis'
    };
    return displayNames[sectionKey] || sectionKey;
}

// Mark consensus generation as complete
function markConsensusComplete() {
    console.log('Consensus generation completed successfully');
    
    // Remove any remaining loading states
    document.querySelectorAll('.loading-placeholder').forEach(placeholder => {
        placeholder.classList.remove('active-loading', 'next-loading');
    });
    
    // Add completion class to all sections
    document.querySelectorAll('.consensus-section').forEach(section => {
        section.classList.add('completed');
    });
    
    // Collapse all sections except synthesis
    setTimeout(() => {
        const sectionsToCollapse = ['comparisonTable', 'consensusSummary', 'mentionQuality', 'votingSummary', 'disagreements'];
        
        sectionsToCollapse.forEach(sectionKey => {
            const sectionElement = document.getElementById(`${sectionKey}-section`);
            if (sectionElement) {
                const details = sectionElement.querySelector('details');
                if (details) {
                    details.open = false;
                }
            }
        });
        
        // Ensure synthesis stays open
        const synthesisElement = document.getElementById('synthesis-section');
        if (synthesisElement) {
            const synthesisDetails = synthesisElement.querySelector('details');
            if (synthesisDetails) {
                synthesisDetails.open = true;
            }
        }
    }, 1000); // Wait 1 second after completion
}

// Update raw consensus content tabs
function updateRawConsensusContent(consensusText, consensusPrompt) {
    // Update the raw output tab
    const rawConsensusOutput = document.getElementById('rawConsensusOutput');
    if (rawConsensusOutput) {
        rawConsensusOutput.value = consensusText;
    }
    
    // Update the prompt tab
    const consensusPromptContent = document.getElementById('consensusPromptContent');
    if (consensusPromptContent) {
        consensusPromptContent.textContent = consensusPrompt;
    }
}

// Function to replace codenames with real model names (same as before)
function replaceCodenamesWithNames(text, codeMapping) {
    let processedText = text;
    
    // Replace each codename with the real model name
    Object.entries(codeMapping).forEach(([codename, modelName]) => {
        // Use a more permissive regex that doesn't rely on word boundaries
        // since codenames contain special characters like !, @, #, etc.
        const escapedCodename = codename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedCodename, 'gi');
        processedText = processedText.replace(regex, modelName);
    });
    
    return processedText;
}

// Parse markdown function (same as before)
function parseMarkdown(text) {
    if (typeof marked !== 'undefined' && marked.parse) {
        return marked.parse(text);
    } else {
        // Fallback: basic paragraph wrapping and table conversion
        let html = text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
        
        // Basic table conversion for markdown tables
        if (text.includes('|')) {
            const lines = text.split('\n');
            let tableHTML = '<table>';
            let inTable = false;
            
            lines.forEach((line, index) => {
                if (line.includes('|') && line.trim() !== '') {
                    if (!inTable) {
                        tableHTML += '<thead>';
                        inTable = true;
                    }
                    
                    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
                    
                    // Skip separator lines like |---|---|
                    if (cells.every(cell => cell.match(/^-+$/))) {
                        tableHTML += '</thead><tbody>';
                        return;
                    }
                    
                    if (index === 0 || (index === 1 && lines[index-1].includes('|'))) {
                        tableHTML += '<tr>';
                        cells.forEach(cell => {
                            tableHTML += `<th>${cell}</th>`;
                        });
                        tableHTML += '</tr>';
                    } else {
                        tableHTML += '<tr>';
                        cells.forEach(cell => {
                            tableHTML += `<td>${cell}</td>`;
                        });
                        tableHTML += '</tr>';
                    }
                }
            });
            
            tableHTML += '</tbody></table>';
            return tableHTML;
        }
        
        return `<p>${html}</p>`;
    }
}

// Copy consensus section content to clipboard
window.copyConsensusSection = function(sectionKey, buttonElement) {
    const sectionElement = document.getElementById(`${sectionKey}-section`);
    if (!sectionElement) return;
    
    const contentElement = sectionElement.querySelector('.markdown-render-area, .table-container');
    if (!contentElement) return;
    
    // Get the text content
    const content = contentElement.innerText || contentElement.textContent;
    
    // Copy to clipboard
    navigator.clipboard.writeText(content).then(() => {
        // Update button visual state to match existing copy button behavior
        const defaultIcon = buttonElement.querySelector('.copy-icon-default');
        const copiedIcon = buttonElement.querySelector('.copy-icon-copied');
        
        if (defaultIcon && copiedIcon) {
            // Add copied class for styling
            buttonElement.classList.add('copied');
            
            // Switch icons
            defaultIcon.style.display = 'none';
            copiedIcon.style.display = 'inline';
            
            // Reset after 2 seconds
            setTimeout(() => {
                buttonElement.classList.remove('copied');
                defaultIcon.style.display = 'inline';
                copiedIcon.style.display = 'none';
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy section content:', err);
    });
};