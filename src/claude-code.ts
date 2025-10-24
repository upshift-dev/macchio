import {
  type Options as ClaudeCodeQueryOptions,
  type Query,
  query,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { Effect, Layer } from "effect";

type QueryOptions = Pick<
  ClaudeCodeQueryOptions,
  "abortController" | "cwd" | "resume" | "permissionMode" | "systemPrompt"
>;

const queryOptions = (opts: QueryOptions): ClaudeCodeQueryOptions => ({
  abortController: opts.abortController,
  cwd: opts.cwd,
  resume: opts.resume,
  systemPrompt: opts.systemPrompt,
  settingSources: ["project"],
  permissionMode: opts.permissionMode ?? "acceptEdits",
  allowedTools: [
    "Bash",
    "Edit",
    "Read",
    "Write",
    "LS",
    "Grep",
    "Glob",
    "WebFetch",
    "WebSearch",
    "NotebookRead",
    "NotebookEdit",
    "TodoRead",
    "TodoWrite",
    "MultiEdit",
    "Agent",
  ],
});

export class ClaudeCodeQueryService extends Effect.Service<ClaudeCodeQueryService>()(
  "ClaudeCodeQueryService",
  {
    succeed: {
      query,
      queryOptions,
    },
    accessors: true,
  }
) {
  public static Test = (result: SDKResultMessage) =>
    Layer.succeed(
      ClaudeCodeQueryService,
      ClaudeCodeQueryService.make({
        query: () => {
          const q: Query = Object.assign(
            (async function* () {
              yield result;
            })(),
            {
              interrupt: async () => {},
              setPermissionMode: async () => {},
              setModel: async () => {},
              supportedCommands: async () => [],
              supportedModels: async () => [],
              mcpServerStatus: async () => [],
              accountInfo: async () => ({}),
              setMaxThinkingTokens: async () => {},
            }
          );
          return q;
        },
        queryOptions,
      })
    );
}
