import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, LogOut, MessageSquare, Trash2, Plus, ChevronLeft, ChevronRight, User as UserIcon, AlertCircle, Github } from 'lucide-react';
import { getCurrentUser, createChat, streamChatMessage, parseVisualizationFromResponse, deleteChat, searchChats, getChatHistory, updateChat, APIError, type User, type ChatThread, type VisualizationData } from '../utils/api';
import { removeToken } from '../utils/auth';
import { StructureSelector } from './StructureSelector';
import { VisualizationCanvas } from './VisualizationCanvas';
import type { StructureType } from '../types';

// Helper function to detect visualization type from parsed data
const detectVisualizationType = (data: VisualizationData | null): StructureType => {
  if (!data) return 'mindmap';
  
  // Check metadata contentType first
  if (data.metadata?.contentType) {
    const contentType = data.metadata.contentType.toLowerCase();
    if (contentType.includes('timeline')) return 'timeline';
    if (contentType.includes('sequence') || contentType.includes('diagram')) return 'sequence';
    if (contentType.includes('graph') || contentType.includes('knowledge')) return 'graph';
  }
  
  // Infer from structure
  if ('participants' in data) return 'sequence';
  if ('events' in data && Array.isArray((data as any).events)) return 'timeline';
  if ('nodes' in data && 'edges' in data) {
    // Could be mindmap or graph, check for specific indicators
    const nodes = data.nodes as any[];
    const hasTypeField = nodes.some(n => n.data?.type);
    if (hasTypeField) {
      const types = nodes.map(n => n.data?.type);
      if (types.includes('data') || types.includes('backend')) return 'graph';
    }
    return 'mindmap';
  }
  
  return 'mindmap';
};

export function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [currentThread, setCurrentThread] = useState<ChatThread | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [structureType, setStructureType] = useState<StructureType>('mindmap');
  const [visualizationData, setVisualizationData] = useState<VisualizationData | null>(null);
  const [currentTopic, setCurrentTopic] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [apiError, setApiError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
    loadThreads();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingMessage]);

  const loadUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
      handleLogout();
    }
  };

  const loadThreads = async () => {
    try {
      const response = await searchChats(50);
      setThreads(response.threads || []);
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  const handleLogout = () => {
    try {
      removeToken();
    } catch (error) {
      console.warn('Token removal error:', error);
    }
    navigate('/', { replace: true });
  };

  const handleNewChat = async () => {
    try {
      const thread = await createChat();
      setCurrentThread(thread);
      setMessages([]);
      setVisualizationData(null);
      setCurrentTopic('');
      await loadThreads();
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChat(threadId);
      if (currentThread?.thread_id === threadId) {
        setCurrentThread(null);
        setMessages([]);
        setVisualizationData(null);
        setCurrentTopic('');
      }
      await loadThreads();
    } catch (error) {
      console.error('Failed to delete thread:', error);
    }
  };

  const handleThreadClick = async (thread: ChatThread) => {
    setCurrentThread(thread);
    setMessages([]);
    setVisualizationData(null);
    setCurrentTopic('');
    setStructureType('mindmap');
    setApiError('');
    
    try {
      console.log(`Loading chat history for thread: ${thread.thread_id}`);
      const historyResponse = await getChatHistory(thread.thread_id, 100);
      console.log('Raw history response:', historyResponse);
      
      const loadedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      let latestVisualization: VisualizationData | null = null;
      let firstUserMessage = '';
      
      // historyResponse is List[ThreadState] - array of checkpoints
      if (Array.isArray(historyResponse) && historyResponse.length > 0) {
        console.log(`Found ${historyResponse.length} checkpoints`);
        
        for (const checkpoint of historyResponse) {
          if (checkpoint.values?.messages && Array.isArray(checkpoint.values.messages)) {
            console.log(`Checkpoint has ${checkpoint.values.messages.length} messages`);
            
            for (const msg of checkpoint.values.messages) {
              if (msg.type === 'human') {
                let content = '';
                if (typeof msg.content === 'string') {
                  content = msg.content;
                } else if (Array.isArray(msg.content) && msg.content[0]?.text) {
                  content = msg.content[0].text;
                }
                
                if (content) {
                  const isDuplicate = loadedMessages.some(m => m.role === 'user' && m.content === content);
                  if (!isDuplicate) {
                    loadedMessages.push({ role: 'user', content });
                    if (!firstUserMessage) {
                      firstUserMessage = content;
                    }
                  }
                }
              } else if (msg.type === 'ai') {
                let content = '';
                if (typeof msg.content === 'string') {
                  content = msg.content;
                } else if (Array.isArray(msg.content) && msg.content[0]?.text) {
                  content = msg.content[0].text;
                }
                
                if (content && content.trim()) {
                  const isDuplicate = loadedMessages.some(m => m.role === 'assistant' && m.content === content);
                  if (!isDuplicate) {
                    loadedMessages.push({ role: 'assistant', content });
                    // Try to parse visualization from AI messages
                    const parsedData = parseVisualizationFromResponse(content);
                    if (parsedData) {
                      latestVisualization = parsedData;
                      console.log('Found visualization in AI message');
                    }
                  }
                }
              } else if (msg.type === 'tool') {
                // Include tool call messages in the history
                let content = '';
                if (typeof msg.content === 'string') {
                  content = msg.content;
                } else if (Array.isArray(msg.content) && msg.content[0]?.text) {
                  content = msg.content[0].text;
                }
                
                if (content && content.trim()) {
                  const isDuplicate = loadedMessages.some(m => m.role === 'assistant' && m.content === content);
                  if (!isDuplicate) {
                    // Display tool messages as assistant messages so they appear in the chat
                    loadedMessages.push({ role: 'assistant', content });
                    
                    // Try to parse visualization from tool output
                    try {
                      const parsedData = parseVisualizationFromResponse(content);
                      if (parsedData) {
                        latestVisualization = parsedData;
                        console.log('Found visualization in tool output');
                      }
                    } catch (e) {
                      // Tool output may not always contain visualization data
                      console.log('Tool output does not contain visualization');
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      console.log(`Loaded ${loadedMessages.length} messages`);
      setMessages(loadedMessages);
      if (firstUserMessage) {
        setCurrentTopic(firstUserMessage);
      }
      if (latestVisualization) {
        setVisualizationData(latestVisualization);
        const detectedType = detectVisualizationType(latestVisualization);
        setStructureType(detectedType);
        console.log(`Detected visualization type: ${detectedType}`);
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      setApiError(`Failed to load chat history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStructureChange = async (newType: StructureType) => {
    if (!currentTopic || isRegenerating || newType === structureType) return;

    setStructureType(newType);
    setIsRegenerating(true);
    setStreamingMessage('');

    // Map structure type to user message that the orchestrator will understand
    const structurePrompts: Record<StructureType, string> = {
      mindmap: `Generate a mind map for: ${currentTopic}`,
      timeline: `Show a timeline for: ${currentTopic}`,
      graph: `Generate a knowledge graph for: ${currentTopic}`,
      sequence: `Generate a sequence diagram for: ${currentTopic}`,
    };

    const regenerateMessage = structurePrompts[newType];
    
    let threadToUse = currentThread;
    if (!threadToUse) {
      try {
        threadToUse = await createChat();
        setCurrentThread(threadToUse);
      } catch (error) {
        console.error('Failed to create thread:', error);
        setIsRegenerating(false);
        return;
      }
    }

    setMessages((prev) => [...prev, { role: 'user', content: regenerateMessage }]);

    let fullResponse = '';

    try {
      await streamChatMessage(
        threadToUse.thread_id,
        regenerateMessage,
        (data) => {
          if (data && Array.isArray(data) && data[0]?.content) {
            const content = data[0].content;
            if (typeof content === 'string') {
              fullResponse += content;
              setStreamingMessage(fullResponse);
              // Try to parse and update visualization in real-time
              const parsedData = parseVisualizationFromResponse(fullResponse);
              if (parsedData) {
                setVisualizationData(parsedData);
              }
            } else if (Array.isArray(content) && content[0]?.text) {
              fullResponse += content[0].text;
              setStreamingMessage(fullResponse);
              // Try to parse and update visualization in real-time
              const parsedData = parseVisualizationFromResponse(fullResponse);
              if (parsedData) {
                setVisualizationData(parsedData);
              }
            }
          }
        },
        (error) => {
          console.error('Stream error:', error);
          setIsRegenerating(false);
          setStreamingMessage('');
        }
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingMessage('');
      
      const parsedData = parseVisualizationFromResponse(fullResponse);
      if (parsedData) {
        setVisualizationData(parsedData);
        // Verify the structure type is correct
        const detectedType = detectVisualizationType(parsedData);
        if (detectedType !== newType) {
          console.warn(`Expected ${newType} but detected ${detectedType}`);
        }
      }
    } catch (error) {
      console.error('Failed to regenerate:', error);
      setStreamingMessage('');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setStreamingMessage('');
    setApiError('');

    let threadToUse = currentThread;
    const isFirstMessage = messages.length === 0;
    
    if (!threadToUse) {
      try {
        threadToUse = await createChat();
        setCurrentThread(threadToUse);
      } catch (error) {
        console.error('Failed to create thread:', error);
        setLoading(false);
        setApiError('Failed to create chat thread');
        return;
      }
    }

    if (isFirstMessage) {
      setCurrentTopic(userMessage);
    }

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    let fullResponse = '';

    try {
      await streamChatMessage(
        threadToUse.thread_id,
        userMessage,
        (data) => {
          if (data && Array.isArray(data) && data[0]?.content) {
            const content = data[0].content;
            let text = '';
            if (typeof content === 'string') {
              text = content;
            } else if (Array.isArray(content) && content[0]?.text) {
              text = content[0].text;
            }
            if (text) {
              fullResponse += text;
              setStreamingMessage(fullResponse);
              const parsedData = parseVisualizationFromResponse(fullResponse);
              if (parsedData) {
                setVisualizationData(parsedData);
              }
            }
          }
        },
        (error) => {
          console.error('Stream error:', error);
          setLoading(false);
          setStreamingMessage('');
          setApiError(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingMessage('');
      
      const parsedData = parseVisualizationFromResponse(fullResponse);
      if (parsedData) {
        setVisualizationData(parsedData);
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

      if (isFirstMessage && threadToUse) {
        try {
          const truncatedName = userMessage.length > 50 
            ? userMessage.substring(0, 50) + '...' 
            : userMessage;
          
          console.log(`Updating thread name to: ${truncatedName}`);
          const updatedThread = await updateChat(threadToUse.thread_id, truncatedName);
          console.log('Thread name updated:', updatedThread);
          
          setCurrentThread(updatedThread);
          await loadThreads();
        } catch (error) {
          console.error('Failed to update thread name:', error);
          setApiError(`Warning: Could not save chat name: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setStreamingMessage('');
      setApiError(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex">
      {/* Collapsible Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-0' : 'w-64'} transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-slate-800">
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="w-full p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors mb-4 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {!sidebarCollapsed && <span>New Chat</span>}
          </button>
          {user && !sidebarCollapsed && (
            <div className="text-sm text-slate-400">
              Welcome, {user.name}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {threads.map((thread) => (
            <div
              key={thread.thread_id}
              className={`
                group flex items-center justify-between p-3 rounded-lg mb-2 cursor-pointer
                transition-colors
                ${
                  currentThread?.thread_id === thread.thread_id
                    ? 'bg-purple-600/20 border border-purple-600/50'
                    : 'hover:bg-slate-800'
                }
              `}
              onClick={() => handleThreadClick(thread)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-300 truncate">
                  {thread.metadata.thread_name || 'Untitled Chat'}
                </span>
              </div>
              <button
                onClick={(e) => handleDeleteThread(thread.thread_id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <UserIcon className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-r-lg transition-all"
        style={{ left: sidebarCollapsed ? '0' : '256px' }}
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Visualization Area - Middle */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold italic text-white">
                  thought_tree
                </h1>
              </div>
              <a
                href="https://github.com/SaiRevanth25/thought_tree"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-800"
              >
                <Github className="w-5 h-5" />
              </a>
              {isRegenerating && (
                <div className="flex items-center gap-2 text-purple-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Regenerating {structureType}...</span>
                </div>
              )}
            </div>
            <StructureSelector
              selectedType={structureType}
              onSelect={handleStructureChange}
              disabled={!currentTopic || isRegenerating}
            />
          </div>

          {/* Visualization Canvas */}
          <div className="flex-1 p-4 overflow-hidden">
            <VisualizationCanvas data={visualizationData} structureType={structureType} />
          </div>
        </div>

        {/* Chat Interface - Right */}
        <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {apiError && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{apiError}</p>
                </div>
              </div>
            )}
            {messages.length === 0 && !loading && (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-slate-400 mb-2">Start a conversation</p>
                  <p className="text-slate-500 text-sm">
                    Enter a topic to generate a visualization
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))}
            {/* Streaming Message Display */}
            {(loading || isRegenerating) && streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg p-3 bg-slate-800 text-slate-300">
                  <p className="text-sm whitespace-pre-wrap break-words">{streamingMessage}</p>
                </div>
              </div>
            )}
            {/* Loading Animation */}
            {(loading || isRegenerating) && !streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg p-3 bg-slate-800 text-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs text-slate-400">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-800 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Enter a topic to visualize..."
                disabled={loading}
                className="flex-1 bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}