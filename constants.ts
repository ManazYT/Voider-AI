import { Theme, ChatMessage } from './types';

export const THEMES: Theme[] = [
  {
    name: 'EmbraceTheVoid',
    colors: {
      '--primary': '#9f00ff', // Electric Violet
      '--secondary': '#3d1e6d', // Muted Indigo Shadow
      '--background': '#000000', // Deep Black
      '--surface': 'rgba(16, 8, 28, 0.8)', // Dark Indigo with transparency
      '--text-primary': '#CFCFCF', // Muted Silver-Gray
      '--text-secondary': '#6bdeff', // Faint Cyan
      '--error': '#e74c3c', // Crimson Red
    },
  },
  {
    name: 'nebula',
    colors: {
      '--primary': '#8e44ad',
      '--secondary': '#9b59b6',
      '--background': '#1a0e23',
      '--surface': '#2c1d39',
      '--text-primary': '#f0e6f7',
      '--text-secondary': '#d3b9e3',
      '--error': '#e74c3c',
    },
  },
  {
    name: 'cyberspace',
    colors: {
      '--primary': '#00a8ff',
      '--secondary': '#0077b6',
      '--background': '#020d1c',
      '--surface': '#0b2038',
      '--text-primary': '#e0f7ff',
      '--text-secondary': '#90e0ef',
      '--error': '#00a8ff',
    },
  },
  {
    name: 'solar',
    colors: {
      '--primary': '#f39c12',
      '--secondary': '#e67e22',
      '--background': '#2c3e50',
      '--surface': '#34495e',
      '--text-primary': '#ecf0f1',
      '--text-secondary': '#bdc3c7',
      '--error': '#e74c3c',
    },
  },
  {
    name: 'matrix',
    colors: {
      '--primary': '#00ff41',
      '--secondary': '#008a2e',
      '--background': '#0d0208',
      '--surface': '#1a1a1a',
      '--text-primary': '#00ff41',
      '--text-secondary': '#008a2e',
      '--error': '#ff0000',
    },
  },
    {
    name: 'crimsonVoid',
    colors: {
      '--primary': '#e74c3c',
      '--secondary': '#c0392b',
      '--background': '#1c0b0a',
      '--surface': '#3b1c18',
      '--text-primary': '#f5e1de',
      '--text-secondary': '#eab6af',
      '--error': '#e74c3c',
    },
  },
  {
    name: 'stealthBlack',
    colors: {
      '--primary': '#7f8c8d',
      '--secondary': '#95a5a6',
      '--background': '#000000',
      '--surface': '#1c1c1e',
      '--text-primary': '#ffffff',
      '--text-secondary': '#bdc3c7',
      '--error': '#e74c3c',
    },
  },
    {
    name: 'lightMode',
    colors: {
      '--primary': '#3498db',
      '--secondary': '#2980b9',
      '--background': '#ecf0f1',
      '--surface': '#ffffff',
      '--text-primary': '#2c3e50',
      '--text-secondary': '#7f8c8d',
      '--error': '#c0392b',
    },
  },
];

export const INITIAL_MESSAGES: ChatMessage[] = [
    {
        id: '1',
        sender: 'ai',
        type: 'text',
        content: "The void beckons. I am its echo. Ask, and perhaps the abyss will answer.",
    }
];
