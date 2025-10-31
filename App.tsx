
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GenerationMode, ThemeName, PerformanceMode, VCStatus } from './types';
import { THEMES, INITIAL_MESSAGES } from './constants';
import { generateContent, liveSessionManager } from './services/geminiService';
import Message from './components/Message';
import { TextIcon, ImageIcon, CodeIcon, SendIcon, VCIcon, DisconnectIcon } from './components/Icons';
import { LiveServerMessage } from '@google/genai';


const appStyles = `
  :root {
    font-family: 'Space Mono', monospace;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body, html, #root {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    background-color: var(--background);
    color: var(--text-primary);
    overflow: hidden;
  }

  /* App Layout */
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background-color: var(--background);
    transition: background-color 0.3s ease;
  }

  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--secondary);
    background-color: var(--surface);
    flex-shrink: 0;
  }

  .app-header h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.5rem;
    margin: 0;
    color: var(--primary);
    text-shadow: 0 0 5px var(--primary);
  }
  
  .header-controls {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .control-group label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .control-group select {
    background-color: var(--background);
    color: var(--text-primary);
    border: 1px solid var(--secondary);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: 'Space Mono', monospace;
    cursor: pointer;
  }
  
  /* Performance Toggle */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 100px;
    height: 28px;
  }
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--secondary);
    transition: .4s;
    border-radius: 28px;
  }
  .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    background-color: var(--text-primary);
    transition: .4s;
    border-radius: 50%;
  }
  input:checked + .slider {
    background-color: var(--primary);
  }
  input:checked + .slider:before {
    transform: translateX(72px);
  }
  .slider-text {
    position: absolute;
    width: 100%;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.7rem;
    font-weight: bold;
    color: var(--text-primary);
    text-align: center;
    pointer-events: none;
  }
  .slider-text-left {
    left: -28px;
  }
  .slider-text-right {
    right: -28px;
  }


  .chat-window {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .message-list {
    flex-grow: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Input Area */
  .input-area {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-top: 1px solid var(--secondary);
    background-color: var(--surface);
    gap: 0.5rem;
    min-height: 85px;
  }

  .input-area textarea {
    flex-grow: 1;
    background-color: var(--background);
    color: var(--text-primary);
    border: 1px solid var(--secondary);
    border-radius: 6px;
    padding: 0.75rem;
    font-family: 'Space Mono', monospace;
    resize: none;
    max-height: 150px;
    overflow-y: auto;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .input-area textarea:focus {
    outline: none;
    border-color: var(--primary);
  }
  
  .input-area button {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: 1px solid var(--secondary);
    color: var(--text-secondary);
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .input-area button > svg {
    width: 20px;
    height: 20px;
  }
  
  .input-area button:hover:not(:disabled) {
    background-color: var(--secondary);
    color: var(--text-primary);
  }

  .input-area button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .input-area .mode-selector button.active {
    background-color: var(--primary);
    color: var(--background);
    border-color: var(--primary);
  }

  .input-area button.send-button {
    padding: 0.75rem;
  }
  
  .input-area button.vc-button {
     padding: 0.75rem;
     width: 120px;
     gap: 0.5rem;
     font-family: 'Space Mono', monospace;
  }
  .input-area button.vc-button.disconnect {
      background-color: var(--error);
      border-color: var(--error);
      color: var(--text-primary);
  }


  .mode-selector {
    display: flex;
    gap: 0.5rem;
    border-right: 1px solid var(--secondary);
    padding-right: 0.75rem;
    margin-right: 0.25rem;
  }
  
  .vc-input-area {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }
  
  .vc-status {
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .vc-status.error {
    color: var(--error);
  }


  /* Message Styling */
  .message-container {
    display: flex;
    gap: 0.75rem;
    max-width: 80%;
    align-items: flex-end;
  }

  .message-container.message-user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-container.message-ai {
    align-self: flex-start;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--secondary);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  .message-user .avatar {
    background-color: var(--primary);
    color: var(--background);
  }

  .message-content {
    background-color: var(--surface);
    padding: 0.75rem 1rem;
    border-radius: 12px;
    min-width: 50px;
  }

  .message-user .message-content {
    border-bottom-right-radius: 2px;
  }

  .message-ai .message-content {
    border-bottom-left-radius: 2px;
  }

  .error-message {
    color: var(--error);
    font-style: italic;
  }

  .sources-container {
    margin-top: 1rem;
    border-top: 1px solid var(--secondary);
    padding-top: 0.75rem;
  }

  .sources-container h4 {
    margin: 0 0 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .sources-container ul {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .sources-container a {
    color: var(--primary);
    text-decoration: none;
    font-size: 0.85rem;
    transition: opacity 0.2s;
  }

  .sources-container a:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  /* Image Content */
  .image-container {
    position: relative;
    max-width: 300px;
  }

  .generated-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    display: block;
  }

  .image-container .overlay-button {
    position: absolute;
    top: 8px;
    right: 8px;
    background-color: rgba(0,0,0,0.6);
    color: white;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .image-container:hover .overlay-button {
    opacity: 1;
  }

  /* Code Content */
  .code-block-container {
    background-color: var(--background);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--secondary);
    min-width: 400px;
  }

  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: var(--secondary);
    padding: 0.25rem 0.75rem;
    color: var(--text-primary);
    font-size: 0.85rem;
  }

  .code-actions {
    display: flex;
    gap: 0.5rem;
  }

  .code-actions button {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    transition: color 0.2s;
  }
  .code-actions button:hover {
    color: var(--primary);
  }
  .code-actions button svg {
    width: 18px;
    height: 18px;
  }

  .code-preview {
    margin: 0;
    padding: 0.75rem;
    max-height: 300px;
    overflow: auto;
    font-size: 0.9rem;
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 10px 0;
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background-color: var(--text-secondary);
    border-radius: 50%;
    animation: typing 1s infinite ease-in-out;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }

  /* Modal Styling */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background-color: var(--background);
    border: 1px solid var(--secondary);
    border-radius: 12px;
    width: 90%;
    max-width: 800px;
    height: 80%;
    max-height: 600px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--secondary);
    background-color: var(--surface);
    flex-shrink: 0;
  }

  .modal-header h3 {
    margin: 0;
    font-family: 'Orbitron', sans-serif;
    color: var(--primary);
  }

  .modal-header .close-button {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    transition: color 0.2s;
  }

  .modal-header .close-button:hover {
    color: var(--text-primary);
  }

  .modal-body {
    flex-grow: 1;
    padding: 0;
    overflow: hidden;
  }

  .code-sandbox-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
`;


const App: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<GenerationMode>('text');
    const [theme, setTheme] = useState<ThemeName>('EmbraceTheVoid');
    const [performanceMode, setPerformanceMode] = useState<PerformanceMode>('speed');
    const [vcStatus, setVcStatus] = useState<VCStatus>('disconnected');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const currentInputMessageId = useRef<string | null>(null);
    const currentAiMessageId = useRef<string | null>(null);

    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

    const handleSend = async () => {
        // FIX: Add a guard to prevent sending messages in 'vc' mode, which also fixes the type error.
        if (input.trim() === '' || isLoading || mode === 'vc') return;

        const userMessage: ChatMessage = {
            id: generateId(),
            sender: 'user',
            type: mode, 
            content: input.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const aiResponse = await generateContent(userMessage.content, messages, mode, performanceMode);
            
            const aiMessage: ChatMessage = {
                id: generateId(),
                sender: 'ai',
                type: aiResponse.type || 'error',
                content: aiResponse.content || 'An unexpected error occurred.',
                sources: aiResponse.sources,
            };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            const errorMessage: ChatMessage = {
                id: generateId(),
                sender: 'ai',
                type: 'error',
                content: 'Failed to get a response from the void. Please try again.'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

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

    const renderInputArea = () => {
        if (mode !== 'vc') {
            return (
                <>
                    <div className="mode-selector">
                        <button onClick={() => setMode('text')} className={mode === 'text' ? 'active' : ''} title="Text Mode"><TextIcon /></button>
                        <button onClick={() => setMode('image')} className={mode === 'image' ? 'active' : ''} title="Image Mode"><ImageIcon /></button>
                        <button onClick={() => setMode('code')} className={mode === 'code' ? 'active' : ''} title="Code Mode"><CodeIcon /></button>
                        {/* FIX: Remove className from this button. The comparison `mode === 'vc'` is always false here due to type narrowing, causing a TS error. */}
                        <button onClick={() => setMode('vc')} title="VC Mode"><VCIcon /></button>
                    </div>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={`Whisper to the void... (${mode} mode)`}
                        rows={1}
                        disabled={isLoading}
                    />
                    <button onClick={handleSend} disabled={isLoading || input.trim() === ''} title="Send Message" className="send-button">
                        <SendIcon />
                    </button>
                </>
            );
        }

        // VC Mode Input Area
        return (
            <div className="vc-input-area">
                <div className="mode-selector">
                    <button onClick={() => setMode('text')} disabled><TextIcon /></button>
                    <button onClick={() => setMode('image')} disabled><ImageIcon /></button>
                    <button onClick={() => setMode('code')} disabled><CodeIcon /></button>
                    <button onClick={() => setMode('vc')} className='active'><VCIcon /></button>
                </div>
                <div style={{flexGrow: 1, textAlign: 'center'}}>
                    {vcStatus === 'disconnected' && <button className="vc-button" onClick={handleConnectVC}>Connect VC</button>}
                    {vcStatus === 'connecting' && <div className="vc-status">Connecting...</div>}
                    {vcStatus === 'connected' && <button className="vc-button disconnect" onClick={handleDisconnectVC}><DisconnectIcon /> Disconnect</button>}
                    {vcStatus === 'error' && <div className="vc-status error">Connection Error. Please try again.</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <style>{appStyles}</style>
            <header className="app-header">
                <h1>Echoes of the Void</h1>
                <div className="header-controls">
                    <div className="control-group">
                        <label htmlFor="performance-toggle">Performance:</label>
                        <label className="toggle-switch">
                            <input id="performance-toggle" type="checkbox" checked={performanceMode === 'quality'} onChange={(e) => setPerformanceMode(e.target.checked ? 'quality' : 'speed')} />
                            <span className="slider">
                               <span className="slider-text slider-text-left">Speed</span>
                               <span className="slider-text slider-text-right">Quality</span>
                            </span>
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
                    {messages.map(msg => <Message key={msg.id} message={msg} />)}
                    {isLoading && (
                        <div className="message-container message-ai">
                             <div className="avatar">Void</div>
                             <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                             </div>
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