import { Console, Effect, Stream } from "effect";
import { simpleGit } from "simple-git";
import { Config } from "./config.js";
import { ClaudeCodeQueryService } from "./claude-code.js";
import { ServiceError } from "./errors.js";

export class MacchioService extends Effect.Service<MacchioService>()(
  "MacchioService",
  {
    effect: Effect.gen(function* () {
      const config = yield* Config.get;
      const claudeCode = yield* ClaudeCodeQueryService;

      return {
        singleTurn: (prompt: string) =>
          Stream.fromAsyncIterable(
            claudeCode.query({
              prompt,
              options: claudeCode.queryOptions({
                abortController: new AbortController(),
                cwd: config.workingDir,
                permissionMode: "bypassPermissions",
                systemPrompt: `
0a. read everything in specs/ 0b. review the files in src/

pick the SINGLE highest priority item from @IMPLEMENTATION_PLAN.md and implement it using up to 50 subagents
put whatever you pick in IN_PROGRESS.md so another instance doesn't pick the same item
ensure the tests and checks are passing
update the @IMPLEMENTATION_PLAN.md with your progress and commit all changes with git add -A && git commit -m "..."
remove the item from IN_PROGRESS.md after you're done with it
if there is a discrepancy in the IMPLEMENTATION_PLAN.md and the spec, always update the IMPLEMENTATION_PLAN.md to match the spec.
                `.trim(),
              }),
            }),
            (e) => ServiceError.make(e)
          ).pipe(
            Stream.tap((message) => Console.log(claudeCode.stringify(message))),
            Stream.runCollect
          ),
        cleanup: Effect.fn("MacchioService.cleanup")(function* () {
          const git = simpleGit(config.workingDir);
          yield* Effect.tryPromise(() => git.reset(["--hard", "HEAD"])).pipe(
            Effect.either
          );
        }),
      };
    }),
    dependencies: [Config.Default, ClaudeCodeQueryService.Default],
    accessors: true,
  }
) {}
