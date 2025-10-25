#!/usr/bin/env node
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Duration, Effect, Ref, Schedule } from "effect";
import { Main } from "./main.js";
import { MacchioService } from "./macchio-service.js";
import { BottomBar } from "./bottom-bar.js";

const prompt = Args.text({
  name: "prompt",
});

const program = (prompt: string) =>
  Effect.gen(function* () {
    const bottomBar = yield* Effect.acquireRelease(
      Effect.succeed(new BottomBar("Macchio v1.0 - use ctrl+c to exit")),
      (bottomBar) =>
        Console.log("Cleaning up bottom bar").pipe(
          Effect.andThen(() => bottomBar.cleanup())
        )
    );
    bottomBar.enable();

    const turnRef = yield* Ref.make(1);

    yield* Effect.repeat(
      Effect.gen(function* () {
        const turn = yield* Ref.get(turnRef);
        bottomBar.updateText(
          `Macchio v1.0 - use ctrl+c to exit - turn ${turn}`
        );
        yield* Main.run(prompt);
        yield* Ref.update(turnRef, (turn) => turn + 1);
      }),
      Schedule.spaced(Duration.millis(100))
    );
  }).pipe(
    Effect.scoped,
    Effect.onInterrupt(() => Main.cleanup())
  );

const command = Command.make("macchio", { prompt }, ({ prompt }) =>
  program(prompt)
);

// Set up the CLI application
const cli = Command.run(command, {
  name: "Macchio",
  version: "v1.0.0",
});

// Prepare and run the CLI application
cli(process.argv).pipe(
  Effect.provide(MacchioService.Default),
  Effect.provide(Main.Default),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
);
