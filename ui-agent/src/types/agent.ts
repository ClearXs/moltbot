// Agent execution types

export interface AgentTask {
  goal: string;
  context?: Record<string, unknown>;
  constraints?: string[];
  tools?: string[];
}

export interface AgentStep {
  step_number: number;
  action: string;
  observation: string | Record<string, unknown>; // Can be string or object
  thought?: string;
  tool_calls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
  }>;
  status: "pending" | "running" | "completed" | "failed";
  files_created?: string[];
  code_written?: string;
  error?: string;
}

export interface AgentExecution {
  execution_id: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  steps: AgentStep[];
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentExecutionRequest {
  task: AgentTask;
  conversation_id?: string;
  max_steps?: number;
}

export interface AgentExecutionResponse {
  execution_id: string;
  status: string;
  result?: string;
  steps: AgentStep[];
  error?: string;
  metadata?: Record<string, unknown>;
}

// Utility functions
export function getAllFiles(steps: AgentStep[]): string[] {
  const files = new Set<string>();
  steps.forEach((step) => {
    if (step.files_created) {
      step.files_created.forEach((file) => files.add(file));
    }
  });
  return Array.from(files);
}

export function getAllCodes(steps: AgentStep[]): Array<{ filename: string; content: string }> {
  const codes: Array<{ filename: string; content: string }> = [];
  steps.forEach((step) => {
    if (step.code_written) {
      // Extract filename from action or use default
      const filename = step.files_created?.[0] || `step_${step.step_number}_code`;
      codes.push({ filename, content: step.code_written });
    }
  });
  return codes;
}

export function getCurrentStep(steps: AgentStep[]): AgentStep | null {
  return steps.find((s) => s.status === "running") || null;
}

export function isExecutionCompleted(execution: AgentExecution | null): boolean {
  if (!execution) return false;
  return execution.status === "completed" || execution.status === "failed";
}
