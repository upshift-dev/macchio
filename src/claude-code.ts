import {
  type Options as ClaudeCodeQueryOptions,
  type Query,
  query,
  type SDKMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { Effect, Layer } from "effect";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
const stringifyClaudeCodeMessage = (message: SDKMessage): string => {
  switch (message.type) {
    case "user": {
      // Handle user messages
      const content = message.message.content;
      if (typeof content === "string") {
        return `[user] ${content}`;
      }
      // Handle multi-part content
      const parts = content
        .map((block) => {
          if (block.type === "text") {
            return block.text;
          }
          if (block.type === "image") {
            return "image";
          }
          if (block.type === "tool_result") {
            // Filter out tool results
            return "tool result";
          }
          if (block.type === "tool_use") {
            return `tool use: ${block.name}`;
          }
          return block.type;
        })
        .filter((part) => part !== "")
        .join(" ");

      // If no content after filtering, return empty string
      if (!parts.trim()) {
        return "";
      }
      return `[user] ${parts}`;
    }

    case "assistant": {
      // Handle assistant messages
      const content = message.message.content;
      const parts = content
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
        .map((block) => {
          if (block.type === "text") {
            return block.text;
          }
          if (block.type === "tool_use") {
            // Show tool details with arguments
            const input = block.input as Record<string, unknown>;

            // Extract meaningful details based on tool name
            if (
              block.name === "Read" ||
              block.name === "Write" ||
              block.name === "Edit"
            ) {
              const filePath = input.target_file || input.file_path;
              return `${block.name} ${filePath}`;
            }
            if (block.name === "Bash" || block.name === "run_terminal_cmd") {
              const command = input.command;
              return `Bash: ${command}`;
            }
            if (block.name === "Grep") {
              const pattern = input.pattern;
              const path = input.path || "";
              return `Grep ${pattern}${path ? ` in ${path}` : ""}`;
            }
            if (block.name === "LS") {
              const dir = input.target_directory || input.path;
              return `LS ${dir}`;
            }
            if (block.name === "Glob") {
              const pattern = input.glob_pattern;
              return `Glob ${pattern}`;
            }
            if (block.name === "WebSearch") {
              const query = input.search_term || input.query;
              return `WebSearch: ${query}`;
            }

            // Default: show tool name with all args
            const args = Object.entries(input)
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(", ");
            return `${block.name}${args ? ` (${args})` : ""}`;
          }
          if (block.type === "thinking") {
            return `Thinking:  ${block.signature}`;
          }
          return block.type;
        })
        .filter((part) => part !== "")
        .join(" | ");
      return `[assistant] ${parts}`;
    }

    case "result": {
      // Handle result messages
      if (message.subtype === "success") {
        return `[result] Success - ${message.result} (turns: ${
          message.num_turns
        }, cost: $${message.total_cost_usd.toFixed(4)})`;
      }
      return `[result] Error - ${message.subtype} (turns: ${
        message.num_turns
      }, cost: $${message.total_cost_usd.toFixed(4)})`;
    }

    case "system": {
      // Handle system messages
      if (message.subtype === "init") {
        return `[system] Initialized - model: ${message.model}, permission mode: ${message.permissionMode}, cwd: ${message.cwd}`;
      }
      if (message.subtype === "compact_boundary") {
        return `[system] Compaction boundary - trigger: ${message.compact_metadata.trigger}, pre_tokens: ${message.compact_metadata.pre_tokens}`;
      }
      if (message.subtype === "hook_response") {
        return `[system] Hook response - ${message.hook_name} (${
          message.hook_event
        }) - exit code: ${message.exit_code ?? "none"}`;
      }
      // Fallback for any other system subtypes
      return "[system] unknown subtype";
    }

    case "stream_event": {
      // Handle streaming events
      const event = message.event;
      if (event.type === "message_start") {
        return "[stream] Message started";
      }
      if (event.type === "message_delta") {
        return `[stream] Message delta - ${
          event.delta.stop_reason ?? "continuing"
        }`;
      }
      if (event.type === "message_stop") {
        return "[stream] Message stopped";
      }
      if (event.type === "content_block_start") {
        return `[stream] Content block start - ${
          event.content_block?.type ?? "unknown"
        }`;
      }
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          return `[stream] ${event.delta.text}`;
        }
        return `[stream] Content delta - ${event.delta.type}`;
      }
      if (event.type === "content_block_stop") {
        return "[stream] Content block stopped";
      }
      return "[stream] unknown event type";
    }

    default:
      return "[unknown]";
  }
};

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
      stringify: stringifyClaudeCodeMessage,
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
        stringify: stringifyClaudeCodeMessage,
      })
    );
}
