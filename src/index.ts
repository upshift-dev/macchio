#!/usr/bin/env node
import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Duration, Effect, Option, Ref, Schedule } from "effect";
import { Main } from "./main.js";
import { MacchioService } from "./macchio-service.js";
import { BottomBar } from "./bottom-bar.js";

const prompt = Args.text({
  name: "prompt",
}).pipe(Args.withDescription("the prompt to run"));

const maxTurns = Options.integer("max-turns").pipe(
  Options.withAlias("M"),
  Options.withDescription("the maximum number of turns to run"),
  Options.optional
);

const program = ({
  maxTurns,
  prompt,
}: {
  maxTurns: Option.Option<number>;
  prompt: string;
}) =>
  Effect.gen(function* () {
    const bottomBar = yield* Effect.acquireRelease(
      Effect.succeed(new BottomBar("Macchio v1.0 - use ctrl+c to exit")),
      (bottomBar) =>
        Console.log("Cleaning up bottom bar").pipe(
          Effect.andThen(() => {
            bottomBar.disable();
            return Effect.void;
          })
        )
    );
    bottomBar.enable();

    const turnRef = yield* Ref.make(1);

    const turnEffect = Effect.gen(function* () {
      const turn = yield* Ref.get(turnRef);
      bottomBar.updateText(`Macchio v1.0 - use ctrl+c to exit - turn ${turn}`);
      yield* Main.run(prompt);
      yield* Ref.update(turnRef, (turn) => turn + 1);
    });

    const hasMaxTurns = maxTurns.pipe(Option.isSome);
    if (!hasMaxTurns) {
      yield* Effect.repeat(turnEffect, Schedule.spaced(Duration.millis(200)));
    }

    yield* Effect.repeatN(turnEffect, maxTurns.pipe(Option.getOrThrow) - 1);
    bottomBar.disable();
  }).pipe(
    Effect.scoped,
    Effect.onInterrupt(() => Main.cleanup())
  );

const command = Command.make(
  "macchio",
  { maxTurns, prompt },
  ({ maxTurns, prompt }) => program({ maxTurns, prompt })
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
