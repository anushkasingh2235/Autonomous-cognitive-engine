/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  CheckCircle2, 
  Circle, 
  FileText, 
  Folder, 
  Loader2, 
  Search, 
  Terminal, 
  Send, 
  Plus,
  ChevronRight,
  Database,
  Cpu,
  Activity,
  Download,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn, downloadFile } from './lib/utils';
import { CognitiveAgent, AgentState } from './lib/agent';

export default function App() {
  const [objective, setObjective] = useState('');
  const [state, setState] = useState<AgentState>({
    todos: [],
    files: {},
    logs: [],
    isThinking: false,
    currentTask: null
  });
  const [agent, setAgent] = useState<CognitiveAgent | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const prevIsThinking = useRef(false);

  useEffect(() => {
    setAgent(new CognitiveAgent('', (newState) => setState(newState)));
  }, []);

  // Auto-download logic
  useEffect(() => {
    if (prevIsThinking.current === true && state.isThinking === false) {
      // Agent just finished
      if (state.files['summary.md']) {
        downloadFile('summary.md', state.files['summary.md']);
      }
    }
    prevIsThinking.current = state.isThinking;
  }, [state.isThinking, state.files]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs]);

  const handleRun = async () => {
    if (!agent || !objective.trim()) return;
    await agent.run(objective);
  };

  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  const handleAddFile = () => {
    if (newFileName && agent) {
      agent.addFile(newFileName, newFileContent);
      setNewFileName('');
      setNewFileContent('');
      setIsAddingFile(false);
    }
  };

  return (
    <div className="flex h-screen bg-transparent text-slate-200 font-sans overflow-hidden">
      {/* Left Sidebar: Task List */}
      <aside className="w-80 glass border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                <Brain className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="font-serif italic text-sm uppercase tracking-widest text-indigo-300">Task Queue</h2>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-green-400 uppercase tracking-tighter">High Speed</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {state.todos.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 text-xs italic opacity-40 text-center flex flex-col items-center gap-2"
              >
                <Plus className="w-8 h-8 opacity-20" />
                No tasks planned yet
              </motion.div>
            ) : (
              state.todos.map((todo, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "p-4 rounded-xl border transition-all duration-300 flex items-start gap-4 group relative overflow-hidden",
                    todo.status === 'completed' && "bg-emerald-500/5 border-emerald-500/20 opacity-60",
                    todo.status === 'in-progress' && "bg-indigo-500/10 border-indigo-500/40 glow-border",
                    todo.status === 'pending' && "bg-white/5 border-white/10 hover:border-white/30"
                  )}
                >
                  <div className="mt-1">
                    {todo.status === 'completed' ? (
                      <div className="p-1 bg-emerald-500/20 rounded-full">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                    ) : todo.status === 'in-progress' ? (
                      <div className="p-1 bg-indigo-500/20 rounded-full">
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                      </div>
                    ) : (
                      <div className="p-1 bg-white/10 rounded-full">
                        <Circle className="w-4 h-4 opacity-30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "text-xs font-mono leading-relaxed",
                      todo.status === 'in-progress' && "text-indigo-200",
                      todo.status === 'completed' && "line-through text-slate-400"
                    )}>{todo.task}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full uppercase tracking-tighter font-bold",
                        todo.status === 'completed' && "bg-emerald-500/20 text-emerald-400",
                        todo.status === 'in-progress' && "bg-indigo-500/20 text-indigo-400",
                        todo.status === 'pending' && "bg-white/10 text-slate-400"
                      )}>
                        {todo.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
        <div className="p-6 border-t border-white/10 bg-white/5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-mono font-bold">
            <span className="text-slate-400">Engine Status</span>
            <span className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full shadow-lg", 
                state.isThinking ? "bg-amber-400 animate-pulse shadow-amber-400/50" : "bg-emerald-400 shadow-emerald-400/50"
              )} />
              <span className={state.isThinking ? "text-amber-400" : "text-emerald-400"}>
                {state.isThinking ? "Processing" : "Ready"}
              </span>
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content: Execution Log */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="p-6 glass border-b border-white/10 flex items-center justify-between z-10">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h1 className="font-serif italic text-2xl tracking-tight text-white glow-text">Cognitive Task Engine</h1>
              <span className="text-[10px] uppercase tracking-[0.3em] text-indigo-400 font-bold">Autonomous Intelligence</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-3 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] uppercase tracking-widest font-mono text-slate-300">Live Session</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
              <Cpu className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-[10px] font-mono text-slate-300">AI Engine</span>
            </div>
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-400">AI Active</span>
            </div>
          </div>
        </header>

        {/* Log Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth">
          <AnimatePresence>
            {state.logs.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center space-y-6"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                  <Brain className="w-24 h-24 text-indigo-400/40 relative z-10" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-serif italic text-2xl text-slate-400">Awaiting your objective...</p>
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Define a goal to begin autonomous execution</p>
                </div>
              </motion.div>
            ) : (
              state.logs.map((log, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-6 group"
                >
                  <div className="flex flex-col items-center pt-1">
                    <div className={cn(
                      "p-3 rounded-2xl border shadow-lg transition-all duration-500",
                      log.role === 'reasoning' && "bg-indigo-500 text-white border-indigo-400 shadow-indigo-500/20",
                      log.role === 'tool' && "bg-slate-800 text-pink-400 border-white/10 shadow-black/20",
                      log.role === 'observation' && "bg-slate-800 text-emerald-400 border-white/10 shadow-black/20",
                      log.role === 'system' && "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5"
                    )}>
                      {log.role === 'reasoning' && <Brain className="w-5 h-5" />}
                      {log.role === 'tool' && <Terminal className="w-5 h-5" />}
                      {log.role === 'observation' && <Search className="w-5 h-5" />}
                      {log.role === 'system' && <Activity className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 w-px bg-gradient-to-b from-white/10 to-transparent mt-4" />
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={cn(
                        "text-[10px] uppercase tracking-[0.2em] font-bold px-3 py-1 rounded-full border",
                        log.role === 'reasoning' && "text-indigo-400 border-indigo-400/20 bg-indigo-400/5",
                        log.role === 'tool' && "text-pink-400 border-pink-400/20 bg-pink-400/5",
                        log.role === 'observation' && "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
                        log.role === 'system' && "text-amber-400 border-amber-400/20 bg-amber-400/5"
                      )}>
                        {log.role}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={cn(
                      "rounded-2xl p-6 border transition-all duration-300",
                      log.role === 'reasoning' ? "bg-white/5 border-white/10 text-slate-200" : "bg-slate-900/40 border-white/5 text-slate-400"
                    )}>
                      {log.role === 'reasoning' ? (
                        <div className="markdown-body prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-serif prose-headings:italic">
                          <ReactMarkdown>
                            {log.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="font-mono text-xs leading-relaxed break-all">
                          {log.content}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          <div ref={logEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-8 glass border-t border-white/10">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-pink-500 to-purple-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000 group-focus-within:duration-200" />
            <div className="relative bg-slate-900 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
              <textarea 
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Define a complex mission objective (e.g., Research AI trends 2026)..."
                className="w-full bg-transparent p-6 pr-20 text-sm font-mono text-slate-200 focus:outline-none min-h-[120px] resize-none placeholder:text-slate-600"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRun();
                  }
                }}
              />
              <button 
                onClick={handleRun}
                disabled={state.isThinking || !objective.trim()}
                className="absolute bottom-6 right-6 p-4 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 disabled:opacity-50 transition-all duration-300 shadow-lg shadow-indigo-500/20 group/btn"
              >
                {state.isThinking ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden group-hover:block">Engage</span>
                    <Send className="w-6 h-6 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                  </div>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-6 opacity-40">
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] font-mono">
              <div className="w-1 h-1 bg-indigo-400 rounded-full" />
              <span>Planning</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] font-mono">
              <div className="w-1 h-1 bg-pink-400 rounded-full" />
              <span>Memory</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] font-mono">
              <div className="w-1 h-1 bg-emerald-400 rounded-full" />
              <span>Delegation</span>
            </div>
          </div>
        </div>
      </main>

      {/* Right Sidebar: Virtual File System */}
      <aside className="w-80 glass border-l border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 rounded-lg border border-pink-500/30">
              <Database className="w-5 h-5 text-pink-400" />
            </div>
            <h2 className="font-serif italic text-sm uppercase tracking-widest text-pink-300">Virtual Memory</h2>
          </div>
          <button 
            onClick={() => setIsAddingFile(!isAddingFile)}
            className={cn("p-2 rounded-lg transition-colors", isAddingFile ? "bg-pink-500 text-white" : "hover:bg-white/10 text-pink-400")}
            title="Add manual file"
          >
            <Plus className={cn("w-4 h-4 transition-transform", isAddingFile && "rotate-45")} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence mode="popLayout">
            {isAddingFile && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl border border-pink-500/40 bg-pink-500/5 space-y-3 mb-4"
              >
                <input 
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="filename.txt"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-pink-500/50"
                />
                <textarea 
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="File content..."
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-pink-500/50 min-h-[80px] resize-none"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={handleAddFile}
                    className="flex-1 bg-pink-500 hover:bg-pink-400 text-white text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg transition-colors"
                  >
                    Save File
                  </button>
                  <button 
                    onClick={() => setIsAddingFile(false)}
                    className="px-4 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
            {Object.keys(state.files).length === 0 && !isAddingFile ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center opacity-20 space-y-4"
              >
                <Folder className="w-16 h-16" />
                <p className="text-[10px] uppercase tracking-widest font-mono text-center">Memory Storage Empty</p>
              </motion.div>
            ) : (
              Object.entries(state.files).map(([filename, content]) => (
                <motion.div 
                  key={filename}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-hover rounded-xl border border-white/10 bg-white/5 p-4 group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white/10 rounded-md">
                        <FileText className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-200 truncate max-w-[120px]">{filename}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(filename, content);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-indigo-400"
                        title="Download file"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          agent?.deleteFile(filename);
                        }}
                        className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors text-slate-400 hover:text-red-400"
                        title="Delete file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <span className="text-[9px] text-slate-500 font-mono ml-1">{content.length}B</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 line-clamp-4 bg-black/20 p-3 rounded-lg border border-white/5 leading-relaxed">
                    {content}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
        <div className="p-6 border-t border-white/10 bg-white/5">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-[10px] font-mono font-bold uppercase tracking-widest">
              <span className="text-slate-400">Total Storage</span>
              <span className="text-pink-400">{Object.keys(state.files).length} Objects</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Object.keys(state.files).length * 10, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
