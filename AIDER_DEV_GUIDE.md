# Dance Party Game - Local MVP Development Guide

## 1. Project Overview

This project is a web application inspired by party games like Quiplash. Instead of typing witty answers, users will physically dance out a given prompt. Other players in the same physical room will watch the performance live and then vote on who performed it best via their own devices. The game host uses a central screen (e.g., TV connected to a laptop) to display prompts, current dancer, voting results, and the scoreboard.

**This guide focuses on building a Local MVP for LAN testing.** This means the game server will run on one machine, and players (including the host client) will connect to it over the local network. No internet deployment or video streaming/recording is involved in this MVP.

## 2. MVP Goal

To create a fully playable, turn-based dance game for a single group of players on a local network, encompassing the following core loop:

1.  Host creates a game.
2.  Players join the game using a room code and a nickname.
3.  Host starts the game.
4.  Game cycles through players:
    a. A player is selected to dance.
    b. A prompt is displayed to the dancer and on the host screen.
    c. The player dances in the physical room.
    d. Other players watch live.
5.  Host initiates a voting phase.
6.  Players (except the dancer) vote for the best performance on their devices.
7.  Host displays voting results and updates the scoreboard.
8.  The game continues with the next dancer or ends after a set number of rounds/all players have danced.
9.  A final scoreboard is displayed.

## 3. Technology Stack

- **Backend (Server):**
  - Language/Framework: Node.js with Express.js
  - Real-time Communication: Socket.IO
  - Development Tool: `nodemon` for auto-restarting server during development.
- **Frontend (Client-Host & Client-Player):**
  - Framework: React (using `create-react-app` or Vite for setup)
  - Real-time Communication: `socket.io-client`
- **Prompts Data:** Initially hardcoded in a JSON array within the backend server code or loaded from a `prompts.json` file.
- **Game State Management (MVP):** In-memory JavaScript objects/arrays on the server. No external database for the local MVP.

## 4. Project Structure (Monorepo Recommended) (Not really certain about this.)

```
MoveOrLose/
├── server/ # Node.js/Express/Socket.IO backend
│ ├── package.json
│ ├── .env # For environment variables like PORT (ensure .gitignore)
│ ├── src/
│ │ ├── index.js # Main server entry point
│ │ ├── gameLogic.js # (Optional, for game state and rules)
│ │ └── prompts.json # (If storing prompts in a file)
│ └── Dockerfile # (For later cloud deployment, optional for local)
├── client-host/ # React app for the main screen (TV/Projector)
│ ├── package.json
│ └── src/
│ ├── App.js
│ ├── components/ # Reusable UI components
│ └── services/ # For socket connection management
└── client-player/ # React app for player devices (phones/laptops)
├── package.json
└── src/
├── App.js
├── components/
└── services/
```

## 5. Phased Development Plan (Local MVP)

**LLM Instructions:** Please implement features incrementally, phase by phase. Ensure each phase is functional before moving to the next. Focus on clear, commented, and modular code.

---

### **Phase 0: Basic Setup & Connectivity**

**Objective:** Establish basic communication between the server and both client types.

**Backend (Server - `server/src/index.js`):**

1.  Initialize Express server and Socket.IO.
2.  Listen on a configurable port (e.g., `3001`, use `process.env.PORT || 3001`).
3.  Implement basic CORS configuration to allow connections from React development servers (e.g., `localhost:3000`, `localhost:3002`).
4.  On Socket.IO `connection`: log "A user connected: [socket.id]".
5.  On Socket.IO `disconnect`: log "User disconnected: [socket.id]".
6.  Add a simple HTTP GET route `/` that returns "Dance Game Server is running!".

**Frontend (Client-Host - `client-host/src/App.js`):**

1.  Initialize `socket.io-client` to connect to the backend server URL (`http://localhost:3001`).
2.  Display connection status (e.g., "Connected" or "Disconnected").
3.  Basic UI: "Host Client".

**Frontend (Client-Player - `client-player/src/App.js`):**

1.  Initialize `socket.io-client` to connect to the backend server URL (`http://localhost:3001`).
2.  Display connection status.
3.  Basic UI: "Player Client".

---

### **Phase 1: Room Creation & Joining**

**Objective:** Allow a host to create a game room and players to join it.

**Backend (Server):**

- **Data Structure:**
  - Use an in-memory object to store game rooms, e.g., `let gameRooms = {};`
  - A room object should store: `roomId`, `hostSocketId`, `players: [{socketId, nickname}]`, `gameState: 'LOBBY' | 'IN_PROGRESS' | 'ENDED'`, `prompts: []`, `currentPrompt: null`, `currentDancer: null`, `scores: {}`, etc.
- **Socket.IO Events:**
  - `createGame`:
    - Generate a unique 4-char alphanumeric `roomCode`.
    - Create a new room entry in `gameRooms`. Store `socket.id` as `hostSocketId`.
    - Have the socket `join` the Socket.IO room identified by `roomCode`.
    - Emit `gameCreated` back to the host client with `{ roomCode, hostSocketId }`.
  - `joinGame` (payload: `{ roomCode, nickname }`):
    - Validate `roomCode` exists in `gameRooms`.
    - Validate `nickname` (e.g., not empty, unique within the room).
    - If valid, add player `{ socketId: socket.id, nickname }` to `gameRooms[roomCode].players`.
    - Have the socket `join` the Socket.IO room.
    - Emit `playerJoined` to all clients in the `roomCode` room with the updated player list (`gameRooms[roomCode].players`).
    - Emit `joinSuccess` back to the joining player with `{ roomCode, nickname, players: gameRooms[roomCode].players }`.
    - Emit `joinFailed` with an error message if validation fails.
  - Handle `disconnect`: Remove player from any room they are in. Notify other players in that room using an event like `playerLeft` with the updated player list.

**Frontend (Client-Host):**

- UI: Button "Create Game".
- On click, emit `createGame` event.
- Listen for `gameCreated`: Display the `roomCode`.
- Listen for `playerJoined` / `playerLeft`: Display an updated list of connected players' nicknames.

**Frontend (Client-Player):**

- UI: Input fields for "Nickname" and "Room Code". Button "Join Game".
- On "Join Game" click, emit `joinGame` with nickname and room code.
- Listen for `joinSuccess`: Display a "Waiting for host to start the game..." message. Show list of players in the room.
- Listen for `joinFailed`: Display error message.
- Listen for `playerJoined` / `playerLeft`: Update the displayed list of players.

---

### **Phase 2: Basic Game Flow - Prompt & "Dance" Phase**

**Objective:** Host starts the game, a dancer is selected, and a prompt is shown.

**Backend (Server):**

- **Prompts:**
  - Create `prompts.json` with an array of prompt strings (e.g., `["Dance like a robot", "Interpretive dance of 'making toast'"]`).
  - Load these prompts into the server, perhaps when a room is created or game starts.
- **Socket.IO Events:**
  - `startGame` (payload: `{ roomCode }`, emitted by host):
    - Validate sender is the host of `roomCode`.
    - Check if enough players (e.g., at least 2-3).
    - Set `gameRooms[roomCode].gameState = 'IN_PROGRESS'`.
    - Initialize/reset scores: `gameRooms[roomCode].scores = {}` (map player IDs to 0).
    - Determine round order (e.g., shuffle players). Store this order.
    - Select the first player as `currentDancer`.
    - Pick a random prompt for `currentDancer`. Store it in `gameRooms[roomCode].currentPrompt`.
    - Emit `gameStarted` to all clients in `roomCode` with initial game data (player list, scores).
    - Emit `newRound` to all clients in `roomCode` with `{ dancer: { socketId, nickname }, prompt: currentPrompt }`. (Note: Only the current dancer _needs_ the prompt on their device, but host screen shows it too).
  - `requestNextDancer` (payload: `{ roomCode }`, emitted by host, e.g., after voting or if skipping):
    - Logic to select the next dancer based on the stored order.
    - If all players have danced, transition to `gameEnded` state (Phase 4).
    - Otherwise, pick a new random prompt for the new `currentDancer`.
    - Emit `newRound` to all clients in `roomCode` with new dancer and prompt.

**Frontend (Client-Host):**

- UI: Button "Start Game" (enabled when enough players have joined).
- On "Start Game" click, emit `startGame`.
- Listen for `gameStarted`: Potentially update UI to show game is active.
- Listen for `newRound`:
  - Display "Current Dancer: [Nickname]".
  - Display "Prompt: [Prompt Text]".
  - UI: Button "Open Voting" (initially disabled, enabled by host logic).

**Frontend (Client-Player):**

- Listen for `gameStarted`.
- Listen for `newRound`:
  - If `socket.id` matches `dancer.socketId`: Display "Your turn to dance! Prompt: [Prompt Text]".
  - Else: Display "[Dancer's Nickname] is dancing to: [Prompt Text]. Get ready to vote!" (or just "watching [Dancer's Nickname]").

---

### **Phase 3: Voting & Scoreboard**

**Objective:** Allow players (not the dancer) to vote, tally votes, and display scores.

**Backend (Server):**

- **Data Structure:** Add `gameRooms[roomCode].votes = {}` to store votes for the current round (e.g., `{[voterSocketId]: votedForSocketId}`).
- **Socket.IO Events:**
  - `startVoting` (payload: `{ roomCode }`, emitted by host):
    - Validate sender is host.
    - Set `gameRooms[roomCode].gameState = 'VOTING'`.
    - Clear previous round's votes: `gameRooms[roomCode].votes = {}`.
    - Emit `votingPhaseStarted` to all clients in `roomCode`. Provide a list of players who can be voted for (all players except `currentDancer`).
  - `submitVote` (payload: `{ roomCode, votedForSocketId }`, emitted by player):
    - Validate voter is not `currentDancer`.
    - Validate voter hasn't voted yet in this round.
    - Store vote: `gameRooms[roomCode].votes[socket.id] = votedForSocketId;`.
    - (Optional) Emit `voteReceived` to host client with `voterNickname` or count of votes.
    - If all eligible players have voted, automatically trigger result calculation OR wait for host.
  - `showResults` (payload: `{ roomCode }`, emitted by host):
    - Validate sender is host.
    - Tally votes: Iterate through `gameRooms[roomCode].votes`.
    - Award points:
      - Simple: Dancer with most votes gets X points (e.g., 1000).
      - (Optional) Voters who picked the winner get Y points (e.g., 500).
    - Update `gameRooms[roomCode].scores`.
    - Set `gameRooms[roomCode].gameState = 'ROUND_RESULTS'`.
    - Emit `roundResults` to all clients in `roomCode` with `{ voteCounts: {/* socketId: count */}, updatedScores: gameRooms[roomCode].scores }`.

**Frontend (Client-Host):**

- UI: Button "Open Voting" becomes active. On click, emit `startVoting`.
- Listen for `votingPhaseStarted`: Display "Voting is now open!"
- (Optional) Listen for `voteReceived`: Display "X out of Y players have voted."
- UI: Button "Show Results / Next Dancer". On click, emit `showResults`. (This button might later emit `requestNextDancer` after results are shown).
- Listen for `roundResults`: Display who got how many votes. Display the updated overall scoreboard.

**Frontend (Client-Player):**

- Listen for `votingPhaseStarted`:
  - If `socket.id` is `currentDancer`: Display "Waiting for votes...".
  - Else: Display a list of other players (as buttons/radio buttons) to vote for.
- On selecting a player to vote for, emit `submitVote`. Disable voting UI and show "Vote submitted!".
- Listen for `roundResults`: Display vote counts and the updated overall scoreboard.

---

### **Phase 4: Game End & Polish**

**Objective:** Handle game end, display final scores, and minor polish.

**Backend (Server):**

- **Game End Logic:** After a set number of rounds, or when all players have had a chance to dance X times.
  - When `requestNextDancer` determines game should end:
    - Set `gameRooms[roomCode].gameState = 'ENDED'`.
    - Emit `gameOver` to all clients in `roomCode` with final `scores`.
- **Error Handling:** Implement more robust error handling for invalid states or inputs.
- **Cleanup:** Ensure `gameRooms` can be cleared or reset (e.g., if host wants to start a new game, or for server maintenance). Consider a `resetGame` event.

**Frontend (Client-Host):**

- Listen for `gameOver`: Display "Game Over!" and the final scoreboard prominently.
- UI: Button "Play Again" (emits `createGame` or a `resetGame` to reuse the room code with same players).
- Improve general UI clarity and instructions.

**Frontend (Client-Player):**

- Listen for `gameOver`: Display "Game Over!" and final scoreboard.
- UI: Option to "Leave Game" or wait for host to start a new one.
- Improve general UI clarity and instructions.

---

## 6. Coding Guidelines for LLM (Aider/Gemini)

- **Incremental Development:** Implement features step-by-step as outlined in the phases. Commit changes frequently (conceptually, if Aider supports this).
- **Modularity:**
  - **Backend:** Separate Express route/Socket.IO event handlers from core game logic where appropriate. Consider a `gameService.js` or similar for managing `gameRooms` state and transitions.
  - **Frontend:** Use React components for different UI parts (e.g., `PlayerList`, `Scoreboard`, `VotingOptions`, `PromptDisplay`). Keep components focused and reusable.
- **Clear Comments:** Add comments to explain non-obvious logic, especially for game state transitions and Socket.IO event handling.
- **Error Handling:**
  - **Server:** Validate inputs for Socket.IO events. Send back meaningful error events to clients (e.g., `joinFailed`, `actionFailed`).
  - **Client:** Handle potential error events from the server and display user-friendly messages.
- **Consistent Naming:** Use consistent naming conventions for variables, functions, components, and Socket.IO events (e.g., camelCase for variables/functions, PascalCase for React components, verbNoun or nounVerb for events like `playerJoined`, `submitVote`).
- **State Management (Frontend):**
  - Use React's `useState` and `useEffect` for component-level state and side effects (like socket subscriptions).
  - For shared state across components (e.g., socket instance, basic game state), consider React Context API for simplicity in this MVP.
- **No Magic Strings/Numbers:** Use constants for Socket.IO event names, game states, etc., where possible.
  ```javascript
  // Example for event names
  // common/events.js (can be shared or duplicated)
  // export const EVENTS = {
  //   CREATE_GAME: 'createGame',
  //   GAME_CREATED: 'gameCreated',
  //   // ... more events
  // };
  ```
- **Asynchronous Operations:** Use `async/await` for cleaner asynchronous code on the server and client where applicable.
- **Socket.IO Best Practices:**
  - Server emits to rooms or specific sockets, not just `io.emit()` (broadcast to all connected clients globally) unless intended.
  - Clean up socket event listeners in React components during `useEffect` cleanup to prevent memory leaks.
  ```javascript
  useEffect(() => {
    socket.on('someEvent', handler);
    return () => {
      socket.off('someEvent', handler); // Cleanup
    };
  }, [socket]); // Add dependencies
  ```

## 7. Local Development and Testing Setup Instructions

- **Server:**
  - Navigate to `server/`.
  - Run `npm install`.
  - Run `npm run dev` (assuming `nodemon src/index.js` script in `package.json`).
  - Server should run on `http://localhost:3001`.
- **Client-Host:**
  - Navigate to `client-host/`.
  - Run `npm install`.
  - Run `npm start`.
  - Host client should open/run on `http://localhost:3000`.
- **Client-Player:**
  - Navigate to `client-player/`.
  - Run `npm install`.
  - Run `npm start`. (Will likely prompt to run on a different port, e.g., `http://localhost:3002`).
  - Player client should open/run on `http://localhost:3002`.
- **LAN Testing:**
  1.  Find the local IP address of the machine running the server (e.g., `192.168.1.X`).
  2.  Modify the server to listen on `0.0.0.0` instead of `localhost`: `server.listen(PORT, '0.0.0.0', ...)`.
  3.  Update `SOCKET_SERVER_URL` in both client apps to `http://YOUR_LAN_IP:3001`.
  4.  Ensure firewall allows incoming connections on port `3001` on the server machine.
  5.  Access client apps from other devices on the same LAN using `http://YOUR_LAN_IP:3000` (host) and `http://YOUR_LAN_IP:3002` (player). (Alternatively, build static assets and serve them from the Node.js server or using a simple static server like `serve`).

This detailed guide should provide a strong foundation for Aider/Gemini to assist you. Good luck with the development!
