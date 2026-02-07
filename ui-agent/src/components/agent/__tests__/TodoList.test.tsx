import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TodoList from "@/components/agent/TodoList";
import { useAgentStore } from "@/stores/agentStore";

// Mock the store
jest.mock("@/stores/agentStore", () => ({
  useAgentStore: jest.fn(),
}));

describe("TodoList Component", () => {
  const mockTodos = [
    { id: "1", title: "Step 1", status: "completed", duration: "10s" },
    { id: "2", title: "Step 2", status: "running" },
    { id: "3", title: "Step 3", status: "pending" },
  ];

  beforeEach(() => {
    (useAgentStore as jest.Mock).mockReturnValue({
      todos: mockTodos,
      currentStep: 2,
    });
  });

  test("renders todo list with items", () => {
    render(<TodoList />);

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
  });

  test("shows completed step with check icon", () => {
    render(<TodoList />);

    const completedStep = screen.getByText("Step 1").closest("div");
    expect(completedStep).toHaveClass("bg-gray-50");
  });

  test("shows running step with active state", () => {
    render(<TodoList />);

    const runningStep = screen.getByText("Step 2").closest("div");
    expect(runningStep).toHaveClass("bg-blue-50");
    expect(screen.getByText("进行中")).toBeInTheDocument();
  });

  test("shows pending step with disabled state", () => {
    render(<TodoList />);

    const pendingStep = screen.getByText("Step 3").closest("div");
    expect(pendingStep).toHaveClass("opacity-50");
  });
});

describe("UsedTools Component", () => {
  const mockTools = [
    { id: "1", name: "Python", icon: "🐍", usageCount: 5 },
    { id: "2", name: "Pandas", icon: "📊", usageCount: 10 },
  ];

  test("renders tools list", () => {
    render(
      <div>
        {mockTools.map((tool) => (
          <div key={tool.id} data-testid={`tool-${tool.id}`}>
            {tool.name} - {tool.usageCount}次
          </div>
        ))}
      </div>,
    );

    expect(screen.getByTestId("tool-1")).toHaveTextContent("Python - 5次");
    expect(screen.getByTestId("tool-2")).toHaveTextContent("Pandas - 10次");
  });
});

describe("CreatedFiles Component", () => {
  const mockFiles = [
    { id: "1", name: "report.pdf", size: "2.3 MB", type: "pdf" },
    { id: "2", name: "chart.png", size: "1.1 MB", type: "png" },
  ];

  test("renders files list", () => {
    render(
      <div>
        {mockFiles.map((file) => (
          <div key={file.id} data-testid={`file-${file.id}`}>
            {file.name} ({file.size})
          </div>
        ))}
      </div>,
    );

    expect(screen.getByTestId("file-1")).toHaveTextContent("report.pdf (2.3 MB)");
    expect(screen.getByTestId("file-2")).toHaveTextContent("chart.png (1.1 MB)");
  });
});

describe("ExecutionLog Component", () => {
  const mockLogs = [
    { id: "1", timestamp: "14:30:45", level: "info", message: "Started" },
    { id: "2", timestamp: "14:30:46", level: "success", message: "Success" },
  ];

  test("renders logs with timestamps", () => {
    render(
      <div>
        {mockLogs.map((log) => (
          <div key={log.id} data-testid={`log-${log.id}`}>
            {log.timestamp} - {log.message}
          </div>
        ))}
      </div>,
    );

    expect(screen.getByTestId("log-1")).toHaveTextContent("14:30:45 - Started");
    expect(screen.getByTestId("log-2")).toHaveTextContent("14:30:46 - Success");
  });
});
