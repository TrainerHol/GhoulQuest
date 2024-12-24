// Game state management
let gameState = {
  players: [],
  currentRound: 1,
  treasureData: [],
  deckData: {}, // Will store all deck data
  globalEffects: [],
  history: [],
  historyIndex: -1,
};

let debounceTimer = null;
let pendingStateChange = false;

// Initialize the application
async function init() {
  try {
    // Load all deck data
    const decks = ["treasure", "aether", "diversion", "summon", "achievements"];
    for (const deck of decks) {
      const response = await fetch(`../DiscordBot/decks/${deck}.json`);
      gameState.deckData[deck] = await response.json();
    }
    gameState.treasureData = gameState.deckData.treasure;
    updatePlayerCount(4); // Default 4 players
    saveState();
    updateEffectTargetSelect();
    setupContextMenu();
  } catch (error) {
    console.error("Error loading data:", error);
  }
}

// Debounced state save
function debouncedSave(callback) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  pendingStateChange = true;
  debounceTimer = setTimeout(() => {
    pendingStateChange = false;
    saveState();
    if (callback) callback();
  }, 500); // Wait for 500ms of no changes before saving state
}

// Context Menu
function setupContextMenu() {
  // Create context menu
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.innerHTML = `
        <div class="context-menu-item danger">Delete Player</div>
    `;
  document.body.appendChild(menu);

  // Hide menu on click outside
  document.addEventListener("click", () => {
    menu.style.display = "none";
  });

  // Prevent default context menu
  document.addEventListener("contextmenu", (e) => {
    const playerCard = e.target.closest(".player-card");
    if (playerCard) {
      e.preventDefault();
      const rect = playerCard.getBoundingClientRect();
      menu.style.display = "block";
      menu.style.left = e.clientX + "px";
      menu.style.top = e.clientY + "px";

      // Store the player index in the menu
      const playerIndex = Array.from(playerCard.parentNode.children).indexOf(playerCard);
      menu.dataset.playerIndex = playerIndex;
    }
  });

  // Handle menu item clicks
  menu.querySelector(".danger").addEventListener("click", (e) => {
    const playerIndex = parseInt(menu.dataset.playerIndex);
    if (!isNaN(playerIndex)) {
      removePlayer(playerIndex);
    }
    menu.style.display = "none";
    e.stopPropagation();
  });
}

// Player management
function createPlayer(name = "") {
  return {
    name: name,
    score: 15,
    shield: 0,
    treasures: [null, null],
    achievements: [],
    effects: [],
    turnComplete: false,
  };
}

function updatePlayerCount(count) {
  const currentCount = gameState.players.length;
  if (count > currentCount) {
    for (let i = currentCount; i < count; i++) {
      gameState.players.push(createPlayer(`Player ${i + 1}`));
    }
  } else if (count < currentCount) {
    gameState.players = gameState.players.slice(0, count);
  }
  renderPlayers();
  updateEffectTargetSelect();
  saveState();
}

// Render functions
function renderPlayers() {
  const playersList = document.getElementById("playersList");
  playersList.innerHTML = "";

  // Find the current player's turn
  let currentTurnIndex = gameState.players.findIndex((p) => !p.turnComplete);
  const allComplete = currentTurnIndex === -1;

  // Update Next Round button state
  const nextRoundBtn = document.getElementById("nextRoundBtn");
  if (allComplete) {
    nextRoundBtn.classList.add("ready");
  } else {
    nextRoundBtn.classList.remove("ready");
  }

  gameState.players.forEach((player, index) => {
    const playerCard = document.createElement("div");
    playerCard.className = `player-card ${!allComplete && index === currentTurnIndex ? "current-turn" : ""}`;
    playerCard.innerHTML = `
      <div class="player-content">
        <div class="player-header">
          <input type="text" class="player-name" value="${player.name}" 
                 onchange="updatePlayerName(${index}, this.value)" placeholder="Player Name">
        </div>
        <div class="player-stats">
          <div class="stat-group">
            <label>HP:</label>
            <input type="text" value="${player.score}" 
                   onkeypress="handleHPKeyPress(event, ${index}, this)"
                   onblur="validateHP(${index}, this)">
          </div>
          <div class="stat-group">
            <label>Shield:</label>
            <input type="number" value="${player.shield}" 
                   onchange="updatePlayerShield(${index}, this.value)">
          </div>
        </div>
        <div class="achievements">
          ${player.achievements && player.achievements.length > 0 ? `<div class="achievement-slot">${renderAchievement(player.achievements[0])}</div>` : `<div class="achievement-slot empty" onclick="openAchievementModal(${index})">Add Achievement</div>`}
        </div>
        <div class="treasures">
          <div class="treasure-slot ${!player.treasures[0] ? "empty" : ""}" 
               onclick="openTreasureModal(${index}, 0)">
            ${player.treasures[0] ? renderTreasure(player.treasures[0]) : "Add Treasure"}
          </div>
          <div class="treasure-slot ${!player.treasures[1] ? "empty" : ""}" 
               onclick="openTreasureModal(${index}, 1)">
            ${player.treasures[1] ? renderTreasure(player.treasures[1]) : "Add Treasure"}
          </div>
        </div>
      </div>
      <div class="turn-tracker" onclick="toggleTurnComplete(${index})">
        <input type="checkbox" ${player.turnComplete ? "checked" : ""} 
               onclick="event.stopPropagation()">
        <label>Turn Complete</label>
      </div>
    `;

    // Add click handler for the checkbox to update the parent's onclick
    const checkbox = playerCard.querySelector('.turn-tracker input[type="checkbox"]');
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      toggleTurnComplete(index);
    });

    playersList.appendChild(playerCard);
  });
}

function renderTreasure(treasure) {
  return `
        <div class="treasure-info">
            <h4>${treasure.Name}</h4>
            <p>${treasure.Effect}</p>
            ${
              treasure.roundsLeft
                ? `
                <div class="effect-counter">
                    <label>Rounds:</label>
                    <input type="number" value="${treasure.roundsLeft}" min="0" 
                           onchange="updateTreasureRounds(${treasure.playerIndex}, ${treasure.slotIndex}, this.value)">
                </div>
            `
                : ""
            }
        </div>
    `;
}

// Effect Management
function addEffect() {
  const description = document.getElementById("effectDescription").value;
  const rounds = parseInt(document.getElementById("effectRounds").value);
  const target = document.getElementById("effectTarget").value;

  if (!description || rounds < 1) return;

  const effect = {
    description,
    rounds,
    target,
    id: Date.now(),
  };

  if (target === "all") {
    gameState.globalEffects.push(effect);
  } else {
    const playerIndex = parseInt(target);
    gameState.players[playerIndex].effects.push(effect);
  }

  document.getElementById("effectDescription").value = "";
  document.getElementById("effectRounds").value = "1";

  renderEffects();
  saveState();
}

function renderEffects() {
  const activeEffects = document.getElementById("activeEffects");
  activeEffects.innerHTML = "";

  // Render global effects
  gameState.globalEffects.forEach((effect) => {
    activeEffects.appendChild(createEffectElement(effect, null));
  });

  // Render player-specific effects
  gameState.players.forEach((player, playerIndex) => {
    player.effects.forEach((effect) => {
      activeEffects.appendChild(createEffectElement(effect, playerIndex));
    });
  });
}

function createEffectElement(effect, playerIndex) {
  try {
    const div = document.createElement("div");
    div.className = `effect-item ${effect.deckType || "custom"}`;

    // Find original effect data if it exists
    let originalEffect = null;
    if (effect.originalDeck && effect.originalName) {
      originalEffect = gameState.deckData[effect.originalDeck]?.find((e) => (e.Name || e.name) === effect.originalName);
    }

    const effectName = originalEffect ? originalEffect.Name || originalEffect.name : "Custom Effect";
    const targetName = playerIndex !== null ? gameState.players[playerIndex].name : "Global Effect";

    div.innerHTML = `
      <div class="effect-info">
        <div class="effect-title">${effectName}</div>
        <div class="effect-target">${targetName}</div>
        <div class="effect-description">${effect.description}</div>
      </div>
      <div class="effect-controls">
        <input type="number" value="${effect.rounds}" min="0" 
          onchange="updateEffectRounds('${effect.id}', ${playerIndex}, this.value)">
        <button type="button" onclick="removeEffect('${effect.id}', ${playerIndex === null ? "null" : playerIndex})">×</button>
      </div>
    `;
    return div;
  } catch (error) {
    console.error("Error creating effect element:", error);
    return document.createElement("div"); // Return empty div if there's an error
  }
}

function updateEffectTargetSelect() {
  const select = document.getElementById("effectTarget");
  const currentValue = select.value;

  select.innerHTML = '<option value="all">All Players</option>';
  gameState.players.forEach((player, index) => {
    select.innerHTML += `<option value="${index}">${player.name || "Player " + (index + 1)}</option>`;
  });

  // Restore previous selection if still valid
  if (currentValue === "all" || (currentValue >= 0 && currentValue < gameState.players.length)) {
    select.value = currentValue;
  }
}

function removeEffect(effectId, playerIndex) {
  try {
    if (playerIndex === null) {
      gameState.globalEffects = gameState.globalEffects.filter((e) => (e.id.toString() === effectId.toString() ? false : true));
    } else {
      gameState.players[playerIndex].effects = gameState.players[playerIndex].effects.filter((e) => (e.id.toString() === effectId.toString() ? false : true));
    }
    renderEffects();
    saveState();
  } catch (error) {
    console.error("Error removing effect:", error, { effectId, playerIndex });
  }
}

// Treasure modal
function openTreasureModal(playerIndex, slotIndex) {
  const modal = document.getElementById("treasureModal");
  modal.style.display = "block";
  modal.dataset.playerIndex = playerIndex;
  modal.dataset.slotIndex = slotIndex;

  renderTreasureList();
}

function renderTreasureList(searchTerm = "") {
  const treasureList = document.getElementById("treasureList");
  const filteredTreasures = gameState.treasureData.filter((t) => !searchTerm || t.Name.toLowerCase().includes(searchTerm.toLowerCase()) || t.Effect.toLowerCase().includes(searchTerm.toLowerCase()));

  treasureList.innerHTML = filteredTreasures
    .map(
      (treasure) => `
        <div class="treasure-item" onclick="selectTreasure('${treasure.Name}')">
            <h4>${treasure.Name}</h4>
            <p>${treasure.Effect}</p>
        </div>
    `
    )
    .join("");
}

function selectTreasure(treasureName) {
  const modal = document.getElementById("treasureModal");
  const playerIndex = parseInt(modal.dataset.playerIndex);
  const slotIndex = parseInt(modal.dataset.slotIndex);

  const treasure = gameState.treasureData.find((t) => t.Name === treasureName);
  if (treasure) {
    const treasureCopy = { ...treasure, playerIndex, slotIndex, roundsLeft: 0 };
    gameState.players[playerIndex].treasures[slotIndex] = treasureCopy;
    saveState();
    renderPlayers();
  }

  modal.style.display = "none";
}

// State management with memory optimization
function saveState() {
  if (pendingStateChange) return; // Don't save if we're still waiting for more changes

  // Create a minimal state object
  const minimalState = {
    players: gameState.players.map((player) => ({
      name: player.name,
      score: player.score,
      shield: player.shield,
      treasures: player.treasures,
      effects: player.effects,
    })),
    currentRound: gameState.currentRound,
    globalEffects: gameState.globalEffects,
  };

  const state = JSON.stringify(minimalState);

  // Limit history size to prevent memory leaks
  const MAX_HISTORY = 50;
  if (gameState.history.length >= MAX_HISTORY) {
    gameState.history = gameState.history.slice(-MAX_HISTORY);
    gameState.historyIndex = Math.min(gameState.historyIndex, MAX_HISTORY - 1);
  }

  // Remove any future states when making a new change
  gameState.history = gameState.history.slice(0, gameState.historyIndex + 1);
  gameState.history.push(state);
  gameState.historyIndex++;

  updateUndoRedoButtons();
}

function restoreState(state) {
  // Deep clone the state to avoid reference issues
  const parsedState = JSON.parse(state);

  // Restore each property individually to maintain references
  gameState.players = parsedState.players;
  gameState.currentRound = parsedState.currentRound;
  gameState.globalEffects = parsedState.globalEffects;

  // Don't restore these as they should persist
  // gameState.treasureData = parsedState.treasureData;
  // gameState.deckData = parsedState.deckData;

  // Update UI
  document.getElementById("currentRound").textContent = gameState.currentRound;
  renderPlayers();
  renderEffects();
  updateUndoRedoButtons();
}

function undo() {
  if (gameState.historyIndex > 0) {
    gameState.historyIndex--;
    restoreState(gameState.history[gameState.historyIndex]);
  }
}

function redo() {
  if (gameState.historyIndex < gameState.history.length - 1) {
    gameState.historyIndex++;
    restoreState(gameState.history[gameState.historyIndex]);
  }
}

function updateUndoRedoButtons() {
  document.getElementById("undoBtn").disabled = gameState.historyIndex <= 0;
  document.getElementById("redoBtn").disabled = gameState.historyIndex >= gameState.history.length - 1;
}

// Event handlers
function nextRound() {
  // Save state before making changes
  const shouldSave = gameState.players.some((p) => !p.turnComplete); // Only save if not all turns were complete

  gameState.currentRound++;
  document.getElementById("currentRound").textContent = gameState.currentRound;

  // Update global effects
  gameState.globalEffects = gameState.globalEffects.filter((effect) => {
    effect.rounds--;
    return effect.rounds > 0;
  });

  // Update player effects and treasures
  gameState.players.forEach((player) => {
    player.effects = player.effects.filter((effect) => {
      effect.rounds--;
      return effect.rounds > 0;
    });

    player.treasures = player.treasures.map((treasure) => {
      if (treasure && treasure.roundsLeft > 0) {
        treasure.roundsLeft--;
        if (treasure.roundsLeft === 0) return null;
      }
      return treasure;
    });

    player.turnComplete = false;
  });

  renderPlayers();
  renderEffects();
  if (shouldSave) saveState(); // Only save state if we had incomplete turns
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  init();
  setupEffectManager();

  document.getElementById("playerCount").addEventListener("change", (e) => {
    updatePlayerCount(parseInt(e.target.value));
  });

  document.getElementById("nextRoundBtn").addEventListener("click", nextRound);
  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("redoBtn").addEventListener("click", redo);

  // Modal close buttons
  document.getElementById("closeTreasureModal").addEventListener("click", () => {
    document.getElementById("treasureModal").style.display = "none";
  });
  document.getElementById("closeAchievementModal").addEventListener("click", () => {
    document.getElementById("achievementModal").style.display = "none";
  });

  // Search inputs
  document.getElementById("treasureSearch").addEventListener("input", (e) => {
    renderTreasureList(e.target.value);
  });
  document.getElementById("achievementSearch")?.addEventListener("input", (e) => {
    renderAchievementList(e.target.value);
  });

  // Close modals when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
    }
  });
});

// Helper functions
function updatePlayerName(index, name) {
  gameState.players[index].name = name;
  updateEffectTargetSelect();
  renderEffects(); // Update effect list to show new names
  saveState();
}

function updatePlayerScore(index, score) {
  gameState.players[index].score = parseInt(score);
  debouncedSave();
}

function updatePlayerShield(index, shield) {
  gameState.players[index].shield = parseInt(shield);
  debouncedSave();
}

function toggleTurnComplete(index) {
  gameState.players[index].turnComplete = !gameState.players[index].turnComplete;
  renderPlayers(); // Just update the UI, don't save to history
}

function removePlayer(index) {
  gameState.players.splice(index, 1);
  document.getElementById("playerCount").value = gameState.players.length;
  saveState();
  renderPlayers();
}

function updateTreasureRounds(playerIndex, slotIndex, rounds) {
  gameState.players[playerIndex].treasures[slotIndex].roundsLeft = parseInt(rounds);
  debouncedSave();
}

function updateEffectRounds(effectId, playerIndex, rounds) {
  try {
    if (playerIndex === null) {
      const effect = gameState.globalEffects.find((e) => e.id === effectId);
      if (effect) effect.rounds = parseInt(rounds);
    } else {
      const effect = gameState.players[playerIndex].effects.find((e) => e.id === effectId);
      if (effect) effect.rounds = parseInt(rounds);
    }
    debouncedSave();
  } catch (error) {
    console.error("Error updating effect rounds:", error);
  }
}

// Update the effect manager to use modal
function setupEffectManager() {
  const addEffectBtn = document.getElementById("addEffectBtn");
  const effectModal = document.getElementById("effectModal");
  const closeEffectModal = document.getElementById("closeEffectModal");
  const effectSearch = document.getElementById("effectSearch");

  addEffectBtn.addEventListener("click", () => {
    effectModal.style.display = "block";
    updateEffectTargetSelect();
    renderEffectList();
  });

  closeEffectModal.addEventListener("click", () => {
    effectModal.style.display = "none";
  });

  effectSearch.addEventListener("input", () => {
    renderEffectList(effectSearch.value);
  });
}

function renderEffectList(searchTerm = "") {
  const effectList = document.getElementById("effectList");
  const allEffects = [];

  // Combine effects from all decks except achievements
  const decks = {
    summon: gameState.deckData.summon || [],
    treasure: gameState.deckData.treasure || [],
    aether: gameState.deckData.aether || [],
    diversion: gameState.deckData.diversion || [],
  };

  for (const [deckName, deck] of Object.entries(decks)) {
    deck.forEach((effect) => {
      allEffects.push({
        ...effect,
        deckType: deckName,
        // Check if effect mentions turns/rounds
        hasDuration: /\b(turn|turns|round|rounds)\b/i.test(effect.Effect || effect.effect || ""),
        // Get name for sorting
        sortName: (effect.Name || effect.name || "").toLowerCase(),
      });
    });
  }

  // Filter effects based on search term
  const filteredEffects = allEffects.filter((effect) => {
    const searchText = searchTerm.toLowerCase();
    const name = effect.sortName;
    const description = (effect.Effect || effect.effect || "").toLowerCase();
    return !searchTerm || name.includes(searchText) || description.includes(searchText);
  });

  // Sort effects: duration first, then alphabetically
  filteredEffects.sort((a, b) => {
    // First sort by duration presence
    if (a.hasDuration && !b.hasDuration) return -1;
    if (!a.hasDuration && b.hasDuration) return 1;
    // Then sort alphabetically
    return a.sortName.localeCompare(b.sortName);
  });

  // Render effects
  effectList.innerHTML = filteredEffects
    .map(
      (effect) => `
    <div class="effect-option ${effect.deckType}" onclick="selectEffect('${effect.deckType}', '${effect.Name || effect.name}')">
      <div class="effect-content">
        <h4>${effect.Name || effect.name}</h4>
        <p>${effect.Effect || effect.effect}</p>
      </div>
    </div>
  `
    )
    .join("");
}

function selectEffect(deckType, effectName) {
  const effect = gameState.deckData[deckType].find((e) => (e.Name || e.name) === effectName);
  const target = document.getElementById("effectTarget").value;

  if (!effect) return;

  // Extract rounds from effect description if possible
  let rounds = 1;
  const roundsMatch = (effect.Effect || effect.effect || "").match(/(\d+)\s*rounds?/i);
  if (roundsMatch) {
    rounds = parseInt(roundsMatch[1]);
  }

  const newEffect = {
    description: effect.Effect || effect.effect,
    rounds,
    target,
    id: Date.now(),
    originalDeck: deckType,
    originalName: effect.Name || effect.name,
    deckType: deckType,
  };

  if (target === "all") {
    gameState.globalEffects.push(newEffect);
  } else {
    const playerIndex = parseInt(target);
    gameState.players[playerIndex].effects.push(newEffect);
  }

  document.getElementById("effectModal").style.display = "none";
  renderEffects();
  saveState();
}

function addCustomEffect() {
  const description = document.getElementById("customEffectDescription").value;
  const rounds = parseInt(document.getElementById("customEffectRounds").value);
  const target = document.getElementById("effectTarget").value;

  if (!description || rounds < 1) return;

  const effect = {
    description,
    rounds,
    target,
    id: Date.now(),
    deckType: "custom",
  };

  if (target === "all") {
    gameState.globalEffects.push(effect);
  } else {
    const playerIndex = parseInt(target);
    gameState.players[playerIndex].effects.push(effect);
  }

  document.getElementById("customEffectDescription").value = "";
  document.getElementById("customEffectRounds").value = "1";
  document.getElementById("effectModal").style.display = "none";

  renderEffects();
  saveState();
}

// Add this helper function for safe arithmetic evaluation
function evaluateExpression(expression) {
  // Remove all whitespace
  expression = expression.replace(/\s/g, "");

  // Check if it's a valid arithmetic expression
  if (!/^[0-9+\-*/().]+$/.test(expression)) {
    return null;
  }

  try {
    // Use Function instead of eval for better safety
    const result = Function('"use strict";return (' + expression + ")")();

    // Check if result is valid
    if (!isFinite(result) || isNaN(result)) {
      return null;
    }

    // Round to nearest integer
    return Math.round(result);
  } catch (e) {
    return null;
  }
}

// Handle keypress for HP input
function handleHPKeyPress(event, playerIndex, input) {
  if (event.key === "Enter") {
    event.preventDefault();
    const expression = input.value;
    const result = evaluateExpression(expression);

    if (result !== null) {
      input.value = result;
      updatePlayerScore(playerIndex, result);
    } else {
      // Reset to previous value
      input.value = gameState.players[playerIndex].score;
    }
    input.blur();
  }
}

// Validate HP on blur
function validateHP(playerIndex, input) {
  const expression = input.value;
  const result = evaluateExpression(expression);

  if (result !== null) {
    input.value = result;
    updatePlayerScore(playerIndex, result);
  } else {
    // Reset to previous value
    input.value = gameState.players[playerIndex].score;
  }
}

// Add achievement handling
function renderAchievement(achievement) {
  return `
        <div class="achievement-info">
            <h4>${achievement.name}</h4>
            <div class="achievement-description" 
                 contenteditable="true" 
                 onblur="updateAchievementDescription(${achievement.playerIndex}, ${achievement.id}, this.textContent)">${achievement.description}</div>
            <button class="swap-achievement" onclick="openAchievementModal(${achievement.playerIndex})">↺</button>
        </div>
    `;
}

function openAchievementModal(playerIndex) {
  const modal = document.getElementById("achievementModal");
  modal.style.display = "block";
  modal.dataset.playerIndex = playerIndex;
  renderAchievementList();
}

function renderAchievementList(searchTerm = "") {
  const achievementList = document.getElementById("achievementList");
  const achievements = gameState.deckData.achievements || [];

  const filteredAchievements = achievements.filter((a) => !searchTerm || a.Achievement.toLowerCase().includes(searchTerm.toLowerCase()) || (a.Objective && a.Objective.toLowerCase().includes(searchTerm.toLowerCase())));

  achievementList.innerHTML = filteredAchievements
    .map(
      (achievement) => `
    <div class="achievement-item" onclick="selectAchievement('${achievement.Achievement}')">
        <h4>${achievement.Achievement}</h4>
        <p>${achievement.Objective || ""}</p>
    </div>
  `
    )
    .join("");
}

function selectAchievement(achievementName) {
  const modal = document.getElementById("achievementModal");
  const playerIndex = parseInt(modal.dataset.playerIndex);

  const achievement = gameState.deckData.achievements.find((a) => a.Achievement === achievementName);
  if (achievement) {
    const achievementCopy = {
      name: achievement.Achievement,
      description: achievement.Objective,
      playerIndex,
      id: Date.now(),
    };

    // Replace any existing achievement
    gameState.players[playerIndex].achievements = [achievementCopy];
    saveState();
    renderPlayers();
  }

  modal.style.display = "none";
}

function updateAchievementDescription(playerIndex, achievementId, description) {
  const achievement = gameState.players[playerIndex].achievements.find((a) => a.id === achievementId);
  if (achievement) {
    achievement.description = description;
    debouncedSave();
  }
}
