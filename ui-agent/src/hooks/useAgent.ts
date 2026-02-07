import { useCallback, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { useAgentStore } from "@/stores/agentStore";
import { Agent } from "@/types";

export const useAgent = () => {
  const {
    agent,
    isRunning,
    error,
    setAgent,
    updateAgentStatus,
    setCurrentTask,
    addTodo,
    toggleTodo,
    deleteTodo,
    addLogEntry,
    addToolUsage,
    addCreatedFile,
    clearAgent,
    setError,
  } = useAgentStore();

  const startAgent = useCallback(
    async (task: string) => {
      try {
        setError(null);
        updateAgentStatus("running", 0);
        setCurrentTask(task);

        const response = await api.post<Agent>("/api/agent/start", { task });
        setAgent(response);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          updateAgentStatus("error");
        } else {
          setError("Failed to start agent");
          updateAgentStatus("error");
        }
      }
    },
    [setError, updateAgentStatus, setCurrentTask, setAgent],
  );

  const stopAgent = useCallback(async () => {
    try {
      await api.post("/api/agent/stop");
      updateAgentStatus("idle");
      setCurrentTask("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to stop agent");
      }
    }
  }, [setError, updateAgentStatus, setCurrentTask]);

  const getAgentStatus = useCallback(async () => {
    try {
      const response = await api.get<Agent>("/api/agent/status");
      setAgent(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }, [setAgent, setError]);

  // Auto-refresh status when running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      getAgentStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, getAgentStatus]);

  return {
    agent,
    isRunning,
    error,
    startAgent,
    stopAgent,
    getAgentStatus,
    updateAgentStatus,
    setCurrentTask,
    addTodo,
    toggleTodo,
    deleteTodo,
    addLogEntry,
    addToolUsage,
    addCreatedFile,
    clearAgent,
  };
};
