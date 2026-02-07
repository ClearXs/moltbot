import type { PluginRuntime } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreConfig } from "./types.js";
import { setMatrixRuntime } from "./runtime.js";

vi.mock("./matrix/send.js", () => ({
  sendMessageMatrix: vi.fn(),
  sendPollMatrix: vi.fn(),
}));

vi.mock("./matrix/probe.js", () => ({
  probeMatrix: vi.fn(),
}));

vi.mock("@vector-im/matrix-bot-sdk", () => ({
  MatrixClient: class {},
  ConsoleLogger: class {},
  LogService: {
    setLogger() {},
    setLogLevel() {},
    warn() {},
    info() {},
    error() {},
    debug() {},
  },
  AutojoinRoomsMixin: { setupOnClient() {} },
  SimpleFsStorageProvider: class {},
  RustSdkCryptoStorageProvider: class {},
  LogLevel: { INFO: "INFO" },
}));

vi.mock("@matrix-org/matrix-sdk-crypto-nodejs", () => ({
  StoreType: { Sqlite: "Sqlite" },
}));

describe("matrix directory", () => {
  beforeEach(() => {
    setMatrixRuntime({
      state: {
        resolveStateDir: (_env, homeDir) => homeDir(),
      },
    } as PluginRuntime);
  });

  it("lists peers and groups from config", async () => {
    const { matrixPlugin } = await import("./channel.js");
    const cfg = {
      channels: {
        matrix: {
          dm: { allowFrom: ["matrix:@alice:example.org", "bob"] },
          groupAllowFrom: ["@dana:example.org"],
          groups: {
            "!room1:example.org": { users: ["@carol:example.org"] },
            "#alias:example.org": { users: [] },
          },
        },
      },
    } as unknown as CoreConfig;

    expect(matrixPlugin.directory).toBeTruthy();
    expect(matrixPlugin.directory?.listPeers).toBeTruthy();
    expect(matrixPlugin.directory?.listGroups).toBeTruthy();

    await expect(
      matrixPlugin.directory!.listPeers({
        cfg,
        accountId: undefined,
        query: undefined,
        limit: undefined,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        { kind: "user", id: "user:@alice:example.org" },
        { kind: "user", id: "bob", name: "incomplete id; expected @user:server" },
        { kind: "user", id: "user:@carol:example.org" },
        { kind: "user", id: "user:@dana:example.org" },
      ]),
    );

    await expect(
      matrixPlugin.directory!.listGroups({
        cfg,
        accountId: undefined,
        query: undefined,
        limit: undefined,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        { kind: "group", id: "room:!room1:example.org" },
        { kind: "group", id: "#alias:example.org" },
      ]),
    );
  });
});
