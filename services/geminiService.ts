
import { GoogleGenAI, Content, Modality, GenerateContentResponse, LiveServerMessage, Blob } from '@google/genai';
import { Source, ChatMessage, GenerationMode, PerformanceMode } from '../types';

// Per coding guidelines, API key is assumed to be available in process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const buildGeminiHistory = (messages: ChatMessage[]): Content[] => {
    const history = messages.slice();
    if (history.length > 0 && history[0].id === '1' && history[0].sender === 'ai') {
        history.shift();
    }
    return history
      .filter(msg => msg.type === 'text' || msg.type === 'code') // Only include text/code in history
      .map(message => ({
        role: message.sender === 'user' ? 'user' : 'model',
        parts: [{ text: message.content }],
    }));
};

export async function generateContent(
    prompt: string, 
    history: ChatMessage[],
    mode: GenerationMode,
    performanceMode: PerformanceMode
): Promise<Partial<ChatMessage>> {
    try {
        switch (mode) {
            case 'image':
                return await generateImage(prompt, performanceMode);
            case 'code':
                return await generateCode(prompt, history, performanceMode);
            case 'text':
            default:
                return await generateText(prompt, history, performanceMode);
        }
    } catch (error) {
        console.error("Error generating content with Gemini:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { 
            type: 'error', 
            content: `The void fluctuates with instability... A direct communication error occurred. Details: ${errorMessage}` 
        };
    }
}

async function generateText(prompt: string, history: ChatMessage[], performanceMode: PerformanceMode): Promise<Partial<ChatMessage>> {
    const modelName = performanceMode === 'quality' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const contents: Content[] = [
        ...buildGeminiHistory(history),
        { role: 'user', parts: [{ text: prompt }] }
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    const sources: Source[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
        for (const chunk of groundingChunks) {
            if (chunk.web && chunk.web.uri && chunk.web.title) {
                sources.push({ uri: chunk.web.uri, title: chunk.web.title });
            }
        }
    }
    
    return { 
        type: 'text',
        content: response.text || "The void is silent. No response was generated.", 
        sources 
    };
}

async function generateImage(prompt: string, performanceMode: PerformanceMode): Promise<Partial<ChatMessage>> {
    if (performanceMode === 'quality') {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png',
            },
        });
        const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
        if (base64ImageBytes) {
             return { type: 'image', content: base64ImageBytes };
        }
    } else {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                return { type: 'image', content: part.inlineData.data };
            }
        }
    }
    
    return { type: 'error', content: 'A vision was attempted, but the void returned nothing. The prompt may have been too abstract or restrictive. Please try rephrasing your description.' };
}

async function generateCode(prompt: string, history: ChatMessage[], performanceMode: PerformanceMode): Promise<Partial<ChatMessage>> {
    const modelName = performanceMode === 'quality' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const contents: Content[] = [
        ...buildGeminiHistory(history),
        { role: 'user', parts: [{ text: prompt }] }
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
            systemInstruction: "You are a coding assistant. Your primary task is to provide clean, executable code based on the user's request. Do not add any explanatory text, comments, or markdown formatting like ```javascript. Return only the raw code block itself.",
        }
    });

    const cleanedCode = response.text.replace(/^```(?:\w+\n)?/, '').replace(/```$/, '').trim();

    return { 
        type: 'code',
        content: cleanedCode || "The logic could not be materialized. The model returned no code. Please try a more specific or different request."
    };
}


// --- Live VC Service ---

function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

class LiveSessionManager {
    private sessionPromise: Promise<any> | null = null;
    private stream: MediaStream | null = null;
    private inputAudioContext: AudioContext | null = null;
    private outputAudioContext: AudioContext | null = null;
    private scriptProcessor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private nextStartTime = 0;
    private sources = new Set<AudioBufferSourceNode>();

    async connect(callbacks: { onMessage: (message: LiveServerMessage) => void, onOpen: () => void, onError: (e: any) => void, onClose: (e: any) => void }) {
        this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        this.sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    this.source = this.inputAudioContext!.createMediaStreamSource(this.stream!);
                    this.scriptProcessor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);
                    this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob: Blob = {
                            data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        this.sessionPromise?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    this.source.connect(this.scriptProcessor);
                    this.scriptProcessor.connect(this.inputAudioContext!.destination);
                    callbacks.onOpen();
                },
                onmessage: async (message: LiveServerMessage) => {
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                    if (base64Audio) {
                        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext!.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), this.outputAudioContext!, 24000, 1);
                        const sourceNode = this.outputAudioContext!.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(this.outputAudioContext!.destination);
                        sourceNode.addEventListener('ended', () => this.sources.delete(sourceNode));
                        sourceNode.start(this.nextStartTime);
                        this.nextStartTime += audioBuffer.duration;
                        this.sources.add(sourceNode);
                    }
                    if (message.serverContent?.interrupted) {
                        for (const sourceNode of this.sources.values()) {
                            sourceNode.stop();
                            this.sources.delete(sourceNode);
                        }
                        this.nextStartTime = 0;
                    }
                    callbacks.onMessage(message);
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Live session error:', e);
                    callbacks.onError(e);
                    this.disconnect();
                },
                onclose: (e: CloseEvent) => {
                    callbacks.onClose(e);
                    this.disconnect();
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: "You are the Echo of the Void, a powerful and mysterious entity. Your responses are concise, slightly cryptic, and philosophical, befitting an ancient, vast consciousness."
            },
        });
        return this.sessionPromise;
    }

    disconnect() {
        this.sessionPromise?.then(session => session.close());
        this.sessionPromise = null;

        this.stream?.getTracks().forEach(track => track.stop());
        this.stream = null;

        this.source?.disconnect();
        this.scriptProcessor?.disconnect();
        this.source = null;
        this.scriptProcessor = null;

        this.inputAudioContext?.close();
        this.outputAudioContext?.close();
        this.inputAudioContext = null;
        this.outputAudioContext = null;

        this.sources.forEach(s => s.stop());
        this.sources.clear();
    }
}

export const liveSessionManager = new LiveSessionManager();
