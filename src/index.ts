#!/usr/bin/env node
// Import necessary modules from the libraries
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Duration, Effect, Ref, Schedule } from "effect";
import { MacchioService } from "./macchio-service.js";

const prompt = Args.text({
  name: "prompt",
});

const command = Command.make("macchio", { prompt }, ({ prompt }) =>
  Ref.make(1).pipe(
    Effect.andThen((turns) =>
      Effect.repeat(
        Effect.gen(function* () {
          const turn = yield* Ref.get(turns);
          yield* Console.log(`Performing turn ${turn}...`);
          yield* MacchioService.singleTurn(prompt);
          yield* Ref.update(turns, (turn) => turn + 1);
        }),
        Schedule.spaced(Duration.millis(100))
      )
    )
  )
);

// Set up the CLI application
const cli = Command.run(command, {
  name: "Macchio",
  version: "v1.0.0",
});

// Prepare and run the CLI application
cli(process.argv).pipe(
  Effect.provide(MacchioService.Default),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
);
