export function createGameMachine(gameState, objectCount, onChange) {
  const initialLives = gameState.lives;

  function restart() {
    gameState.lives = initialLives;
    gameState.currentIndex = 0;
    return "intro";
  }

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
      }
    },
    item_found: {
      CONTINUE: () => {
        if (gameState.currentIndex === objectCount - 1) {
          return "all_found";
        }
        gameState.currentIndex += 1;
        return "searching";
      }
    },
    all_found: {
      CONTINUE: () => "outro"
    },
    outro: {
      CONTINUE: () => "end"
    },
    end: {},
    out_of_lives: {
      RESTART: restart
    }
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
