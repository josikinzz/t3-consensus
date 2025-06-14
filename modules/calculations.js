// Calculations Module
// Performs all mathematical calculations client-side for accurate analytics

/**
 * Calculate all metrics from the raw JSON data
 * @param {Object} rawData - The JSON data from the LLM with classifications only
 * @returns {Object} - Enhanced data with all calculated metrics
 */
export function calculateAllMetrics(rawData) {
    // Check if it's simplified format and convert
    const normalizedData = normalizeJsonFormat(rawData);
    const enhancedData = JSON.parse(JSON.stringify(normalizedData)); // Deep clone
    
    // Calculate theme-level metrics
    enhancedData.themes = enhancedData.themes.map(theme => ({
        ...theme,
        ...calculateThemeMetrics(theme)
    }));
    
    // Calculate summary metrics
    enhancedData.summary = calculateSummaryMetrics(enhancedData.themes, rawData.modelBehavior);
    
    // Calculate confidence metrics
    enhancedData.confidenceMetrics = calculateConfidenceMetrics(enhancedData.themes);
    
    // Calculate model behavior metrics
    enhancedData.calculatedModelBehavior = calculateModelBehaviorMetrics(
        enhancedData.themes, 
        rawData.modelBehavior
    );
    
    // Calculate consensus evolution metrics
    enhancedData.consensusEvolution = {
        ...rawData.consensusFormation,
        ...calculateConsensusEvolutionMetrics(enhancedData.themes)
    };
    
    // Calculate AI-generated insights (based on calculations)
    enhancedData.aiGeneratedInsights = generateCalculatedInsights(enhancedData);
    
    // Also copy calculated model behavior to the expected location for UI
    if (enhancedData.calculatedModelBehavior) {
        enhancedData.modelBehavior = enhancedData.calculatedModelBehavior;
    }
    
    console.log('Enhanced data structure:', {
        hasThemes: !!enhancedData.themes,
        themeCount: enhancedData.themes?.length,
        hasModelBehavior: !!enhancedData.modelBehavior,
        hasCalculatedModelBehavior: !!enhancedData.calculatedModelBehavior,
        modelBehaviorKeys: Object.keys(enhancedData.modelBehavior || {})
    });
    
    return enhancedData;
}

/**
 * Calculate metrics for a single theme
 */
function calculateThemeMetrics(theme) {
    const positions = Object.values(theme.modelPositions);
    const stances = positions.map(p => p.stance);
    
    const agreeCount = stances.filter(s => s === 'agree').length;
    const disagreeCount = stances.filter(s => s === 'disagree').length;
    const neutralCount = stances.filter(s => s === 'neutral').length;
    const notMentionedCount = stances.filter(s => s === 'not_mentioned').length;
    const totalModels = positions.length;
    const mentionedCount = totalModels - notMentionedCount;
    
    // Calculate consensus type
    let consensusType;
    if (agreeCount === totalModels) {
        consensusType = 'unanimous';
    } else if (agreeCount > disagreeCount && agreeCount > totalModels / 2) {
        consensusType = 'majority';
    } else if (agreeCount === disagreeCount && agreeCount > 0) {
        consensusType = 'split';
    } else if (mentionedCount === 1) {
        consensusType = 'single';
    } else {
        consensusType = 'none';
    }
    
    // Calculate agreement level
    let agreementLevel;
    const agreementRatio = mentionedCount > 0 ? agreeCount / mentionedCount : 0;
    if (agreementRatio === 1) {
        agreementLevel = 'unanimous';
    } else if (agreementRatio >= 0.75) {
        agreementLevel = 'strong';
    } else if (agreementRatio >= 0.5) {
        agreementLevel = 'moderate';
    } else if (agreementRatio > 0) {
        agreementLevel = 'weak';
    } else {
        agreementLevel = 'single';
    }
    
    // Calculate scores
    const consensusStrengthScore = mentionedCount > 0 
        ? Math.round((agreeCount / mentionedCount) * 100) 
        : 0;
    
    const controversyScore = mentionedCount > 0
        ? Math.round((disagreeCount / mentionedCount) * 100)
        : 0;
    
    // Impact score based on importance and mention rate
    let impactScore = 5; // default medium
    if (theme.importance === 'high') impactScore = 8;
    if (theme.importance === 'low') impactScore = 3;
    // Adjust based on how many models mentioned it
    impactScore = Math.round(impactScore * (mentionedCount / totalModels));
    impactScore = Math.max(1, Math.min(10, impactScore)); // Clamp 1-10
    
    // Get supporting outputs
    const supportingOutputs = Object.entries(theme.modelPositions)
        .filter(([_, position]) => position.stance === 'agree')
        .map(([model, _]) => model);
    
    // Extract mention type counts
    const directCount = positions.filter(p => p.mentionType === 'direct').length;
    const indirectCount = positions.filter(p => p.mentionType === 'indirect').length;
    const omittedCount = positions.filter(p => p.mentionType === 'omitted').length;
    
    // Calculate enhanced metrics
    const coverageScore = Math.round(((directCount + indirectCount) / totalModels) * 100);
    const clarityScore = (directCount + indirectCount) > 0 
        ? Math.round((directCount / (directCount + indirectCount)) * 100)
        : 0;
    
    // Create mention metrics object
    const mentionMetrics = {
        direct: directCount,
        indirect: indirectCount,
        omitted: omittedCount,
        coverageScore,
        clarityScore,
        coverageLabel: `${directCount + indirectCount}/${totalModels} models addressed`
    };
    
    return {
        consensusType,
        agreementLevel,
        consensusStrengthScore,
        controversyScore,
        impactScore,
        supportingOutputs,
        mentionMetrics,
        metrics: {
            agreeCount,
            disagreeCount,
            neutralCount,
            notMentionedCount,
            mentionedCount,
            totalModels
        }
    };
}

/**
 * Calculate summary metrics across all themes
 */
function calculateSummaryMetrics(themes, modelBehavior) {
    const totalThemes = themes.length;
    const totalModels = Object.keys(modelBehavior).length;
    
    // Calculate average consensus score
    const avgConsensusScore = themes.length > 0
        ? Math.round(themes.reduce((sum, t) => sum + t.consensusStrengthScore, 0) / themes.length)
        : 0;
    
    // Count controversy themes
    const controversyCount = themes.filter(t => 
        t.consensusType === 'split' || t.controversyScore > 40
    ).length;
    
    // Determine overall consensus strength
    let consensusStrength;
    if (avgConsensusScore >= 80) {
        consensusStrength = 'strong';
    } else if (avgConsensusScore >= 60) {
        consensusStrength = 'moderate';
    } else {
        consensusStrength = 'weak';
    }
    
    // Participation rate (always 100% for successful responses)
    const participationRate = 100;
    
    // Reliability index based on consistency
    const unanimousThemes = themes.filter(t => t.consensusType === 'unanimous').length;
    const reliabilityIndex = Math.round((unanimousThemes / totalThemes) * 100);
    
    return {
        totalThemes,
        consensusStrength,
        consensusScore: avgConsensusScore,
        controversyCount,
        participationRate,
        reliabilityIndex,
        totalModels
    };
}

/**
 * Calculate confidence metrics
 */
function calculateConfidenceMetrics(themes) {
    const unanimousThemes = themes.filter(t => t.consensusType === 'unanimous').length;
    const majorityThemes = themes.filter(t => t.consensusType === 'majority').length;
    const splitThemes = themes.filter(t => t.consensusType === 'split').length;
    const singleVoiceThemes = themes.filter(t => t.consensusType === 'single').length;
    
    const totalMentions = themes.reduce((sum, t) => sum + t.metrics.mentionedCount, 0);
    const totalAgreements = themes.reduce((sum, t) => sum + t.metrics.agreeCount, 0);
    
    const overallAgreementRate = totalMentions > 0
        ? Math.round((totalAgreements / totalMentions) * 100)
        : 0;
    
    return {
        unanimousThemes,
        majorityThemes,
        splitThemes,
        singleVoiceThemes,
        overallAgreementRate
    };
}

/**
 * Calculate model behavior metrics
 */
function calculateModelBehaviorMetrics(themes, modelBehavior) {
    const modelNames = Object.keys(modelBehavior);
    const modelStats = {};
    
    // Initialize stats for each model
    modelNames.forEach(model => {
        modelStats[model] = {
            agreementCount: 0,
            mentionCount: 0,
            uniquePositions: 0,
            alignmentScores: {},
            directMentions: 0,
            indirectMentions: 0,
            omissions: 0
        };
    });
    
    // Calculate stats from themes
    themes.forEach(theme => {
        modelNames.forEach(model => {
            const position = theme.modelPositions[model];
            if (position) {
                // Track mention types
                if (position.mentionType === 'direct') {
                    modelStats[model].directMentions++;
                } else if (position.mentionType === 'indirect') {
                    modelStats[model].indirectMentions++;
                } else if (position.mentionType === 'omitted') {
                    modelStats[model].omissions++;
                }
                
                // Track stances
                if (position.stance !== 'not_mentioned') {
                    modelStats[model].mentionCount++;
                    if (position.stance === 'agree') {
                        modelStats[model].agreementCount++;
                    }
                }
            }
        });
    });
    
    // Calculate model profiles
    const modelProfiles = {};
    modelNames.forEach(model => {
        const stats = modelStats[model];
        const agreementScore = stats.mentionCount > 0
            ? Math.round((stats.agreementCount / stats.mentionCount) * 100)
            : 0;
        
        const divergenceScore = 100 - agreementScore;
        const coverageScore = themes.length > 0
            ? Math.round((stats.mentionCount / themes.length) * 100)
            : 0;
        
        // Trust score based on agreement rate and coverage
        const trustScore = Math.round((agreementScore * 0.7) + (coverageScore * 0.3));
        
        // Calculate mention pattern metrics
        const totalThemes = themes.length;
        const directnessScore = stats.mentionCount > 0
            ? Math.round((stats.directMentions / stats.mentionCount) * 100)
            : 0;
        
        modelProfiles[model] = {
            agreementScore,
            divergenceScore,
            trustScore,
            coverageScore,
            uniqueContributions: modelBehavior[model]?.uniqueContributions?.length || 0,
            responseStyle: modelBehavior[model]?.responseStyle || 'balanced',
            signatureMoves: modelBehavior[model]?.tendencies || [],
            mentionPatterns: {
                direct: stats.directMentions,
                indirect: stats.indirectMentions,
                omitted: stats.omissions,
                directnessScore,
                mentionStyle: directnessScore >= 70 ? 'explicit' : directnessScore >= 40 ? 'balanced' : 'implicit'
            }
        };
    });
    
    // Calculate model relationships
    const modelRelationships = [];
    for (let i = 0; i < modelNames.length; i++) {
        for (let j = i + 1; j < modelNames.length; j++) {
            const modelA = modelNames[i];
            const modelB = modelNames[j];
            
            let agreedTogether = 0;
            let bothMentioned = 0;
            
            themes.forEach(theme => {
                const posA = theme.modelPositions[modelA];
                const posB = theme.modelPositions[modelB];
                
                if (posA?.stance !== 'not_mentioned' && posB?.stance !== 'not_mentioned') {
                    bothMentioned++;
                    if (posA.stance === posB.stance) {
                        agreedTogether++;
                    }
                }
            });
            
            const agreementPercentage = bothMentioned > 0
                ? Math.round((agreedTogether / bothMentioned) * 100)
                : 0;
            
            let relationshipType;
            if (agreementPercentage >= 80) {
                relationshipType = 'aligned';
            } else if (agreementPercentage >= 60) {
                relationshipType = 'complementary';
            } else if (agreementPercentage <= 40) {
                relationshipType = 'opposing';
            } else {
                relationshipType = 'independent';
            }
            
            modelRelationships.push({
                modelA,
                modelB,
                agreementPercentage,
                relationshipType
            });
        }
    }
    
    // Find most agreeable and divergent
    const sortedByAgreement = Object.entries(modelProfiles)
        .sort((a, b) => b[1].agreementScore - a[1].agreementScore);
    
    const mostAgreeable = sortedByAgreement
        .filter(([_, profile]) => profile.agreementScore >= 70)
        .map(([model, _]) => model);
    
    const mostDivergent = sortedByAgreement
        .filter(([_, profile]) => profile.divergenceScore >= 40)
        .map(([model, _]) => model);
    
    return {
        mostAgreeable: mostAgreeable.length > 0 ? mostAgreeable : [sortedByAgreement[0][0]],
        mostDivergent: mostDivergent.length > 0 ? mostDivergent : [sortedByAgreement[sortedByAgreement.length - 1][0]],
        coverageByModel: Object.fromEntries(
            Object.entries(modelProfiles).map(([model, profile]) => [model, profile.coverageScore])
        ),
        modelProfiles,
        modelRelationships
    };
}

/**
 * Calculate consensus evolution metrics
 */
function calculateConsensusEvolutionMetrics(themes) {
    const unanimousCount = themes.filter(t => t.consensusType === 'unanimous').length;
    const splitCount = themes.filter(t => t.consensusType === 'split').length;
    
    // Stability score based on consistency of agreement
    const avgControversy = themes.length > 0
        ? themes.reduce((sum, t) => sum + t.controversyScore, 0) / themes.length
        : 0;
    
    const stabilityScore = Math.round(100 - avgControversy);
    
    // Count themes that emerged from discussion (high impact, not unanimous)
    const emergentThemes = themes.filter(t => 
        t.impactScore >= 6 && t.consensusType !== 'unanimous'
    ).length;
    
    return {
        stabilityScore,
        emergentThemes,
        unanimousCount,
        splitCount
    };
}

/**
 * Generate calculated insights based on the metrics
 */
function generateCalculatedInsights(data) {
    // Find strongest consensus
    const strongestTheme = data.themes
        .filter(t => t.metrics.mentionedCount > 1)
        .sort((a, b) => b.consensusStrengthScore - a.consensusStrengthScore)[0];
    
    // Find biggest controversy
    const mostControversial = data.themes
        .sort((a, b) => b.controversyScore - a.controversyScore)[0];
    
    // Model diversity score
    const avgAgreementRate = data.confidenceMetrics.overallAgreementRate;
    let modelDiversity;
    if (avgAgreementRate >= 80) {
        modelDiversity = "Low diversity - models largely aligned";
    } else if (avgAgreementRate >= 60) {
        modelDiversity = "Moderate diversity - healthy disagreement";
    } else {
        modelDiversity = "High diversity - significant differences in approach";
    }
    
    return {
        strongestConsensus: strongestTheme?.name || "No clear consensus found",
        biggestControversy: mostControversial?.name || "No significant controversies",
        modelDiversity,
        consensusQuality: data.summary.reliabilityIndex >= 50 ? "High reliability" : "Mixed reliability"
    };
}

/**
 * Normalize different JSON formats to standard format
 */
function normalizeJsonFormat(rawData) {
    // Check if it's simplified format (has models array instead of modelPositions)
    if (rawData.themes && rawData.themes[0]?.models) {
        console.log('Detected simplified JSON format, converting...');
        
        // Get all unique model names
        const allModels = new Set();
        rawData.themes.forEach(theme => {
            theme.models.forEach(m => allModels.add(m.name));
        });
        
        // Convert to standard format
        const normalized = {
            themes: rawData.themes.map(theme => {
                const modelPositions = {};
                
                // Initialize all models as not_mentioned
                allModels.forEach(modelName => {
                    modelPositions[modelName] = {
                        stance: 'not_mentioned',
                        quote: '',
                        reasoning: ''
                    };
                });
                
                // Fill in actual positions
                theme.models.forEach(model => {
                    modelPositions[model.name] = {
                        stance: model.stance,
                        quote: model.quote || '',
                        reasoning: model.reasoning || ''
                    };
                });
                
                return {
                    name: theme.name,
                    statement: theme.statement,
                    importance: theme.importance || 'medium',
                    modelPositions,
                    disagreements: []
                };
            }),
            insights: rawData.insights || {
                mainConclusion: rawData.summary || '',
                keyFindings: [],
                surprisingPatterns: '',
                practicalImplications: ''
            },
            modelBehavior: rawData.modelBehavior || {},
            consensusFormation: rawData.consensusFormation || {
                pattern: rawData.pattern || 'uniform',
                description: ''
            }
        };
        
        console.log('Format conversion complete');
        return normalized;
    }
    
    // Already in standard format
    return rawData;
}