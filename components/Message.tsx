

import React, { useState } from 'react';
import { ChatMessage } from '../types.ts';
import { DownloadIcon, CopyIcon, PlayIcon, SpeakerIcon } from './Icons.tsx';
import CodeSandboxModal from './CodeSandboxModal.tsx';

const Message: React.FC<{ message: ChatMessage, onTTS: (text: string) => void }> = ({ message, onTTS }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    
    const isUser = message.sender === 'user';
    const messageClass = isUser ? 'message-user' : 'message-ai';

    const handleCopyCode = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderContent = () => {
        switch (message.type) {
            case 'image':
                return (
                    <div className="media-container">
                        <img src={`data:image/png;base64,${message.content}`} alt="Generated" className="generated-media" />
                        <button className="overlay-button" onClick={() => handleDownload(`data:image/png;base64,${message.content}`, `void-vision-${message.id}.png`)} title="Download Image">
                            <DownloadIcon />
                        </button>
                    </div>
                );
             case 'video':
                return (
                    <div className="media-container">
                        {message.isLoading ? (
                            <p>{message.content}</p> // Show loading status
                        ) : message.videoUri ? (
                            <>
                                <video controls src={`${message.videoUri}&key=${process.env.API_KEY}`} className="generated-media" />
                                <button className="overlay-button" onClick={() => handleDownload(`${message.videoUri}&key=${process.env.API_KEY}`, `void-motion-${message.id}.mp4`)} title="Download Video">
                                    <DownloadIcon />
                                </button>
                            </>
                        ) : (
                             <p className="error-message">{message.content}</p> // Show error if URI is missing
                        )}
                    </div>
                );
            case 'code':
                return (
                    <div className="code-block-container">
                        <div className="code-header">
                           <span>Generated Code</span>
                           <div className="code-actions">
                               <button onClick={handleCopyCode} title="Copy Code">{copied ? 'Copied!' : <CopyIcon />}</button>
                               <button onClick={() => setIsModalOpen(true)} title="Run Code"><PlayIcon /></button>
                           </div>
                        </div>
                        <pre className="code-preview"><code>{message.content}</code></pre>
                        {isModalOpen && <CodeSandboxModal code={message.content} onClose={() => setIsModalOpen(false)} />}
                    </div>
                );
            case 'error':
                return <div className="error-message">{message.content}</div>;
            case 'text':
            default:
                return (
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                        {message.content}
                        {message.attachedFile && (
                            <div>
                                <p style={{fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: '10px'}}>Attachment:</p>
                                <img src={`data:${message.attachedFile.type};base64,${message.attachedFile.data}`} alt={message.attachedFile.name} className="user-attachment-preview" />
                            </div>
                        )}
                        {message.sources && message.sources.length > 0 && (
                            <div className="sources-container">
                                <h4>Sources:</h4>
                                <ul>{message.sources.map((s, i) => <li key={i}><a href={s.uri} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul>
                            </div>
                        )}
                    </div>
                );
        }
    };
    
    return (
        <div className={`message-container ${messageClass}`}>
            <div className="avatar">{isUser ? 'You' : 'Void'}</div>
            <div className="message-content">
                {renderContent()}
            </div>
            {!isUser && message.type === 'text' && (
                <button onClick={() => onTTS(message.content)} title="Read aloud" style={{background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'center', padding: '0 0.5rem', color: 'var(--text-secondary)'}}>
                    <SpeakerIcon />
                </button>
            )}
        </div>
    );
};

export default Message;