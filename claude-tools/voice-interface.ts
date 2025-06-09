/**
 * Voice Interface for Claude
 * Enables natural voice interactions with Claude AI
 */

import { EventEmitter } from 'events';
import { thinkingFramework } from './thinking-framework';
import { promptEngineering } from './prompt-engineering-toolkit';
import { collaborationSystem } from './collaboration-system';

export interface VoiceConfig {
  language: string;
  voice: VoiceProfile;
  speechRate: number;
  pitch: number;
  volume: number;
  wakeWord?: string;
  continuousListening: boolean;
  noiseSupression: boolean;
  echoCancellation: boolean;
}

export interface VoiceProfile {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  style: 'conversational' | 'professional' | 'friendly' | 'assistant';
  customizations?: VoiceCustomization;
}

export interface VoiceCustomization {
  emphasis?: 'low' | 'medium' | 'high';
  expressiveness?: number; // 0-1
  formality?: number; // 0-1
  warmth?: number; // 0-1
}

export interface VoiceSession {
  id: string;
  startTime: Date;
  config: VoiceConfig;
  state: SessionState;
  context: ConversationContext;
  metrics: SessionMetrics;
}

export interface ConversationContext {
  history: ConversationTurn[];
  currentIntent?: Intent;
  entities: Map<string, Entity>;
  topic?: string;
  mood?: 'positive' | 'neutral' | 'negative';
  formality: 'casual' | 'normal' | 'formal';
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  speaker: 'user' | 'claude';
  audio?: AudioSegment;
  transcript: string;
  intent?: Intent;
  sentiment?: Sentiment;
  confidence: number;
}

export interface AudioSegment {
  data: ArrayBuffer;
  format: 'wav' | 'mp3' | 'webm';
  duration: number;
  sampleRate: number;
}

export interface Intent {
  name: string;
  confidence: number;
  parameters: Record<string, any>;
  action?: string;
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
  position: [number, number];
}

export interface Sentiment {
  polarity: number; // -1 to 1
  magnitude: number; // 0 to 1
  emotions?: Emotion[];
}

export interface Emotion {
  type: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust';
  intensity: number; // 0 to 1
}

export enum SessionState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
  PAUSED = 'paused',
  ERROR = 'error'
}

export interface SessionMetrics {
  totalTurns: number;
  totalDuration: number;
  averageResponseTime: number;
  recognitionAccuracy: number;
  userSatisfaction?: number;
}

export class VoiceInterface extends EventEmitter {
  private config: VoiceConfig;
  private session: VoiceSession | null = null;
  private audioProcessor: AudioProcessor;
  private speechRecognizer: SpeechRecognizer;
  private speechSynthesizer: SpeechSynthesizer;
  private nlp: NaturalLanguageProcessor;
  private contextManager: ContextManager;
  private isActive: boolean = false;

  constructor(config: VoiceConfig) {
    super();
    this.config = config;
    this.audioProcessor = new AudioProcessor(config);
    this.speechRecognizer = new SpeechRecognizer(config);
    this.speechSynthesizer = new SpeechSynthesizer(config);
    this.nlp = new NaturalLanguageProcessor();
    this.contextManager = new ContextManager();
    this.initialize();
  }

  private initialize() {
    // Set up audio stream processing
    this.audioProcessor.on('audio:ready', this.handleAudioReady.bind(this));
    this.audioProcessor.on('audio:level', this.handleAudioLevel.bind(this));
    
    // Set up speech recognition
    this.speechRecognizer.on('transcript:partial', this.handlePartialTranscript.bind(this));
    this.speechRecognizer.on('transcript:final', this.handleFinalTranscript.bind(this));
    this.speechRecognizer.on('error', this.handleRecognitionError.bind(this));
    
    // Set up wake word detection if configured
    if (this.config.wakeWord) {
      this.setupWakeWordDetection();
    }
  }

  // Session Management

  async startSession(): Promise<string> {
    if (this.session && this.session.state !== SessionState.IDLE) {
      throw new Error('Session already active');
    }

    this.session = {
      id: this.generateSessionId(),
      startTime: new Date(),
      config: this.config,
      state: SessionState.IDLE,
      context: {
        history: [],
        entities: new Map(),
        formality: 'normal'
      },
      metrics: {
        totalTurns: 0,
        totalDuration: 0,
        averageResponseTime: 0,
        recognitionAccuracy: 1.0
      }
    };

    // Initialize audio system
    await this.audioProcessor.initialize();
    
    this.isActive = true;
    this.emit('session:started', this.session.id);
    
    // Start listening if continuous mode
    if (this.config.continuousListening) {
      await this.startListening();
    }

    return this.session.id;
  }

  async endSession(): Promise<void> {
    if (!this.session) return;

    this.isActive = false;
    await this.stopListening();
    await this.audioProcessor.shutdown();

    // Calculate final metrics
    this.session.metrics.totalDuration = Date.now() - this.session.startTime.getTime();
    
    this.emit('session:ended', {
      sessionId: this.session.id,
      metrics: this.session.metrics
    });

    this.session = null;
  }

  // Voice Interaction

  async startListening(): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    if (this.session.state === SessionState.LISTENING) {
      return; // Already listening
    }

    this.updateState(SessionState.LISTENING);
    await this.audioProcessor.startRecording();
    await this.speechRecognizer.start();

    this.emit('listening:started');
  }

  async stopListening(): Promise<void> {
    if (!this.session || this.session.state !== SessionState.LISTENING) {
      return;
    }

    await this.audioProcessor.stopRecording();
    await this.speechRecognizer.stop();
    this.updateState(SessionState.IDLE);

    this.emit('listening:stopped');
  }

  async speak(text: string, options?: SpeakOptions): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    this.updateState(SessionState.SPEAKING);

    // Generate speech with appropriate voice settings
    const audio = await this.speechSynthesizer.synthesize(text, {
      voice: this.config.voice,
      rate: options?.rate || this.config.speechRate,
      pitch: options?.pitch || this.config.pitch,
      volume: options?.volume || this.config.volume,
      emotion: options?.emotion,
      emphasis: options?.emphasis
    });

    // Play audio
    await this.audioProcessor.playAudio(audio);

    // Add to conversation history
    this.addToHistory({
      speaker: 'claude',
      transcript: text,
      audio,
      confidence: 1.0
    });

    this.updateState(SessionState.IDLE);
    this.emit('speech:completed', { text });
  }

  // Advanced Features

  async enableConversationMode(options?: ConversationOptions): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    // Set up conversation-specific parameters
    this.contextManager.setMode('conversation', {
      turnTaking: options?.turnTaking || 'automatic',
      interruptions: options?.allowInterruptions || true,
      backchanneling: options?.backchanneling || true,
      fillers: options?.useFillers || true
    });

    // Adjust speech parameters for natural conversation
    this.config.speechRate = 1.1; // Slightly faster
    this.config.voice.customizations = {
      ...this.config.voice.customizations,
      expressiveness: 0.8,
      warmth: 0.7
    };

    this.emit('mode:conversation');
  }

  async enableDictationMode(options?: DictationOptions): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    // Set up dictation-specific parameters
    this.contextManager.setMode('dictation', {
      punctuation: options?.autoPunctuation || true,
      formatting: options?.autoFormatting || true,
      commands: options?.voiceCommands || true
    });

    // Adjust recognition for accuracy
    this.speechRecognizer.setMode('dictation');

    this.emit('mode:dictation');
  }

  // Voice Commands

  async registerVoiceCommand(command: VoiceCommand): Promise<void> {
    this.nlp.registerCommand(command);
    this.emit('command:registered', command);
  }

  async executeVoiceCommand(command: string, parameters?: any): Promise<any> {
    if (!this.session) {
      throw new Error('No active session');
    }

    // Process command with context
    const intent = await this.nlp.parseIntent(command, this.session.context);
    
    if (!intent || intent.confidence < 0.7) {
      await this.speak("I'm not sure I understood that command. Could you rephrase?");
      return;
    }

    // Execute command
    const result = await this.processIntent(intent);
    
    // Provide voice feedback
    if (result.speak) {
      await this.speak(result.speak);
    }

    return result.data;
  }

  // Multi-modal Integration

  async processWithVisualContext(audioInput: ArrayBuffer, visualContext: any): Promise<MultiModalResponse> {
    if (!this.session) {
      throw new Error('No active session');
    }

    // Transcribe audio
    const transcript = await this.speechRecognizer.recognize(audioInput);
    
    // Analyze with visual context
    thinkingFramework.setLevel('think_harder');
    const analysis = await thinkingFramework.think(
      'Analyze this voice input with visual context',
      { transcript, visualContext }
    );

    // Generate multi-modal response
    const response = await this.generateMultiModalResponse(analysis, transcript);
    
    return response;
  }

  // Emotion and Tone Detection

  async analyzeVoiceCharacteristics(audio: ArrayBuffer): Promise<VoiceAnalysis> {
    const features = await this.audioProcessor.extractFeatures(audio);
    
    return {
      emotion: this.detectEmotion(features),
      stress: this.detectStress(features),
      confidence: this.detectSpeakerConfidence(features),
      pace: this.analyzeSpeechPace(features),
      clarity: this.analyzeClarify(features)
    };
  }

  // Real-time Interaction Features

  async enableBackchanneling(): Promise<void> {
    // Enable minimal responses during user speech
    this.speechRecognizer.on('speech:pause', async (duration) => {
      if (duration > 500 && duration < 1500) {
        // Provide backchannel response
        const responses = ['Mm-hmm', 'I see', 'Go on', 'Right', 'Understood'];
        const response = responses[Math.floor(Math.random() * responses.length)];
        await this.speak(response, { volume: 0.6, rate: 1.2 });
      }
    });
  }

  async handleInterruption(): Promise<void> {
    if (this.session?.state === SessionState.SPEAKING) {
      // Stop current speech
      await this.audioProcessor.stopPlayback();
      
      // Quick acknowledgment
      await this.speak("Yes?", { rate: 1.3 });
      
      // Resume listening
      await this.startListening();
    }
  }

  // Voice Cloning and Personalization

  async createVoiceProfile(name: string, samples: AudioSegment[]): Promise<VoiceProfile> {
    // Analyze voice samples
    const characteristics = await this.analyzeVoiceSamples(samples);
    
    // Create custom voice profile
    const profile: VoiceProfile = {
      id: this.generateId(),
      name,
      gender: characteristics.gender,
      accent: characteristics.accent,
      style: 'conversational',
      customizations: {
        emphasis: characteristics.emphasis,
        expressiveness: characteristics.expressiveness,
        formality: characteristics.formality,
        warmth: characteristics.warmth
      }
    };

    // Save profile
    await this.saveVoiceProfile(profile);
    
    return profile;
  }

  // Accessibility Features

  async enableAccessibilityMode(options: AccessibilityOptions): Promise<void> {
    if (options.slowSpeech) {
      this.config.speechRate = 0.8;
    }

    if (options.increasedVolume) {
      this.config.volume = 1.0;
    }

    if (options.clearEnunciation) {
      this.speechSynthesizer.setEnunciation('clear');
    }

    if (options.repeatOnRequest) {
      this.registerVoiceCommand({
        phrases: ['repeat that', 'say that again', 'what did you say'],
        action: async () => {
          const lastResponse = this.getLastClaudeResponse();
          if (lastResponse) {
            await this.speak(lastResponse.transcript, { rate: 0.9 });
          }
        }
      });
    }

    this.emit('accessibility:enabled', options);
  }

  // Private Methods

  private handleAudioReady(audio: ArrayBuffer) {
    if (this.session?.state === SessionState.LISTENING) {
      this.speechRecognizer.processAudio(audio);
    }
  }

  private handleAudioLevel(level: number) {
    this.emit('audio:level', level);
  }

  private async handlePartialTranscript(transcript: string) {
    this.emit('transcript:partial', transcript);
    
    // Check for wake word in partial transcript
    if (this.config.wakeWord && transcript.toLowerCase().includes(this.config.wakeWord.toLowerCase())) {
      this.emit('wakeword:detected');
      await this.startListening();
    }
  }

  private async handleFinalTranscript(transcript: string) {
    if (!this.session) return;

    this.emit('transcript:final', transcript);
    
    // Add to history
    this.addToHistory({
      speaker: 'user',
      transcript,
      confidence: 0.95
    });

    // Update state
    this.updateState(SessionState.PROCESSING);

    // Process user input
    await this.processUserInput(transcript);
  }

  private async processUserInput(transcript: string) {
    try {
      // Parse intent and entities
      const intent = await this.nlp.parseIntent(transcript, this.session!.context);
      const entities = await this.nlp.extractEntities(transcript);
      
      // Update context
      this.contextManager.updateContext({
        lastUserInput: transcript,
        intent,
        entities
      });

      // Generate response using thinking framework
      const response = await this.generateResponse(transcript, intent, entities);
      
      // Speak response
      await this.speak(response.text, response.speechOptions);
      
      // Update metrics
      this.updateMetrics(response);
      
    } catch (error) {
      this.handleProcessingError(error);
    }
  }

  private async generateResponse(
    transcript: string,
    intent: Intent | null,
    entities: Entity[]
  ): Promise<VoiceResponse> {
    // Determine appropriate thinking level
    const complexity = this.assessComplexity(transcript, intent);
    const thinkLevel = complexity === 'high' ? 'ultrathink' : 
                      complexity === 'medium' ? 'think_harder' : 'think_hard';
    
    thinkingFramework.setLevel(thinkLevel);

    // Generate contextual response
    const analysis = await thinkingFramework.think(
      'Generate natural voice response',
      {
        userInput: transcript,
        intent,
        entities,
        conversationHistory: this.session!.context.history.slice(-5),
        voiceConfig: this.config
      }
    );

    // Build voice-optimized prompt
    const voicePrompt = await promptEngineering.buildPrompt('conversational-voice', {
      input: transcript,
      context: this.session!.context,
      style: this.config.voice.style,
      formality: this.session!.context.formality
    });

    return {
      text: analysis.solution.response || "I understand. Let me help you with that.",
      speechOptions: {
        emotion: this.determineResponseEmotion(analysis),
        emphasis: this.determineEmphasis(analysis),
        rate: this.adjustSpeechRate(transcript)
      }
    };
  }

  private async processIntent(intent: Intent): Promise<IntentResult> {
    // Map intent to action
    const action = this.nlp.getActionForIntent(intent.name);
    
    if (!action) {
      return {
        success: false,
        speak: "I'm not sure how to help with that.",
        data: null
      };
    }

    // Execute action
    const result = await action.execute(intent.parameters, this.session!.context);
    
    return {
      success: true,
      speak: result.response,
      data: result.data
    };
  }

  private async generateMultiModalResponse(analysis: any, transcript: string): Promise<MultiModalResponse> {
    return {
      speech: {
        text: analysis.solution.response,
        audio: await this.speechSynthesizer.synthesize(analysis.solution.response)
      },
      visual: {
        highlights: analysis.solution.visualHighlights,
        annotations: analysis.solution.annotations
      },
      actions: analysis.solution.suggestedActions
    };
  }

  private detectEmotion(features: AudioFeatures): Emotion[] {
    // Analyze audio features for emotion
    const emotions: Emotion[] = [];
    
    if (features.pitch.variance > 0.3) {
      emotions.push({ type: 'surprise', intensity: features.pitch.variance });
    }
    
    if (features.energy < 0.3) {
      emotions.push({ type: 'sadness', intensity: 1 - features.energy });
    }
    
    return emotions;
  }

  private detectStress(features: AudioFeatures): number {
    // Combine multiple indicators
    const stressIndicators = [
      features.pitch.mean > 200 ? 0.3 : 0,
      features.speechRate > 150 ? 0.3 : 0,
      features.energy > 0.7 ? 0.2 : 0,
      features.jitter > 0.02 ? 0.2 : 0
    ];
    
    return Math.min(1, stressIndicators.reduce((a, b) => a + b, 0));
  }

  private detectSpeakerConfidence(features: AudioFeatures): number {
    // Higher confidence = steady pitch, consistent pace, clear articulation
    const confidence = 1 - (
      features.pitch.variance * 0.3 +
      features.shimmer * 0.3 +
      (1 - features.articulation) * 0.4
    );
    
    return Math.max(0, Math.min(1, confidence));
  }

  private analyzeSpeechPace(features: AudioFeatures): 'slow' | 'normal' | 'fast' {
    if (features.speechRate < 120) return 'slow';
    if (features.speechRate > 180) return 'fast';
    return 'normal';
  }

  private analyzeClarify(features: AudioFeatures): number {
    return features.articulation;
  }

  private async analyzeVoiceSamples(samples: AudioSegment[]): Promise<VoiceCharacteristics> {
    // Analyze voice characteristics from samples
    const features = await Promise.all(
      samples.map(sample => this.audioProcessor.extractFeatures(sample.data))
    );
    
    // Average features
    const avgPitch = features.reduce((sum, f) => sum + f.pitch.mean, 0) / features.length;
    
    return {
      gender: avgPitch > 165 ? 'female' : 'male',
      accent: 'neutral', // Would need more sophisticated analysis
      emphasis: 'medium',
      expressiveness: 0.6,
      formality: 0.5,
      warmth: 0.7
    };
  }

  private async saveVoiceProfile(profile: VoiceProfile): Promise<void> {
    // Save to storage
    this.emit('profile:saved', profile);
  }

  private setupWakeWordDetection() {
    // Set up continuous wake word listening
    this.audioProcessor.on('wakeword:possible', async (audio) => {
      const transcript = await this.speechRecognizer.quickRecognize(audio);
      if (transcript.toLowerCase().includes(this.config.wakeWord!.toLowerCase())) {
        this.emit('wakeword:detected');
        await this.startListening();
      }
    });
  }

  private updateState(state: SessionState) {
    if (!this.session) return;
    
    const previousState = this.session.state;
    this.session.state = state;
    this.emit('state:changed', { from: previousState, to: state });
  }

  private addToHistory(turn: Partial<ConversationTurn>) {
    if (!this.session) return;
    
    const completeTurn: ConversationTurn = {
      id: this.generateId(),
      timestamp: new Date(),
      confidence: 1.0,
      ...turn
    } as ConversationTurn;
    
    this.session.context.history.push(completeTurn);
    this.session.metrics.totalTurns++;
  }

  private updateMetrics(response: any) {
    if (!this.session) return;
    
    // Update response time
    const responseTime = Date.now() - this.session.context.history.slice(-1)[0].timestamp.getTime();
    const currentAvg = this.session.metrics.averageResponseTime;
    const totalTurns = this.session.metrics.totalTurns;
    
    this.session.metrics.averageResponseTime = 
      (currentAvg * (totalTurns - 1) + responseTime) / totalTurns;
  }

  private handleRecognitionError(error: any) {
    console.error('Speech recognition error:', error);
    this.emit('error', error);
    
    if (this.session) {
      this.updateState(SessionState.ERROR);
    }
  }

  private handleProcessingError(error: any) {
    console.error('Processing error:', error);
    this.speak("I encountered an error processing that. Could you try again?");
  }

  private assessComplexity(transcript: string, intent: Intent | null): 'low' | 'medium' | 'high' {
    const wordCount = transcript.split(' ').length;
    
    if (wordCount > 50) return 'high';
    if (intent && intent.name.includes('complex')) return 'high';
    if (wordCount > 20) return 'medium';
    
    return 'low';
  }

  private determineResponseEmotion(analysis: any): string | undefined {
    if (analysis.solution.emotion) {
      return analysis.solution.emotion;
    }
    
    // Default based on content
    if (analysis.solution.response?.includes('!')) return 'enthusiastic';
    if (analysis.solution.response?.includes('?')) return 'curious';
    
    return undefined;
  }

  private determineEmphasis(analysis: any): string[] | undefined {
    return analysis.solution.emphasis;
  }

  private adjustSpeechRate(transcript: string): number {
    // Slow down for complex information
    if (transcript.includes('explain') || transcript.includes('describe')) {
      return 0.9;
    }
    
    return this.config.speechRate;
  }

  private getLastClaudeResponse(): ConversationTurn | undefined {
    if (!this.session) return undefined;
    
    return this.session.context.history
      .filter(turn => turn.speaker === 'claude')
      .pop();
  }

  private generateSessionId(): string {
    return `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting Classes

class AudioProcessor extends EventEmitter {
  private config: VoiceConfig;
  private audioContext: any; // Would be AudioContext in browser
  private mediaStream: any; // Would be MediaStream

  constructor(config: VoiceConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize audio context and get user media
    this.emit('initialized');
  }

  async startRecording(): Promise<void> {
    // Start recording audio
    this.emit('recording:started');
  }

  async stopRecording(): Promise<void> {
    // Stop recording
    this.emit('recording:stopped');
  }

  async playAudio(audio: AudioSegment): Promise<void> {
    // Play audio through speakers
    return new Promise(resolve => {
      setTimeout(resolve, audio.duration);
    });
  }

  async stopPlayback(): Promise<void> {
    // Stop current playback
  }

  async extractFeatures(audio: ArrayBuffer): Promise<AudioFeatures> {
    // Extract audio features for analysis
    return {
      pitch: { mean: 150, variance: 0.2 },
      energy: 0.6,
      speechRate: 140,
      jitter: 0.01,
      shimmer: 0.02,
      articulation: 0.9
    };
  }

  async shutdown(): Promise<void> {
    // Clean up resources
  }
}

class SpeechRecognizer extends EventEmitter {
  private config: VoiceConfig;
  private recognizer: any; // Would be SpeechRecognition API

  constructor(config: VoiceConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    // Start recognition
  }

  async stop(): Promise<void> {
    // Stop recognition
  }

  async recognize(audio: ArrayBuffer): Promise<string> {
    // Recognize speech from audio
    return "Recognized speech";
  }

  async quickRecognize(audio: ArrayBuffer): Promise<string> {
    // Fast recognition for wake word
    return "quick recognition";
  }

  processAudio(audio: ArrayBuffer): void {
    // Process incoming audio
  }

  setMode(mode: string): void {
    // Set recognition mode
  }
}

class SpeechSynthesizer {
  private config: VoiceConfig;

  constructor(config: VoiceConfig) {
    this.config = config;
  }

  async synthesize(text: string, options?: any): Promise<AudioSegment> {
    // Synthesize speech
    return {
      data: new ArrayBuffer(1000),
      format: 'wav',
      duration: text.length * 100, // Rough estimate
      sampleRate: 44100
    };
  }

  setEnunciation(style: string): void {
    // Set enunciation style
  }
}

class NaturalLanguageProcessor {
  private commands: Map<string, VoiceCommand> = new Map();
  private intents: Map<string, IntentHandler> = new Map();

  async parseIntent(text: string, context: ConversationContext): Promise<Intent | null> {
    // Parse intent from text
    return {
      name: 'general_query',
      confidence: 0.85,
      parameters: {}
    };
  }

  async extractEntities(text: string): Promise<Entity[]> {
    // Extract entities from text
    return [];
  }

  registerCommand(command: VoiceCommand): void {
    command.phrases.forEach(phrase => {
      this.commands.set(phrase.toLowerCase(), command);
    });
  }

  getActionForIntent(intentName: string): IntentHandler | undefined {
    return this.intents.get(intentName);
  }
}

class ContextManager {
  private mode: string = 'default';
  private modeConfig: any = {};
  private context: Map<string, any> = new Map();

  setMode(mode: string, config: any): void {
    this.mode = mode;
    this.modeConfig = config;
  }

  updateContext(updates: any): void {
    Object.entries(updates).forEach(([key, value]) => {
      this.context.set(key, value);
    });
  }

  getContext(): any {
    return Object.fromEntries(this.context);
  }
}

// Type Definitions

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  emotion?: string;
  emphasis?: string[];
}

export interface ConversationOptions {
  turnTaking?: 'automatic' | 'manual';
  allowInterruptions?: boolean;
  backchanneling?: boolean;
  useFillers?: boolean;
}

export interface DictationOptions {
  autoPunctuation?: boolean;
  autoFormatting?: boolean;
  voiceCommands?: boolean;
}

export interface VoiceCommand {
  phrases: string[];
  action: (params?: any) => Promise<void>;
  description?: string;
}

export interface VoiceResponse {
  text: string;
  speechOptions?: SpeakOptions;
}

export interface IntentResult {
  success: boolean;
  speak: string;
  data: any;
}

export interface MultiModalResponse {
  speech: {
    text: string;
    audio: AudioSegment;
  };
  visual: {
    highlights: any[];
    annotations: any[];
  };
  actions: any[];
}

export interface VoiceAnalysis {
  emotion: Emotion[];
  stress: number;
  confidence: number;
  pace: 'slow' | 'normal' | 'fast';
  clarity: number;
}

export interface AccessibilityOptions {
  slowSpeech?: boolean;
  increasedVolume?: boolean;
  clearEnunciation?: boolean;
  repeatOnRequest?: boolean;
}

export interface AudioFeatures {
  pitch: { mean: number; variance: number };
  energy: number;
  speechRate: number;
  jitter: number;
  shimmer: number;
  articulation: number;
}

export interface VoiceCharacteristics {
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  emphasis: 'low' | 'medium' | 'high';
  expressiveness: number;
  formality: number;
  warmth: number;
}

export interface IntentHandler {
  execute: (parameters: any, context: any) => Promise<any>;
}

// Export factory function
export function createVoiceInterface(config: VoiceConfig): VoiceInterface {
  return new VoiceInterface(config);
}