import { getToken } from './auth';

const API_BASE_URL = 'http://54.174.78.20:8000/api';

// Utility function to generate UUID (with fallback for browsers that don't support crypto.randomUUID)
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export interface User {
  email: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface ChatThread {
  thread_id: string;
  assistant_id: string;
  status: string;
  metadata: {
    owner: string;
    graph_id: string;
    thread_name: string;
    assistant_id: string;
  };
  user_id: string;
  created_at: string;
}

export interface VisualizationData {
  metadata?: {
    topic?: string;
    contentType?: string;
    nodeCount?: number;
    title?: string;
    [key: string]: any;
  };
  nodes?: Array<{
    id: string;
    data: {
      label: string;
      type: string;
      summary?: string;
      hoverSummary?: string;
      [key: string]: any;
    };
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
  hierarchy?: Record<string, string[]>;
  // Timeline specific
  events?: Array<{
    era?: string;
    year?: string;
    name: string;
    summary?: string;
    description?: string;
    [key: string]: any;
  }>;
  chartType?: string;
  mermaid_syntax?: string;
  // Sequence specific
  participants?: Array<{
    id: string;
    label: string;
    type: string;
    description?: string;
    [key: string]: any;
  }>;
  activations?: Array<{
    participant: string;
    startStep: number;
    endStep: number;
  }>;
  fragments?: Array<{
    type: string;
    condition?: string;
    startStep: number;
    endStep: number;
    label?: string;
  }>;
  // Generic fields
  [key: string]: any;
}

const getHeaders = (includeAuth: boolean = true): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

export class APIError extends Error {
  statusCode?: number;
  
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

const safeFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new APIError(
        `Cannot connect to API server at ${API_BASE_URL}. Please ensure the backend server is running.`,
        0
      );
    }
    throw error;
  }
};

export const registerUser = async (email: string, password: string, name: string): Promise<User> => {
  const response = await safeFetch(`${API_BASE_URL}/users/signup`, {
    method: 'POST',
    headers: getHeaders(false),
    body: JSON.stringify({ email, password, name }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Registration failed' }));
    throw new APIError(error.detail || 'Registration failed', response.status);
  }
  
  return response.json();
};

export const loginUser = async (username: string, password: string): Promise<LoginResponse> => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  
  const response = await safeFetch(`${API_BASE_URL}/users/login/access-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Login failed' }));
    throw new APIError(error.detail || 'Invalid credentials', response.status);
  }
  
  return response.json();
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await safeFetch(`${API_BASE_URL}/users/me`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new APIError('Failed to fetch user data', response.status);
  }
  
  return response.json();
};

export const createChat = async (graph_id: string = 'agent'): Promise<ChatThread> => {
  const response = await safeFetch(`${API_BASE_URL}/chat/new`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ graph_id }),
  });
  
  if (!response.ok) {
    throw new APIError('Failed to create chat', response.status);
  }
  
  return response.json();
};

export const getChatHistory = async (threadId: string, limit: number = 10) => {
  const response = await safeFetch(`${API_BASE_URL}/chat/${threadId}/history`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ limit }),
  });
  
  if (!response.ok) {
    throw new APIError('Failed to fetch chat history', response.status);
  }
  
  return response.json();
};

export const searchChats = async (limit: number = 10) => {
  const response = await safeFetch(`${API_BASE_URL}/chat/search`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ limit }),
  });
  
  if (!response.ok) {
    throw new APIError('Failed to search chats', response.status);
  }
  
  return response.json();
};

export const deleteChat = async (threadId: string) => {
  const response = await safeFetch(`${API_BASE_URL}/threads/${threadId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new APIError('Failed to delete chat', response.status);
  }
  
  return response.json();
};

export const updateChat = async (threadId: string, threadName: string): Promise<ChatThread> => {
  const response = await safeFetch(`${API_BASE_URL}/chat/${threadId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      thread_name: threadName,
    }),
  });
  
  if (!response.ok) {
    throw new APIError('Failed to update chat', response.status);
  }
  
  return response.json();
};

export const streamChatMessage = async (
  threadId: string,
  message: string,
  onMessage: (data: any) => void,
  onError: (error: Error) => void
) => {
  try {
    const response = await safeFetch(`${API_BASE_URL}/threads/${threadId}/runs/stream`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        input: {
          messages: [
            {
              id: generateUUID(),
              type: 'human',
              content: [
                {
                  type: 'text',
                  text: message,
                },
              ],
            },
          ],
        },
        stream_mode: ['messages'],
      }),
    });

    if (!response.ok) {
      throw new APIError('Failed to stream message', response.status);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new APIError('No reader available');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onMessage(data);
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof APIError) {
      onError(error);
    } else {
      onError(new APIError('Stream error: ' + (error as Error).message));
    }
    throw error;
  }
};

export const parseVisualizationFromResponse = (responseText: string): VisualizationData | null => {
  try {
    // First, try to find JSON in code blocks (```json ... ```)
    const jsonCodeBlockMatch = responseText.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonCodeBlockMatch) {
      const jsonStr = jsonCodeBlockMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      if (isValidVisualization(parsed)) {
        return parsed;
      }
    }
    
    // Try to find JSON in generic code blocks (``` ... ```)
    const codeBlockMatch = responseText.match(/```\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      const jsonStr = codeBlockMatch[1].trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (isValidVisualization(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Not valid JSON, continue to next attempt
      }
    }
    
    // Try to find a JSON object anywhere in the text
    const jsonObjectMatch = responseText.match(/(\{[\s\S]*\})/);
    if (jsonObjectMatch) {
      try {
        const jsonStr = jsonObjectMatch[1];
        const parsed = JSON.parse(jsonStr);
        if (isValidVisualization(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Not valid JSON, continue
      }
    }
    
    // Try to parse the entire response as JSON
    try {
      const parsed = JSON.parse(responseText);
      if (isValidVisualization(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Not valid JSON
    }
    
    return null;
  } catch (e) {
    console.error('Failed to parse visualization data:', e);
    return null;
  }
};

const isValidVisualization = (obj: any): boolean => {
  // Check for mindmap, graph, or knowledge graph structure (nodes + edges)
  if (obj.nodes && Array.isArray(obj.nodes) && obj.edges && Array.isArray(obj.edges)) {
    return true;
  }
  
  // Check for timeline structure
  if (obj.events && Array.isArray(obj.events) && (obj.metadata?.title || obj.chartType === 'timeline')) {
    return true;
  }
  
  // Check for sequence diagram structure
  if (obj.participants && Array.isArray(obj.participants) && (obj.events || obj.metadata?.title)) {
    return true;
  }
  
  return false;
};

// File upload types
export interface UploadedFile {
  id: string;
  thread_id: string;
  user_id: string;
  filename: string;
  file_size: number;
  mime_type: string | null;
  chunk_count: number;
  created_at: string;
}

export interface FileListResponse {
  files: UploadedFile[];
  total: number;
}

export interface FileDeleteResponse {
  success: boolean;
  message: string;
  file_id: string;
}

// File upload functions
export const uploadFiles = async (threadId: string, files: File[]): Promise<UploadedFile[]> => {
  const formData = new FormData();
  formData.append('thread_id', threadId);
  
  for (const file of files) {
    formData.append('files', file);
  }
  
  const token = getToken();
  const response = await safeFetch(`${API_BASE_URL}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'File upload failed' }));
    throw new APIError(error.detail || 'File upload failed', response.status);
  }
  
  return response.json();
};

export const listFiles = async (threadId: string): Promise<FileListResponse> => {
  const response = await safeFetch(`${API_BASE_URL}/files/${threadId}`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new APIError('Failed to list files', response.status);
  }
  
  return response.json();
};

export const deleteFile = async (fileId: string): Promise<FileDeleteResponse> => {
  const response = await safeFetch(`${API_BASE_URL}/files/${fileId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new APIError('Failed to delete file', response.status);
  }
  
  return response.json();
};

// Format file size for display
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};