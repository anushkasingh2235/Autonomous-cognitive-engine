import { GoogleGenAI } from "@google/genai";
import { MASTER_SYSTEM_PROMPT, SUB_AGENT_PROMPTS } from "../constants";

export interface Todo {
  task: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface AgentState {
  todos: Todo[];
  files: Record<string, string>;
  logs: { role: 'reasoning' | 'tool' | 'observation' | 'system', content: string, timestamp: number }[];
  isThinking: boolean;
  currentTask: string | null;
}

const tools = [
  {
    type: "function",
    function: {
      name: "write_todos",
      description: "Update the structured TODO list for the current objective.",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task: { type: "string" },
                status: { type: "string", enum: ['pending', 'in-progress', 'completed'] }
              },
              required: ["task", "status"]
            }
          }
        },
        required: ["todos"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file in the virtual file system.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string" },
          content: { type: "string" }
        },
        required: ["filename", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read content from a file in the virtual file system.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string" }
        },
        required: ["filename"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files in the virtual file system.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file from the virtual file system.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string" }
        },
        required: ["filename"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delegate_task",
      description: "Delegate a specific task to a specialized sub-agent.",
      parameters: {
        type: "object",
        properties: {
          agentType: { type: "string", enum: ['research', 'summarization', 'code'] },
          instructions: { type: "string" }
        },
        required: ["agentType", "instructions"]
      }
    }
  }
];

export class CognitiveAgent {
  private state: AgentState;
  private onStateChange: (state: AgentState) => void;
  private ai: any;

  constructor(_apiKey: string, onStateChange: (state: AgentState) => void) {
    this.onStateChange = onStateChange;
    this.state = {
      todos: [],
      files: {},
      logs: [],
      isThinking: false,
      currentTask: null
    };
    
    // Initialize AI provider locally (Frontend)
    try {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("AI provider initialization failed:", e);
    }
  }

  private updateState(patch: Partial<AgentState>) {
    this.state = { ...this.state, ...patch };
    this.onStateChange(this.state);
  }

  private addLog(role: AgentState['logs'][0]['role'], content: string) {
    this.updateState({
      logs: [...this.state.logs, { role, content, timestamp: Date.now() }]
    });
  }

  private async callAI(messages: any[], useTools: boolean = true, retries: number = 3) {
    if (!this.ai || !process.env.GEMINI_API_KEY) {
      throw new Error("AI API key is not configured. Please add it to your environment.");
    }

    const systemPrompt = messages.find(m => m.role === "system")?.content || MASTER_SYSTEM_PROMPT;
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await this.ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: messages.filter(m => m.role !== "system").map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          })),

          config: {
            systemInstruction: systemPrompt,
            tools: useTools ? [{
              functionDeclarations: tools.map(t => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
              }))
            }] : undefined
          }
        });

        if (response) {
          return {
            choices: [{
              message: {
                content: response.text,
                role: "assistant",
                tool_calls: response.functionCalls?.map((fc: any) => ({
                  id: Math.random().toString(36).substring(7),
                  type: "function",
                  function: {
                    name: fc.name,
                    arguments: JSON.stringify(fc.args)
                  }
                }))
              }
            }]
          };
        }
        throw new Error("No response from AI service");
      } catch (error: any) {
        const isRateLimit = error.message?.includes("429") || error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED");
        const isOverloaded = error.message?.includes("503") || error.status === 503 || error.message?.includes("UNAVAILABLE");
        
        if ((isRateLimit || isOverloaded) && i < retries - 1) {
          const waitTime = Math.pow(2, i) * 1000;
          console.warn(`${isOverloaded ? 'Server overloaded' : 'Rate limit hit'}. Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        console.error("Gemini API Error:", error);
        if (isRateLimit) {
          throw new Error("AI API quota exceeded. Please wait a moment or check your usage limits.");
        }
        if (isOverloaded) {
          throw new Error("AI service is currently overloaded. Please try again in a few seconds.");
        }
        throw new Error(`AI API Error: ${error.message || "Unknown error"}`);
      }
    }
    throw new Error("Failed to get response from the AI service after multiple retries.");
  }

  async run(objective: string) {
    this.updateState({ isThinking: true, currentTask: objective, logs: [], todos: [], files: {} });
    this.addLog('system', `Starting objective: ${objective}`);

    let iteration = 0;
    const maxIterations = 15;
    const messages: any[] = [
      { role: "system", content: MASTER_SYSTEM_PROMPT },
      { role: "user", content: `Objective: ${objective}` }
    ];

    while (iteration < maxIterations) {
      iteration++;
      
      const statusUpdate = `Current TODOs: ${JSON.stringify(this.state.todos)}
Files in Memory: ${Object.keys(this.state.files).join(', ')}
What is the next step? If all tasks are completed, provide the final synthesis.`;

      messages.push({ role: "user", content: statusUpdate });

      try {
        const response = await this.callAI(messages);
        const choice = response.choices[0];
        const message = choice.message;

        if (message.content) {
          this.addLog('reasoning', message.content);
          messages.push({ role: "assistant", content: message.content });
        }

        if (message.tool_calls && message.tool_calls.length > 0) {
          // Parallelize tool execution for speed
          const toolResults = await Promise.all(message.tool_calls.map(async (toolCall: any) => {
            const name = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            this.addLog('tool', `Executing ${name}(${JSON.stringify(args)})`);
            const result = await this.handleToolCall(name, args);
            return { toolCallId: toolCall.id, name, result };
          }));

          toolResults.forEach(({ name, result, toolCallId }) => {
            this.addLog('observation', result);
            messages.push({
              role: "tool",
              tool_call_id: toolCallId,
              name: name,
              content: result
            });
          });
        } else {
          // No more tools, assume finished or reasoning
          if (this.state.todos.length > 0 && this.state.todos.every(t => t.status === 'completed')) {
            this.addLog('system', "Objective completed.");
            break;
          }
        }
      } catch (error: any) {
        this.addLog('system', `Error: ${error.message}`);
        break;
      }

      await new Promise(r => setTimeout(r, 50));
    }

    this.updateState({ isThinking: false });
  }

  private async handleToolCall(name: string, args: any): Promise<string> {
    switch (name) {
      case 'write_todos':
        this.updateState({ todos: args.todos });
        return "TODO list updated.";
      case 'write_file':
        this.addFile(args.filename, args.content);
        return `File '${args.filename}' written successfully.`;
      case 'read_file':
        const content = this.state.files[args.filename];
        return content ? `Content of ${args.filename}: ${content}` : `File '${args.filename}' not found.`;
      case 'delete_file':
        this.deleteFile(args.filename);
        return `File '${args.filename}' deleted successfully.`;
      case 'list_files':
        return `Files: ${Object.keys(this.state.files).join(', ')}`;
      case 'delegate_task':
        return await this.runSubAgent(args.agentType, args.instructions);
      default:
        return `Tool ${name} not implemented.`;
    }
  }

  public addFile(filename: string, content: string) {
    this.updateState({ files: { ...this.state.files, [filename]: content } });
  }

  public deleteFile(filename: string) {
    const newFiles = { ...this.state.files };
    delete newFiles[filename];
    this.updateState({ files: newFiles });
  }

  private async runSubAgent(type: 'research' | 'summarization' | 'code', instructions: string): Promise<string> {
    this.addLog('system', `Delegating to ${type} agent...`);
    try {
      const messages = [
        { role: "system", content: SUB_AGENT_PROMPTS[type] },
        { role: "user", content: instructions }
      ];
      const response = await this.callAI(messages, false);
      return response.choices[0].message.content || "Sub-agent returned no output.";
    } catch (error: any) {
      return `Sub-agent error: ${error.message}`;
    }
  }
}
