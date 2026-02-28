import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnhancedChatInput } from "@/components/chat/EnhancedChatInput";

// Mock dependencies
jest.mock("@/stores/connectionStore", () => ({
  useConnectionStore: jest.fn(() => ({
    connectors: [],
  })),
}));

jest.mock("@/stores/settingsStore", () => ({
  useSettingsStore: jest.fn(() => ({
    settings: {},
  })),
}));

describe("EnhancedChatInput - Quick Actions", () => {
  const mockOnSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders quick actions button with Zap icon", () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    expect(quickActionsButton).toBeInTheDocument();
  });

  test("opens dropdown menu when clicking quick actions button", async () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    await userEvent.click(quickActionsButton);

    expect(screen.getByText("生成文档")).toBeInTheDocument();
    expect(screen.getByText("生成PPT")).toBeInTheDocument();
    expect(screen.getByText("生成Markdown")).toBeInTheDocument();
  });

  test("closes dropdown when clicking outside", async () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    await userEvent.click(quickActionsButton);

    expect(screen.getByText("生成文档")).toBeInTheDocument();

    // Click outside
    await userEvent.click(document.body);

    expect(screen.queryByText("生成文档")).not.toBeInTheDocument();
  });

  test("inserts powerpoint-pptx skill when clicking 生成PPT", async () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    await userEvent.click(quickActionsButton);

    const pptButton = screen.getByText("生成PPT");
    await userEvent.click(pptButton);

    // Check that the input value contains the skill key
    const input = screen.getByPlaceholderText("输入消息...");
    expect(input).toHaveValue("/powerpoint-pptx ");
  });

  test("inserts markdown-converter skill when clicking 生成Markdown", async () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    await userEvent.click(quickActionsButton);

    const markdownButton = screen.getByText("生成Markdown");
    await userEvent.click(markdownButton);

    // Check that the input value contains the skill key
    const input = screen.getByPlaceholderText("输入消息...");
    expect(input).toHaveValue("/markdown-converter ");
  });

  test("inserts word-generator skill when clicking 生成Word", async () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    await userEvent.click(quickActionsButton);

    const wordButton = screen.getByText("生成Word");
    await userEvent.click(wordButton);

    // Check that the input value contains the skill key
    const input = screen.getByPlaceholderText("输入消息...");
    expect(input).toHaveValue("/word-generator ");
  });

  test("closes dropdown after selecting an option", async () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    await userEvent.click(quickActionsButton);

    expect(screen.getByText("生成文档")).toBeInTheDocument();

    const pptButton = screen.getByText("生成PPT");
    await userEvent.click(pptButton);

    expect(screen.queryByText("生成文档")).not.toBeInTheDocument();
  });

  test("does not close dropdown when clicking same option twice", async () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    await userEvent.click(quickActionsButton);

    // First click on PPT
    const pptButton = screen.getByText("生成PPT");
    await userEvent.click(pptButton);

    // Dropdown should close after selection
    expect(screen.queryByText("生成文档")).not.toBeInTheDocument();
  });

  test("button is disabled when input is disabled", () => {
    render(<EnhancedChatInput onSend={mockOnSend} disabled={true} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    expect(quickActionsButton).toBeDisabled();
  });

  test("all skill options are visible in dropdown", async () => {
    render(<EnhancedChatInput onSend={mockOnSend} />);

    const quickActionsButton = screen.getByTitle("快捷功能");
    await userEvent.click(quickActionsButton);

    // Check for PPT option
    expect(screen.getByText("生成PPT")).toBeInTheDocument();

    // Check for Markdown option
    expect(screen.getByText("生成Markdown")).toBeInTheDocument();

    // Check for Word option
    expect(screen.getByText("生成Word")).toBeInTheDocument();
  });
});
