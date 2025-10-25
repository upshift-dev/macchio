import { Console, Duration, Effect, Layer, Schedule } from "effect";

import { MacchioService } from "./macchio-service.js";

export class Main extends Effect.Service<Main>()("Main", {
  succeed: {
    run: (prompt: string) =>
      Effect.repeat(
        MacchioService.singleTurn(prompt),
        Schedule.spaced(Duration.millis(100))
      ).pipe(Effect.asVoid),
    cleanup: MacchioService.cleanup,
  },
  dependencies: [MacchioService.Default],
  accessors: true,
}) {
  public static Test = Layer.succeed(
    Main,
    Main.make({
      run: () =>
        Console.log("Handling prompt...").pipe(
          Effect.delay(Duration.millis(2_000))
        ),
      cleanup: () => Console.log("Cleaned up"),
    })
  );
}
