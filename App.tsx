

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, GenerationMode, ThemeName, PerformanceMode, VCStatus, AttachedFile, AspectRatio } from './types';
import { THEMES, INITIAL_MESSAGES } from './constants';
import { generateContent, liveSessionManager, generateVideo, pollVideoStatus, generateSpeech, decode, decodeAudioData } from './services/geminiService';
import Message from './components/Message';
import { TextIcon, ImageIcon, CodeIcon, SendIcon, VCIcon, DisconnectIcon, VideoGenIcon, UploadIcon } from './components/Icons';
// FIX: Remove VideosOperation as it is not exported from @google/genai
import { LiveServerMessage } from '@google/genai';

// --- Helper Functions ---
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const appStyles = `
  :root { font-family: 'Space Mono', monospace; }
  *, *::before, *::after { box-sizing: border-box; }
  body, html, #root { height: 100%; width: 100%; margin: 0; padding: 0; background-color: var(--background); color: var(--text-primary); overflow: hidden; }
  .app-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; background-color: var(--background); transition: background-color 0.3s ease; }
  .app-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--secondary); background-color: var(--surface); flex-shrink: 0; }
  .app-header h1 { font-family: 'Orbitron', sans-serif; font-size: 1.5rem; margin: 0; color: var(--primary); text-shadow: 0 0 5px var(--primary); }
  .header-controls { display: flex; align-items: center; gap: 1.5rem; }
  .control-group { display: flex; align-items: center; gap: 0.5rem; }
  .control-group label { font-size: 0.9rem; color: var(--text-secondary); }
  .control-group select, .control-group button { background-color: var(--background); color: var(--text-primary); border: 1px solid var(--secondary); border-radius: 4px; padding: 0.25rem 0.5rem; font-family: 'Space Mono', monospace; cursor: pointer; }
  .control-group button:hover { border-color: var(--primary); }
  .toggle-switch { position: relative; display: inline-block; width: 100px; height: 28px; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--secondary); transition: .4s; border-radius: 28px; }
  .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: var(--text-primary); transition: .4s; border-radius: 50%; }
  input:checked + .slider { background-color: var(--primary); }
  input:checked + .slider:before { transform: translateX(72px); }
  .slider-text { position: absolute; width: 100%; top: 50%; transform: translateY(-50%); font-size: 0.7rem; font-weight: bold; color: var(--text-primary); text-align: center; pointer-events: none; }
  .slider-text-left { left: -28px; }
  .slider-text-right { right: -28px; }
  .chat-window { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
  .message-list { flex-grow: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
  .input-area { display: flex; flex-direction: column; padding: 1rem; border-top: 1px solid var(--secondary); background-color: var(--surface); gap: 0.75rem; }
  .input-main-row { display: flex; gap: 0.5rem; align-items: stretch; }
  .input-area textarea { flex-grow: 1; background-color: var(--background); color: var(--text-primary); border: 1px solid var(--secondary); border-radius: 6px; padding: 0.75rem; font-family: 'Space Mono', monospace; resize: none; max-height: 150px; overflow-y: auto; font-size: 1rem; transition: border-color 0.2s; }
  .input-area textarea:focus { outline: none; border-color: var(--primary); }
  .input-area button { display: flex; align-items: center; justify-content: center; background-color: transparent; border: 1px solid var(--secondary); color: var(--text-secondary); border-radius: 6px; padding: 0.5rem; cursor: pointer; transition: all 0.2s ease; }
  .input-area button > svg { width: 20px; height: 20px; }
  .input-area button:hover:not(:disabled) { background-color: var(--secondary); color: var(--text-primary); }
  .input-area button:disabled { opacity: 0.5; cursor: not-allowed; }
  .input-area .mode-selector button.active { background-color: var(--primary); color: var(--background); border-color: var(--primary); }
  .input-area button.send-button { padding: 0.75rem; }
  .mode-selector { display: flex; flex-wrap: wrap; gap: 0.5rem; border-right: 1px solid var(--secondary); padding-right: 0.75rem; margin-right: 0.25rem; }
  .input-options { display: flex; gap: 1rem; align-items: center; }
  .file-input-container { padding-left: 0.5rem; }
  .file-input-container label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--text-secondary); }
  .file-input-container input { display: none; }
  .file-preview { font-size: 0.8rem; color: var(--primary); }
  /* VC Area */
  .vc-input-area { width: 100%; display: flex; align-items: center; justify-content: center; gap: 1rem; min-height: 55px; }
  .vc-status { color: var(--text-secondary); font-style: italic; }
  .vc-status.error { color: var(--error); }
  .input-area button.vc-button { padding: 0.75rem; width: 120px; gap: 0.5rem; font-family: 'Space Mono', monospace; }
  .input-area button.vc-button.disconnect { background-color: var(--error); border-color: var(--error); color: var(--text-primary); }
  /* Message Styling */
  .message-container { display: flex; gap: 0.75rem; max-width: 80%; align-items: flex-end; }
  .message-container.message-user { align-self: flex-end; flex-direction: row-reverse; }
  .message-container.message-ai { align-self: flex-start; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background-color: var(--secondary); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 0.8rem; text-transform: uppercase; }
  .message-user .avatar { background-color: var(--primary); color: var(--background); }
  .message-content { background-color: var(--surface); padding: 0.75rem 1rem; border-radius: 12px; min-width: 50px; }
  .message-user .message-content { border-bottom-right-radius: 2px; }
  .message-ai .message-content { border-bottom-left-radius: 2px; }
  .error-message { color: var(--error); font-style: italic; }
  .sources-container { margin-top: 1rem; border-top: 1px solid var(--secondary); padding-top: 0.75rem; }
  .sources-container h4 { margin: 0 0 0.5rem; color: var(--text-secondary); font-size: 0.9rem; }
  .sources-container ul { margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.25rem; }
  .sources-container a { color: var(--primary); text-decoration: none; font-size: 0.85rem; transition: opacity 0.2s; }
  .sources-container a:hover { opacity: 0.8; text-decoration: underline; }
  /* Image & Video Content */
  .media-container { position: relative; max-width: 300px; }
  .generated-media { max-width: 100%; height: auto; border-radius: 8px; display: block; }
  .media-container .overlay-button { position: absolute; top: 8px; right: 8px; background-color: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
  .media-container:hover .overlay-button { opacity: 1; }
  .user-attachment-preview { max-width: 60px; max-height: 60px; border-radius: 4px; margin-top: 0.5rem; border: 1px solid var(--secondary); }
  /* Other styles from original */
  .code-block-container { background-color: var(--background); border-radius: 8px; overflow: hidden; border: 1px solid var(--secondary); min-width: 400px; }
  .code-header { display: flex; justify-content: space-between; align-items: center; background-color: var(--secondary); padding: 0.25rem 0.75rem; color: var(--text-primary); font-size: 0.85rem; }
  .code-actions { display: flex; gap: 0.5rem; }
  .code-actions button { background: none; border: none; color: var(--text-primary); cursor: pointer; padding: 0.25rem; display: flex; align-items: center; transition: color 0.2s; }
  .code-actions button:hover { color: var(--primary); }
  .code-actions button svg { width: 18px; height: 18px; }
  .code-preview { margin: 0; padding: 0.75rem; max-height: 300px; overflow: auto; font-size: 0.9rem; }
  .typing-indicator { display: flex; align-items: center; gap: 5px; padding: 10px 0; }
  .typing-indicator span { width: 8px; height: 8px; background-color: var(--text-secondary); border-radius: 50%; animation: typing 1s infinite ease-in-out; }
  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal-content { background-color: var(--background); border: 1px solid var(--secondary); border-radius: 12px; width: 90%; max-width: 800px; height: 80%; max-height: 600px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--secondary); background-color: var(--surface); flex-shrink: 0; }
  .modal-header h3 { margin: 0; font-family: 'Orbitron', sans-serif; color: var(--primary); }
  .modal-header .close-button { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0.25rem; display: flex; align-items: center; transition: color 0.2s; }
  .modal-header .close-button:hover { color: var(--text-primary); }
  .modal-body { flex-grow: 1; padding: 0; overflow: hidden; }
  .code-sandbox-iframe { width: 100%; height: 100%; border: none; }
`;

const App: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<GenerationMode>('text');
    const [theme, setTheme] = useState<ThemeName>('EmbraceTheVoid');
    const [performanceMode, setPerformanceMode] = useState<PerformanceMode>('speed');
    const [vcStatus, setVcStatus] = useState<VCStatus>('disconnected');
    const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    // FIX: Replace VideosOperation with `any` as it is not exported from @google/genai
    const [videoJobs, setVideoJobs] = useState<Record<string, any>>({});
    const [isVeoReady, setIsVeoReady] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const currentInputMessageId = useRef<string | null>(null);
    const currentAiMessageId = useRef<string | null>(null);
    const ttsAudioContext = useRef<AudioContext | null>(null);

    // --- Effects ---
    useEffect(() => {
        const selectedTheme = THEMES.find(t => t.name === theme);
        if (selectedTheme) {
            Object.entries(selectedTheme.colors).forEach(([key, value]) => {
                document.documentElement.style.setProperty(key, value);
            });
        }
    }, [theme]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setIsVeoReady(true);
            }
        };
        checkApiKey();
    }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            for (const messageId in videoJobs) {
                try {
                    let operation = videoJobs[messageId];
                    operation = await pollVideoStatus(operation);
                    
                    if (operation.done) {
                        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
                        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isLoading: false, videoUri, content: 'Video generation complete.' } : m));
                        setVideoJobs(prev => {
                            const newJobs = { ...prev };
                            delete newJobs[messageId];
                            return newJobs;
                        });
                    } else {
                         setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: `Generating video... (${(operation.metadata?.progressPercentage ?? 0).toFixed(0)}%)` } : m));
                    }
                } catch (error) {
                    console.error('Polling error:', error);
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isLoading: false, type: 'error', content: `Video generation failed. Error: ${error.message}` } : m));
                    setVideoJobs(prev => {
                        const newJobs = { ...prev };
                        delete newJobs[messageId];
                        return newJobs;
                    });
                }
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [videoJobs]);
    
    const handleSetMode = (newMode: GenerationMode) => {
        setMode(newMode);
        setAttachedFile(null); // Clear attachment when changing modes
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            setAttachedFile({ name: file.name, type: file.type, data: base64 });
        }
    };
    
    const handleVeoKeySelect = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success for immediate feedback
            setIsVeoReady(true);
        }
    };

    // --- API Call Handlers ---
    const handleSend = async () => {
        if (input.trim() === '' || isLoading || mode === 'vc') return;
        if ((mode === 'imageEdit' || (mode === 'videoGen' && input.includes('[use_image]'))) && !attachedFile) {
            // A simple way to handle image requirement for video gen is to check for a keyword
            alert("This mode requires an image to be attached.");
            return;
        }

        const userMessage: ChatMessage = {
            id: generateId(),
            sender: 'user',
            type: 'text', // User prompt is always text
            content: input.trim(),
            ...(attachedFile && { attachedFile: { ...attachedFile } })
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setAttachedFile(null);
        setIsLoading(true);

        // --- Video Generation Logic ---
        if (mode === 'videoGen') {
            const aiMessageId = generateId();
            setMessages(prev => [...prev, { id: aiMessageId, sender: 'ai', type: 'video', content: 'Initiating video generation...', isLoading: true }]);
            try {
                const operation = await generateVideo(userMessage.content, aspectRatio, attachedFile ?? undefined);
                setVideoJobs(prev => ({ ...prev, [aiMessageId]: operation }));
            } catch (error) {
                 if (error.message === "API_KEY_INVALID") {
                    setIsVeoReady(false); // Reset key state
                    setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, type: 'error', content: 'Video generation failed. The API Key is invalid or not found. Please select a valid key.', isLoading: false } : m));
                } else {
                    setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, type: 'error', content: `Video generation failed: ${error.message}`, isLoading: false } : m));
                }
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // --- Other Modes Logic ---
        try {
            const aiResponse = await generateContent(userMessage.content, messages, mode, performanceMode, attachedFile ?? undefined, aspectRatio);
            const aiMessage: ChatMessage = {
                id: generateId(),
                sender: 'ai',
                type: aiResponse.type || 'error',
                content: aiResponse.content || 'An unexpected error occurred.',
                sources: aiResponse.sources,
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            setMessages(prev => [...prev, { id: generateId(), sender: 'ai', type: 'error', content: 'Failed to get a response from the void.' }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleTTS = useCallback(async (text: string) => {
        try {
            if (!ttsAudioContext.current) {
                ttsAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const base64Audio = await generateSpeech(text);
            if (!base64Audio) return;
            const audioBuffer = await decodeAudioData(decode(base64Audio), ttsAudioContext.current, 24000, 1);
            const source = ttsAudioContext.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ttsAudioContext.current.destination);
            source.start(0);
        } catch (error) {
            console.error("TTS Error:", error);
        }
    }, []);

    // --- VC Handlers ---
    const onLiveMessage = (message: LiveServerMessage) => {
        if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            if (!currentInputMessageId.current) {
                const newId = generateId();
                currentInputMessageId.current = newId;
                setMessages(prev => [...prev, { id: newId, sender: 'user', type: 'text', content: text }]);
            } else {
                setMessages(prev => prev.map(m => m.id === currentInputMessageId.current ? { ...m, content: m.content + text } : m));
            }
        }
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
             if (!currentAiMessageId.current) {
                const newId = generateId();
                currentAiMessageId.current = newId;
                setMessages(prev => [...prev, { id: newId, sender: 'ai', type: 'text', content: text }]);
            } else {
                setMessages(prev => prev.map(m => m.id === currentAiMessageId.current ? { ...m, content: m.content + text } : m));
            }
        }
        if (message.serverContent?.turnComplete) {
            currentInputMessageId.current = null;
            currentAiMessageId.current = null;
        }
    };

    const handleConnectVC = async () => {
        setVcStatus('connecting');
        try {
            await liveSessionManager.connect({
                onOpen: () => setVcStatus('connected'),
                onClose: () => setVcStatus('disconnected'),
                onError: () => setVcStatus('error'),
                onMessage: onLiveMessage,
            });
        } catch (error) {
            console.error("Failed to connect VC:", error);
            setVcStatus('error');
            liveSessionManager.disconnect();
        }
    };

    const handleDisconnectVC = () => {
        liveSessionManager.disconnect();
        setVcStatus('disconnected');
    };

    // --- Render Methods ---
    const renderInputOptions = () => {
        const showAspectRatio = mode === 'imageGen' || mode === 'videoGen';
        const showFileUpload = mode === 'imageEdit' || mode === 'videoGen' || mode === 'text';
        const fileAccept = mode === 'text' || mode === 'imageEdit' || mode === 'videoGen' ? "image/*" : "";

        return (
            <div className="input-options">
                {showAspectRatio && (
                     <div className="control-group">
                        <label htmlFor="aspect-ratio-select">Aspect Ratio:</label>
                        <select id="aspect-ratio-select" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
                           {mode === 'imageGen' && <option value="1:1">1:1</option>}
                           <option value="16:9">16:9</option>
                           <option value="9:16">9:16</option>
                           {mode === 'imageGen' && <option value="4:3">4:3</option>}
                           {mode === 'imageGen' && <option value="3:4">3:4</option>}
                        </select>
                    </div>
                )}
                {showFileUpload && (
                    <div className="file-input-container">
                        <label htmlFor="file-upload">
                            <UploadIcon />
                            <span>{attachedFile ? 'Change' : 'Attach'} Image</span>
                        </label>
                        <input id="file-upload" type="file" accept={fileAccept} onChange={handleFileChange} />
                         {attachedFile && <span className="file-preview">{attachedFile.name}</span>}
                    </div>
                )}
                {mode === 'videoGen' && !isVeoReady && (
                     <div className="control-group">
                        <button onClick={handleVeoKeySelect}>Select API Key for Video</button>
                    </div>
                )}
            </div>
        );
    };

    const renderInputArea = () => {
        if (mode === 'vc') {
            return (
                 <div className="vc-input-area">
                    {vcStatus === 'disconnected' && <button className="vc-button" onClick={handleConnectVC}>Connect VC</button>}
                    {vcStatus === 'connecting' && <div className="vc-status">Connecting...</div>}
                    {vcStatus === 'connected' && <button className="vc-button disconnect" onClick={handleDisconnectVC}><DisconnectIcon /> Disconnect</button>}
                    {vcStatus === 'error' && <div className="vc-status error">Connection Error. Please try again.</div>}
                </div>
            );
        }
        
        return (
            <>
                <div className="input-main-row">
                    <div className="mode-selector">
                        <button onClick={() => handleSetMode('text')} className={mode === 'text' ? 'active' : ''} title="Text Mode"><TextIcon /></button>
                        <button onClick={() => handleSetMode('code')} className={mode === 'code' ? 'active' : ''} title="Code Mode"><CodeIcon /></button>
                        <button onClick={() => handleSetMode('imageGen')} className={mode === 'imageGen' ? 'active' : ''} title="Image Gen Mode"><ImageIcon /></button>
                        <button onClick={() => handleSetMode('imageEdit')} className={mode === 'imageEdit' ? 'active' : ''} title="Image Edit Mode">✏️</button>
                        <button onClick={() => handleSetMode('videoGen')} className={mode === 'videoGen' ? 'active' : ''} title="Video Gen Mode"><VideoGenIcon /></button>
                        {/* FIX: Replaced mode === 'vc' check which caused a type error with an empty string, as this button is never active in this view. */}
                        <button onClick={() => handleSetMode('vc')} className={""} title="VC Mode"><VCIcon /></button>
                    </div>
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Whisper to the void... (${mode} mode)`} rows={1} disabled={isLoading} />
                    <button onClick={handleSend} disabled={isLoading || !input.trim() || (mode === 'videoGen' && !isVeoReady) } title="Send Message" className="send-button"><SendIcon /></button>
                </div>
                {renderInputOptions()}
            </>
        );
    }

    return (
        <div className="app-container">
            <style>{appStyles}</style>
            <header className="app-header">
                <h1>Echoes of the Void</h1>
                <div className="header-controls">
                    <div className="control-group">
                        <label>Performance:</label>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={performanceMode === 'quality'} onChange={(e) => setPerformanceMode(e.target.checked ? 'quality' : 'speed')} />
                            <span className="slider"><span className="slider-text slider-text-left">Speed</span><span className="slider-text slider-text-right">Quality</span></span>
                        </label>
                    </div>
                    <div className="control-group">
                        <label htmlFor="theme-select">Theme:</label>
                        <select id="theme-select" value={theme} onChange={(e) => setTheme(e.target.value as ThemeName)}>
                            {THEMES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                        </select>
                    </div>
                </div>
            </header>
            <div className="chat-window">
                <div className="message-list">
                    {messages.map(msg => <Message key={msg.id} message={msg} onTTS={handleTTS} />)}
                    {isLoading && mode !== 'videoGen' && (
                        <div className="message-container message-ai">
                             <div className="avatar">Void</div><div className="message-content"><div className="typing-indicator"><span /><span /><span /></div></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="input-area">
                    {renderInputArea()}
                </div>
            </div>
        </div>
    );
};

export default App;