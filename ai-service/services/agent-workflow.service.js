const EventEmitter = require('events');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Agentic Workflow Service
 * Enables AI agents to perform complex multi-step tasks autonomously
 */
class AgentWorkflowService extends EventEmitter {
    constructor() {
        super();
        this.workflows = new Map();
        this.runningWorkflows = new Map();
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        // Initialize built-in workflows
        this.initializeBuiltInWorkflows();
    }

    /**
     * Initialize built-in workflow templates
     */
    initializeBuiltInWorkflows() {
        // Email Campaign Workflow
        this.registerWorkflow({
            id: 'email-campaign',
            name: 'Email Campaign Automation',
            description: 'Research contacts, draft personalized emails, and schedule sending',
            steps: [
                {
                    id: 'research',
                    name: 'Research Recipients',
                    action: 'searchContacts',
                    params: { source: 'crm', criteria: '{{criteria}}' },
                    output: 'contacts'
                },
                {
                    id: 'analyze',
                    name: 'Analyze Contact Preferences',
                    action: 'analyzePreferences',
                    params: { contacts: '{{steps.research.output}}' },
                    output: 'preferences'
                },
                {
                    id: 'draft',
                    name: 'Draft Personalized Emails',
                    action: 'generateEmails',
                    params: { 
                        contacts: '{{steps.research.output}}',
                        preferences: '{{steps.analyze.output}}',
                        template: '{{template}}'
                    },
                    output: 'emails'
                },
                {
                    id: 'schedule',
                    name: 'Schedule Sending',
                    action: 'scheduleEmails',
                    params: { 
                        emails: '{{steps.draft.output}}',
                        sendTime: '{{sendTime}}'
                    },
                    output: 'scheduled'
                }
            ]
        });

        // Meeting Preparation Workflow
        this.registerWorkflow({
            id: 'meeting-prep',
            name: 'Intelligent Meeting Preparation',
            description: 'Research participants, prepare agenda, and create briefing documents',
            steps: [
                {
                    id: 'participants',
                    name: 'Research Participants',
                    action: 'researchParticipants',
                    params: { attendees: '{{attendees}}' },
                    output: 'participantInfo'
                },
                {
                    id: 'context',
                    name: 'Gather Context',
                    action: 'gatherContext',
                    params: { 
                        topic: '{{topic}}',
                        participants: '{{steps.participants.output}}'
                    },
                    output: 'context'
                },
                {
                    id: 'agenda',
                    name: 'Create Agenda',
                    action: 'generateAgenda',
                    params: { 
                        context: '{{steps.context.output}}',
                        duration: '{{duration}}'
                    },
                    output: 'agenda'
                },
                {
                    id: 'briefing',
                    name: 'Prepare Briefing',
                    action: 'createBriefing',
                    params: { 
                        participants: '{{steps.participants.output}}',
                        context: '{{steps.context.output}}',
                        agenda: '{{steps.agenda.output}}'
                    },
                    output: 'briefing'
                }
            ]
        });

        // Sales Pipeline Workflow
        this.registerWorkflow({
            id: 'sales-pipeline',
            name: 'Sales Pipeline Optimization',
            description: 'Analyze leads, prioritize opportunities, and create action plans',
            steps: [
                {
                    id: 'fetch',
                    name: 'Fetch Active Leads',
                    action: 'fetchLeads',
                    params: { status: 'active' },
                    output: 'leads'
                },
                {
                    id: 'score',
                    name: 'Score Leads',
                    action: 'scoreLeads',
                    params: { leads: '{{steps.fetch.output}}' },
                    output: 'scoredLeads'
                },
                {
                    id: 'prioritize',
                    name: 'Prioritize Opportunities',
                    action: 'prioritizeOpportunities',
                    params: { scoredLeads: '{{steps.score.output}}' },
                    output: 'priorities'
                },
                {
                    id: 'plan',
                    name: 'Create Action Plans',
                    action: 'createActionPlans',
                    params: { 
                        priorities: '{{steps.prioritize.output}}',
                        timeframe: '{{timeframe}}'
                    },
                    output: 'actionPlans'
                }
            ]
        });
    }

    /**
     * Register a new workflow
     */
    registerWorkflow(workflow) {
        this.workflows.set(workflow.id, workflow);
        this.emit('workflow:registered', workflow);
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(workflowId, inputs = {}, context = {}) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow '${workflowId}' not found`);
        }

        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const execution = {
            id: executionId,
            workflowId,
            workflow,
            inputs,
            context,
            status: 'running',
            currentStep: 0,
            steps: {},
            startTime: Date.now(),
            logs: []
        };

        this.runningWorkflows.set(executionId, execution);
        this.emit('workflow:started', { executionId, workflowId });

        try {
            // Execute each step
            for (let i = 0; i < workflow.steps.length; i++) {
                const step = workflow.steps[i];
                execution.currentStep = i;
                
                this.log(execution, `Starting step: ${step.name}`);
                this.emit('workflow:step:started', { executionId, step: step.id });

                try {
                    // Resolve parameters
                    const resolvedParams = this.resolveParameters(step.params, execution);
                    
                    // Execute the action
                    const result = await this.executeAction(step.action, resolvedParams, context);
                    
                    // Store result
                    execution.steps[step.id] = {
                        status: 'completed',
                        output: result,
                        duration: Date.now() - execution.startTime
                    };

                    this.log(execution, `Completed step: ${step.name}`);
                    this.emit('workflow:step:completed', { executionId, step: step.id, result });

                } catch (error) {
                    execution.steps[step.id] = {
                        status: 'failed',
                        error: error.message
                    };
                    
                    this.log(execution, `Failed step: ${step.name} - ${error.message}`, 'error');
                    this.emit('workflow:step:failed', { executionId, step: step.id, error });
                    
                    // Decide whether to continue or abort
                    if (!step.continueOnError) {
                        throw error;
                    }
                }
            }

            execution.status = 'completed';
            execution.endTime = Date.now();
            execution.duration = execution.endTime - execution.startTime;

            this.emit('workflow:completed', { executionId, results: execution.steps });
            return execution;

        } catch (error) {
            execution.status = 'failed';
            execution.error = error.message;
            execution.endTime = Date.now();
            
            this.emit('workflow:failed', { executionId, error });
            throw error;
            
        } finally {
            // Clean up after a delay
            setTimeout(() => {
                this.runningWorkflows.delete(executionId);
            }, 300000); // 5 minutes
        }
    }

    /**
     * Execute a single action
     */
    async executeAction(action, params, context) {
        // This is where we integrate with various services
        switch (action) {
            case 'searchContacts':
                return this.searchContacts(params, context);
            
            case 'analyzePreferences':
                return this.analyzePreferences(params, context);
            
            case 'generateEmails':
                return this.generateEmails(params, context);
            
            case 'scheduleEmails':
                return this.scheduleEmails(params, context);
            
            case 'researchParticipants':
                return this.researchParticipants(params, context);
            
            case 'gatherContext':
                return this.gatherContext(params, context);
            
            case 'generateAgenda':
                return this.generateAgenda(params, context);
            
            case 'createBriefing':
                return this.createBriefing(params, context);
            
            case 'fetchLeads':
                return this.fetchLeads(params, context);
            
            case 'scoreLeads':
                return this.scoreLeads(params, context);
            
            case 'prioritizeOpportunities':
                return this.prioritizeOpportunities(params, context);
            
            case 'createActionPlans':
                return this.createActionPlans(params, context);
            
            default:
                // Try to execute as a custom action
                return this.executeCustomAction(action, params, context);
        }
    }

    /**
     * Resolve parameters with template variables
     */
    resolveParameters(params, execution) {
        const resolved = {};
        
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string' && value.includes('{{')) {
                resolved[key] = this.resolveTemplate(value, execution);
            } else {
                resolved[key] = value;
            }
        }
        
        return resolved;
    }

    /**
     * Resolve template variables
     */
    resolveTemplate(template, execution) {
        return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const parts = path.trim().split('.');
            
            if (parts[0] === 'steps') {
                // Access step outputs
                const stepId = parts[1];
                const step = execution.steps[stepId];
                if (step && parts[2] === 'output') {
                    return step.output;
                }
            } else {
                // Access inputs
                return execution.inputs[path.trim()] || match;
            }
            
            return match;
        });
    }

    /**
     * Log execution events
     */
    log(execution, message, level = 'info') {
        const logEntry = {
            timestamp: Date.now(),
            level,
            message
        };
        
        execution.logs.push(logEntry);
        console.log(`[Workflow ${execution.workflowId}] ${message}`);
    }

    // Action implementations
    async searchContacts(params, context) {
        // Integrate with CRM
        const contacts = [
            { id: 1, name: 'John Doe', email: 'john@example.com', company: 'Acme Corp' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', company: 'Tech Inc' }
        ];
        return contacts;
    }

    async analyzePreferences(params, context) {
        const prompt = `Analyze the following contacts and determine their communication preferences and interests:\n${JSON.stringify(params.contacts, null, 2)}`;
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    async generateEmails(params, context) {
        const emails = [];
        for (const contact of params.contacts) {
            const prompt = `Generate a personalized email for ${contact.name} at ${contact.company} based on these preferences:\n${params.preferences}\n\nTemplate: ${params.template}`;
            const result = await this.model.generateContent(prompt);
            emails.push({
                to: contact.email,
                subject: `Personalized message for ${contact.name}`,
                body: result.response.text()
            });
        }
        return emails;
    }

    async scheduleEmails(params, context) {
        // In real implementation, this would integrate with email service
        return {
            scheduled: params.emails.length,
            sendTime: params.sendTime,
            status: 'queued'
        };
    }

    async researchParticipants(params, context) {
        const attendees = Array.isArray(params.attendees) ? params.attendees : [params.attendees];
        const prompt = `Research and provide background information on these meeting participants:\n${attendees.join('\n')}`;
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    async gatherContext(params, context) {
        const prompt = `Gather relevant context and recent developments for a meeting about: ${params.topic}\n\nParticipants info:\n${params.participants}`;
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    async generateAgenda(params, context) {
        const prompt = `Create a structured meeting agenda for a ${params.duration} minute meeting based on:\n\nContext: ${params.context}\n\nFormat the agenda with time allocations and discussion points.`;
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    async createBriefing(params, context) {
        const prompt = `Create an executive briefing document that includes:\n\n1. Participant backgrounds:\n${params.participants}\n\n2. Context:\n${params.context}\n\n3. Agenda:\n${params.agenda}\n\nFormat as a professional briefing document.`;
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    async fetchLeads(params, context) {
        // Mock implementation - would integrate with CRM
        return [
            { id: 1, name: 'Lead A', value: 50000, stage: 'qualification' },
            { id: 2, name: 'Lead B', value: 75000, stage: 'proposal' },
            { id: 3, name: 'Lead C', value: 100000, stage: 'negotiation' }
        ];
    }

    async scoreLeads(params, context) {
        const leads = params.leads.map(lead => ({
            ...lead,
            score: Math.random() * 100,
            factors: {
                engagement: Math.random() * 10,
                fit: Math.random() * 10,
                timing: Math.random() * 10
            }
        }));
        return leads;
    }

    async prioritizeOpportunities(params, context) {
        const sorted = params.scoredLeads.sort((a, b) => b.score - a.score);
        return {
            high: sorted.slice(0, Math.ceil(sorted.length / 3)),
            medium: sorted.slice(Math.ceil(sorted.length / 3), Math.ceil(sorted.length * 2 / 3)),
            low: sorted.slice(Math.ceil(sorted.length * 2 / 3))
        };
    }

    async createActionPlans(params, context) {
        const plans = [];
        
        for (const priority of ['high', 'medium', 'low']) {
            for (const lead of params.priorities[priority] || []) {
                const prompt = `Create a specific action plan for this ${priority} priority lead:\n${JSON.stringify(lead, null, 2)}\n\nTimeframe: ${params.timeframe}`;
                const result = await this.model.generateContent(prompt);
                plans.push({
                    leadId: lead.id,
                    priority,
                    actions: result.response.text()
                });
            }
        }
        
        return plans;
    }

    async executeCustomAction(action, params, context) {
        // Allow for custom action handlers
        const prompt = `Execute the following action:\nAction: ${action}\nParameters: ${JSON.stringify(params, null, 2)}`;
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    /**
     * Get workflow execution status
     */
    getExecutionStatus(executionId) {
        return this.runningWorkflows.get(executionId);
    }

    /**
     * List available workflows
     */
    listWorkflows() {
        return Array.from(this.workflows.values());
    }

    /**
     * Cancel a running workflow
     */
    cancelWorkflow(executionId) {
        const execution = this.runningWorkflows.get(executionId);
        if (execution && execution.status === 'running') {
            execution.status = 'cancelled';
            this.emit('workflow:cancelled', { executionId });
            return true;
        }
        return false;
    }
}

module.exports = AgentWorkflowService;