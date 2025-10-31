

import { GoogleGenAI, Content, Modality, GenerateContentResponse, LiveServerMessage, Blob, Type, GenerateVideosResponse } from '@google/genai';
import { Source, ChatMessage, GenerationMode, PerformanceMode, AttachedFile, AspectRatio } from '../types';

// Per coding guidelines, API key is assumed to be available in process.env.API_KEY
let ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// --- Utilities ---
const buildGeminiHistory = (messages: ChatMessage[]): Content[] => {
    return messages
      .filter(msg => (msg.type === 'text' || msg.type === 'code') && msg.id !== '1') // Exclude initial message and non-text
      .map(message => ({
        role: message.sender === 'user' ? 'user' : 'model',
        parts: [{ text: message.content }],
    }));
};

const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise(resolve => {
        if (!navigator.geolocation) {
            resolve(null);
        }
        navigator.geolocation.getCurrentPosition(
            position => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            }),
            () => resolve(null),
            { timeout: 5000 }
        );
    });
};

// --- Core Generation Logic ---

export async function generateContent(
    prompt: string, 
    history: ChatMessage[],
    mode: GenerationMode,
    performanceMode: PerformanceMode,
    attachedFile?: AttachedFile,
    aspectRatio?: AspectRatio,
): Promise<Partial<ChatMessage>> {
    try {
        if (attachedFile && mode === 'text') {
            return await analyzeImageWithText(prompt, attachedFile);
        }

        switch (mode) {
            case 'imageGen':
                return await generateNewImage(prompt, performanceMode, aspectRatio);
            case 'imageEdit':
                 if (!attachedFile) throw new Error("An image must be attached for editing.");
                return await editImage(prompt, attachedFile);
            case 'code':
                return await generateCode(prompt, history, performanceMode);
            case 'videoGen':
                // This is handled separately due to its async nature
                throw new Error("Video generation must be initiated via its specific service function.");
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
    // FIX: Use 'gemini-flash-lite-latest' for speed mode as per guidelines
    const modelName = performanceMode === 'quality' ? 'gemini-2.5-pro' : 'gemini-flash-lite-latest';
    const isLocationQuery = /(nearby|near me|directions|how to get to|closest|where is)/i.test(prompt);
    
    const tools: any[] = [{ googleSearch: {} }];
    let toolConfig: any = {};

    if (isLocationQuery) {
        const location = await getCurrentLocation();
        if (location) {
            tools.push({ googleMaps: {} });
            toolConfig.retrievalConfig = { latLng: location };
        }
    }
    
    const response = await ai.models.generateContent({
        model: modelName,
        contents: [...buildGeminiHistory(history), { role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools,
            toolConfig,
            ...(performanceMode === 'quality' && { thinkingConfig: { thinkingBudget: 32768 } })
        },
    });

    const sources: Source[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
        for (const chunk of groundingChunks) {
            if (chunk.web && chunk.web.uri) {
                sources.push({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
            }
            if (chunk.maps && chunk.maps.uri) {
                sources.push({ uri: chunk.maps.uri, title: chunk.maps.title || 'View on Google Maps' });
            }
        }
    }
    
    return { type: 'text', content: response.text, sources };
}

async function analyzeImageWithText(prompt: string, image: AttachedFile): Promise<Partial<ChatMessage>> {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [
            { inlineData: { data: image.data, mimeType: image.type } },
            { text: prompt }
        ] },
    });
    return { type: 'text', content: response.text };
}

async function generateNewImage(prompt: string, performanceMode: PerformanceMode, aspectRatio: AspectRatio = '1:1'): Promise<Partial<ChatMessage>> {
    if (performanceMode === 'quality') {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio },
        });
        const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
        if (base64ImageBytes) return { type: 'image', content: base64ImageBytes };
    } else {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData) return { type: 'image', content: part.inlineData.data };
    }
    return { type: 'error', content: 'A vision was attempted, but the void returned nothing.' };
}

async function editImage(prompt: string, image: AttachedFile): Promise<Partial<ChatMessage>> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [
            { inlineData: { data: image.data, mimeType: image.type } },
            { text: prompt }
        ]},
        config: { responseModalities: [Modality.IMAGE] },
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) return { type: 'image', content: part.inlineData.data };
    return { type: 'error', content: 'The vision could not be altered as requested.' };
}

async function generateCode(prompt: string, history: ChatMessage[], performanceMode: PerformanceMode): Promise<Partial<ChatMessage>> {
    // FIX: Use 'gemini-flash-lite-latest' for speed mode as per guidelines
    const modelName = performanceMode === 'quality' ? 'gemini-2.5-pro' : 'gemini-flash-lite-latest';
    const response = await ai.models.generateContent({
        model: modelName,
        contents: [...buildGeminiHistory(history), { role: 'user', parts: [{ text: prompt }] }],
        config: {
            systemInstruction: "You are a coding assistant. Return only the raw code block itself.",
            ...(performanceMode === 'quality' && { thinkingConfig: { thinkingBudget: 32768 } })
        }
    });
    const cleanedCode = response.text.replace(/^```(?:\w+\n)?/, '').replace(/```$/, '').trim();
    return { type: 'code', content: cleanedCode || "The logic could not be materialized." };
}

// --- Video Service ---
// FIX: Replace VideosOperation with `any` as it is not exported from @google/genai
export async function generateVideo(prompt: string, aspectRatio: AspectRatio, image?: AttachedFile): Promise<any> {
    // Re-create instance to ensure latest API key is used
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    try {
        return await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            ...(image && { image: { imageBytes: image.data, mimeType: image.type } }),
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio === '16:9' || aspectRatio === '9:16' ? aspectRatio : '16:9',
            }
        });
    } catch (e) {
        if (e.message.includes("Requested entity was not found")) {
            // This signals a potential API key issue. The UI should handle this.
            throw new Error("API_KEY_INVALID");
        }
        throw e;
    }
}

// FIX: Replace VideosOperation with `any` as it is not exported from @google/genai
export async function pollVideoStatus(operation: any): Promise<any> {
    // Re-create instance to ensure latest API key is used
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    return await ai.operations.getVideosOperation({ operation });
}


// --- TTS Service ---
export async function generateSpeech(text: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? '';
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

// This is reused for TTS audio output
export function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// This is reused for TTS audio output
export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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
                    if (base64Audio && this.outputAudioContext) {
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

        this.inputAudioContext?.close().catch(console.error);
        this.outputAudioContext?.close().catch(console.error);
        this.inputAudioContext = null;
        this.outputAudioContext = null;

        this.sources.forEach(s => {
            try { s.stop(); } catch(e) {}
        });
        this.sources.clear();
    }
}

export const liveSessionManager = new LiveSessionManager();