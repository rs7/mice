export function createGameMachine(gameState, objectCount, onChange) {
  const transitions = {
    intro: {
      CONTINUE: () => "welcome"
    },
    welcome: {
      START: () => "searching"
    },
    searching: {
      HIT: () => "item_found",
      MISS: () => {
        gameState.lives -= 1;
        return gameState.lives === 0 ? "out_of_lives" : "searching";
      },
      DEBUG_LOSE: () => {
        gameState.lives = 0;
        return "out_of_lives";
      },
      DEBUG_WIN: () => {
        gameState.selectedObjectIndex = objectCount - 1;
        return "all_found";
      }
    },
    item_found: {
      CONTINUE: () => {
        if (gameState.selectedObjectIndex === objectCount - 1) {
          return "all_found";
        }
        gameState.selectedObjectIndex += 1;
        return "searching";
      }
    },
    all_found: {
      CONTINUE: () => "outro"
    },
    outro: {
      CONTINUE: () => "outro_note"
    },
    outro_note: {},
    out_of_lives: {}
  };

  return {
    send(event) {
      const transition = transitions[gameState.status][event];
      if (!transition) return;
      gameState.status = transition();
      return onChange(event);
    }
  };
}
