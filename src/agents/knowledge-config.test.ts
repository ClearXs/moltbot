import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveKnowledgeConfig } from "./knowledge-config.js";

describe("resolveKnowledgeConfig", () => {
  it("returns null when knowledge base is disabled", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          tools: {
            knowledgeBase: {
              enabled: false,
            },
          },
        },
      },
    };

    const resolved = resolveKnowledgeConfig(config, "main");
    expect(resolved).toBeNull();
  });

  it("returns null when knowledge base config is missing", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {},
      },
    };

    const resolved = resolveKnowledgeConfig(config, "main");
    expect(resolved).toBeNull();
  });

  it("applies default values when enabled", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          tools: {
            knowledgeBase: {
              enabled: true,
            },
          },
        },
      },
    };

    const resolved = resolveKnowledgeConfig(config, "main");
    expect(resolved).not.toBeNull();
    expect(resolved!.enabled).toBe(true);
    expect(resolved!.storage.maxFileSize).toBe(10 * 1024 * 1024); // 10MB
    expect(resolved!.storage.maxDocuments).toBe(1000);
    expect(resolved!.formats.pdf.enabled).toBe(true);
    expect(resolved!.formats.docx.enabled).toBe(true);
    expect(resolved!.upload.webApi).toBe(true);
    expect(resolved!.upload.chatAttachments).toBe(true);
    expect(resolved!.search.autoIndex).toBe(true);
    expect(resolved!.search.includeInMemorySearch).toBe(false);
  });

  it("merges custom storage settings", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          tools: {
            knowledgeBase: {
              enabled: true,
              storage: {
                maxFileSize: 5 * 1024 * 1024, // 5MB
                maxDocuments: 500,
              },
            },
          },
        },
      },
    };

    const resolved = resolveKnowledgeConfig(config, "main");
    expect(resolved!.storage.maxFileSize).toBe(5 * 1024 * 1024);
    expect(resolved!.storage.maxDocuments).toBe(500);
  });

  it("allows disabling specific formats", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          tools: {
            knowledgeBase: {
              enabled: true,
              formats: {
                pdf: { enabled: false },
                html: { enabled: false },
              },
            },
          },
        },
      },
    };

    const resolved = resolveKnowledgeConfig(config, "main");
    expect(resolved!.formats.pdf.enabled).toBe(false);
    expect(resolved!.formats.docx.enabled).toBe(true);
    expect(resolved!.formats.txt.enabled).toBe(true);
    expect(resolved!.formats.html.enabled).toBe(false);
  });

  it("respects PDF maxPages limit", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          tools: {
            knowledgeBase: {
              enabled: true,
              formats: {
                pdf: { enabled: true, maxPages: 50 },
              },
            },
          },
        },
      },
    };

    const resolved = resolveKnowledgeConfig(config, "main");
    expect(resolved!.formats.pdf.maxPages).toBe(50);
  });

  it("allows restricting upload channels", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          tools: {
            knowledgeBase: {
              enabled: true,
              upload: {
                webApi: false,
                chatAttachments: true,
                allowedChannels: ["telegram", "whatsapp"],
              },
            },
          },
        },
      },
    };

    const resolved = resolveKnowledgeConfig(config, "main");
    expect(resolved!.upload.webApi).toBe(false);
    expect(resolved!.upload.chatAttachments).toBe(true);
    expect(resolved!.upload.allowedChannels).toEqual(["telegram", "whatsapp"]);
  });

  it("merges agent-specific overrides with global defaults", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          tools: {
            knowledgeBase: {
              enabled: true,
              storage: {
                maxFileSize: 10 * 1024 * 1024,
              },
            },
          },
        },
      },
      routing: {
        agents: {
          special: {
            tools: {
              knowledgeBase: {
                enabled: true,
                storage: {
                  maxFileSize: 20 * 1024 * 1024, // Override for special agent
                },
              },
            },
          },
        },
      },
    };

    const defaultResolved = resolveKnowledgeConfig(config, "main");
    expect(defaultResolved!.storage.maxFileSize).toBe(10 * 1024 * 1024);

    const specialResolved = resolveKnowledgeConfig(config, "special");
    expect(specialResolved!.storage.maxFileSize).toBe(20 * 1024 * 1024);
  });

  it("agent override can disable knowledge base", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          tools: {
            knowledgeBase: {
              enabled: true,
            },
          },
        },
      },
      routing: {
        agents: {
          restricted: {
            tools: {
              knowledgeBase: {
                enabled: false, // Disable for this agent
              },
            },
          },
        },
      },
    };

    const defaultResolved = resolveKnowledgeConfig(config, "main");
    expect(defaultResolved).not.toBeNull();

    const restrictedResolved = resolveKnowledgeConfig(config, "restricted");
    expect(restrictedResolved).toBeNull();
  });
});
