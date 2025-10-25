import { Effect, Either, Redacted } from "effect";
import path from "node:path";

const getProcessEnvOrFail = (key: string) =>
  Effect.gen(function* () {
    const value = process.env[key];
    if (!value) return yield* Effect.fail(new Error(`${key} is not set`));
    return value;
  });

export class Config extends Effect.Service<Config>()("Config", {
  effect: Effect.gen(function* () {
    const workingDir = yield* getProcessEnvOrFail("DIR").pipe(Effect.either);
    const anthropicApiKey = yield* getProcessEnvOrFail("ANTHROPIC_API_KEY");

    return {
      get: {
        workingDir: Either.isLeft(workingDir)
          ? process.cwd()
          : path.resolve(workingDir.right),
        anthropicApiKey: Redacted.make(anthropicApiKey),
      },
    };
  }),
  accessors: true,
}) {}
