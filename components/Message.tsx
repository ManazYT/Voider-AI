
import React, { useState } from 'react';
import { ChatMessage } from '../types';
import { DownloadIcon, CopyIcon, PlayIcon } from './Icons';
import CodeSandboxModal from './CodeSandboxModal';

const Message: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    
    const isUser = message.sender === 'user';
    const messageClass = isUser ? 'message-user' : 'message-ai';

    const handleCopyCode = () => {
        if (message.type !== 'code') return;
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadImage = () => {
        if (message.type !== 'image') return;
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${message.content}`;
        link.download = `void-vision-${message.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderContent = () => {
        switch (message.type) {
            case 'image':
                return (
                    <div className="image-container">
                        <img src={`data:image/png;base64,${message.content}`} alt="Generated" className="generated-image" />
                        <button className="overlay-button" onClick={handleDownloadImage} title="Download Image">
                            <DownloadIcon />
                        </button>
                    </div>
                );
            case 'code':
                return (
                    <div className="code-block-container">
                        <div className="code-header">
                           <span>Generated Code</span>
                           <div className="code-actions">
                               <button onClick={handleCopyCode} title="Copy Code">
                                   {copied ? 'Copied!' : <CopyIcon />}
                               </button>
                               <button onClick={() => setIsModalOpen(true)} title="Run Code">
                                   <PlayIcon />
                               </button>
                           </div>
                        </div>
                        <pre className="code-preview">
                            <code>{message.content}</code>
                        </pre>
                        {isModalOpen && <CodeSandboxModal code={message.content} onClose={() => setIsModalOpen(false)} />}
                    </div>
                );
            case 'error':
                return <div className="error-message">{message.content}</div>;
            case 'text':
            default:
                return (
                    <div className="text-message" style={{ whiteSpace: 'pre-wrap' }}>
                        {message.content}
                        {message.sources && message.sources.length > 0 && (
                            <div className="sources-container">
                                <h4>Sources:</h4>
                                <ul>
                                    {message.sources.map((source, index) => (
                                        <li key={index}>
                                            <a href={source.uri} target="_blank" rel="noopener noreferrer">{source.title || source.uri}</a>
                                        </li>
                                    ))}
                                </ul>
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
        </div>
    );
};

export default Message;
