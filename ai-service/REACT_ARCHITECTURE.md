# ReAct Agent Architecture

## Overview

The ReAct (Reasoning + Acting) agent implements a powerful framework that combines reasoning and acting in an interleaved manner. This creates a more intelligent and explainable AI system.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User Query                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  ReAct Agent Loop                            │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐  │
│  │   THOUGHT   │ ──▶ │   ACTION    │ ──▶ │ OBSERVATION  │  │
│  │             │     │             │     │              │  │
│  │ "I need to  │     │ "Use tool X │     │ "Tool result:│  │
│  │  analyze..."│     │  with params"│     │  data = ... │  │
│  └─────────────┘     └─────────────┘     └──────┬───────┘  │
│         ▲                                        │          │
│         │                                        │          │
│         └────────────────────────────────────────┘          │
│                                                              │
│  Repeat until:                                              │
│  - Task is complete                                         │
│  - Maximum iterations reached                               │
│  - Agent determines it has sufficient information           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Final Answer                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Thought Phase
- Agent analyzes the current situation
- Plans the next step
- Reasons about what information is needed
- Considers previous observations

### 2. Action Phase
- Selects appropriate tool(s)
- Determines parameters
- Executes tool functions
- Can chain multiple tools

### 3. Observation Phase
- Processes tool results
- Integrates new information
- Updates understanding
- Decides if more actions needed

## Example Execution

**Query**: "Plan a business trip to Tokyo next month"

```
Iteration 1:
├─ Thought: I need to help plan a business trip to Tokyo. First, I should check 
│           the weather for next month to help with packing recommendations.
├─ Action: getCurrentWeather({location: "Tokyo, Japan"})
└─ Observation: Tokyo weather: 22°C, partly cloudy, humidity 65%

Iteration 2:
├─ Thought: Now I have weather information. I should search for business travel
│           tips and requirements for Tokyo.
├─ Action: searchWeb({query: "business travel Tokyo requirements tips"})
└─ Observation: Found information about business etiquette, visa requirements...

Iteration 3:
├─ Thought: I should create a comprehensive itinerary document with all the
│           information gathered.
├─ Action: generateDocument({type: "report", title: "Tokyo Business Trip Plan"})
└─ Observation: Document created with weather, tips, and recommendations

Iteration 4:
├─ Thought: Finally, I should create calendar events for the trip.
├─ Action: createCalendarEvent({title: "Tokyo Business Trip", date: "2024-08-15"})
└─ Observation: Calendar event created successfully

Final Answer: I've planned your Tokyo business trip with weather information,
             travel tips, a comprehensive document, and calendar events.
```

## Available Tools

The ReAct agent has access to 19 specialized tools:

### 📧 Communication
- `sendEmail` - Compose and send emails
- `translateText` - Translate between languages

### 📅 Productivity
- `createCalendarEvent` - Schedule meetings
- `createReminder` - Set time-based alerts
- `generateDocument` - Create reports/proposals

### 📊 Data & Analysis
- `analyzeData` - Business data insights
- `queryDatabase` - Execute SQL queries
- `readFile` - Access file contents
- `writeFile` - Save data to files
- `executeCode` - Run calculations

### 🌐 Web & APIs
- `searchWeb` - Internet search
- `callAPI` - HTTP requests
- `getStockPrice` - Market quotes
- `getCryptoPrice` - Crypto rates

### 🧠 Intelligence
- `summarizeText` - Condense content
- `analyzeImage` - Extract image info

### 🛠️ Utilities
- `getCurrentWeather` - Weather data
- `calculateExpression` - Math operations
- `convertUnits` - Unit conversions

## Benefits of ReAct Framework

1. **Explainability**: See exactly how the agent reasons through problems
2. **Flexibility**: Can adapt strategy based on observations
3. **Error Recovery**: Can try alternative approaches if one fails
4. **Complex Tasks**: Handles multi-step problems naturally
5. **Tool Chaining**: Intelligently combines multiple tools

## Usage

Access the ReAct agent at: http://localhost:3007/

Try complex queries like:
- "Research competitor pricing, analyze the data, and create a presentation"
- "Check weather in multiple cities and plan the best travel route"
- "Calculate my ROI, convert to different currencies, and email a report"

The UI will show you each thought, action, and observation in real-time!