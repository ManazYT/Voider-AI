import React from 'react';
import { CloseIcon } from './Icons';

interface CodeSandboxModalProps {
    code: string;
    onClose: () => void;
}

const CodeSandboxModal: React.FC<CodeSandboxModalProps> = ({ code, onClose }) => {
    
    // Sanitize the code to prevent script tag injection in the main document
    const sanitizedCode = code.replace(/<\/script>/g, '<\\/script>');

    const iframeContent = `
        <html>
            <head>
                <style>
                    body { 
                        margin: 0; 
                        padding: 1rem; 
                        font-family: Menlo, Monaco, 'Courier New', monospace; 
                        background-color: var(--surface, #1a1a1a); 
                        color: var(--text-primary, #f0f0f0);
                        font-size: 14px;
                    }
                    #output { 
                        border-top: 1px solid var(--secondary, #444); 
                        margin-top: 1rem; 
                        padding-top: 1rem; 
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    #output p {
                        margin: 0 0 0.5rem;
                        line-height: 1.4;
                    }
                    #output .error {
                        color: var(--error, #e74c3c);
                    }
                </style>
            </head>
            <body>
                <div id="output"></div>
                <script>
                    (function() {
                        const output = document.getElementById('output');
                        const originalLog = console.log;
                        const originalError = console.error;
                        const originalWarn = console.warn;

                        const createLogElement = (content, className = '') => {
                            const p = document.createElement('p');
                            p.textContent = content;
                            if (className) {
                                p.className = className;
                            }
                            output.appendChild(p);
                        };

                        console.log = (...args) => {
                            originalLog.apply(console, args);
                            createLogElement(args.map(arg => {
                                try {
                                    return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                                } catch(e) {
                                    return '[Unserializable Object]';
                                }
                            }).join(' '));
                        };
                        
                        console.error = (...args) => {
                            originalError.apply(console, args);
                            createLogElement('ERROR: ' + args.join(' '), 'error');
                        };

                        console.warn = (...args) => {
                            originalWarn.apply(console, args);
                            createLogElement('WARN: ' + args.join(' '), 'warn');
                        };

                        window.addEventListener('error', (event) => {
                           createLogElement('UNCAUGHT ERROR: ' + event.message, 'error');
                        });

                        try {
                            ${sanitizedCode}
                        } catch (e) {
                            createLogElement('EXECUTION ERROR: ' + e.message, 'error');
                        }
                    })();
                </script>
            </body>
        </html>
    `;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Live Code Sandbox</h3>
                    <button className="close-button" onClick={onClose} title="Close">
                        <CloseIcon />
                    </button>
                </div>
                <div className="modal-body">
                    <iframe
                        srcDoc={iframeContent}
                        title="Code Sandbox"
                        sandbox="allow-scripts"
                        className="code-sandbox-iframe"
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeSandboxModal;
