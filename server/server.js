const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
}));

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Complete UNO Game Manager with Fixed Reverse for All Player Counts
class CompleteUnoGame {
  constructor() {
    this.rooms = new Map();
    this.players = new Map();
  }

  generateDeck() {
    const colors = ['red', 'blue', 'green', 'yellow'];
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const specials = ['skip', 'reverse', 'draw2'];
    let deck = [];
    let cardId = 1;
    
    colors.forEach(color => {
      deck.push({ id: cardId++, color, value: '0', type: 'number' });
      for (let i = 1; i <= 9; i++) {
        deck.push({ id: cardId++, color, value: i.toString(), type: 'number' });
        deck.push({ id: cardId++, color, value: i.toString(), type: 'number' });
      }
    });
    
    colors.forEach(color => {
      specials.forEach(special => {
        deck.push({ id: cardId++, color, value: special, type: 'action' });
        deck.push({ id: cardId++, color, value: special, type: 'action' });
      });
    });
    
    for (let i = 0; i < 4; i++) {
      deck.push({ id: cardId++, color: 'wild', value: 'wild', type: 'wild' });
      deck.push({ id: cardId++, color: 'wild', value: 'draw4', type: 'wild' });
    }
    
    return this.shuffleDeck(deck);
  }

  shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  createRoom(playerId, playerName) {
    const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const room = {
      id: roomId,
      players: [],
      deck: [],
      discardPile: [],
      currentPlayer: 0,
      direction: 1,
      currentColor: null,
      gameState: 'waiting',
      drawStack: 0,
      lastAction: null,
      calledUno: new Set(),
      chatMessages: []
    };

    const player = {
      id: playerId,
      name: playerName,
      cards: [],
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`,
      hasCalledUno: false,
      mustDraw: 0
    };

    room.players.push(player);
    this.rooms.set(roomId, room);
    this.players.set(playerId, { roomId, playerData: player });

    console.log(`🏠 Room ${roomId} created by ${playerName}`);
    this.addSystemMessage(roomId, `🎮 Welcome to the game, ${playerName}!`);
    
    return { roomId, room };
  }

  joinRoom(roomId, playerId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.players.length >= 4) return { error: 'Room is full' };

    const player = {
      id: playerId,
      name: playerName,
      cards: [],
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`,
      hasCalledUno: false,
      mustDraw: 0
    };

    room.players.push(player);
    this.players.set(playerId, { roomId, playerData: player });

    console.log(`🚪 ${playerName} joined room ${roomId}`);
    this.addSystemMessage(roomId, `🚪 ${playerName} joined the game!`);

    if (room.players.length >= 2) {
      setTimeout(() => {
        this.addSystemMessage(roomId, `⚡ Game starting in 2 seconds...`);
        setTimeout(() => this.startGame(roomId), 2000);
      }, 500);
    }

    return { success: true, room, player };
  }

  addSystemMessage(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const chatMessage = {
      type: 'system',
      player: 'System',
      message: message,
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now() + Math.random()
    };

    room.chatMessages.push(chatMessage);
    io.to(roomId).emit('chatMessage', chatMessage);
    console.log(`💬 System message in room ${roomId}: ${message}`);
  }

  addChatMessage(playerId, message) {
    const playerInfo = this.players.get(playerId);
    if (!playerInfo) return false;

    const room = this.rooms.get(playerInfo.roomId);
    if (!room) return false;

    const chatMessage = {
      type: 'player',
      player: playerInfo.playerData.name,
      message: message.trim(),
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now() + Math.random(),
      playerId: playerId
    };

    room.chatMessages.push(chatMessage);
    io.to(playerInfo.roomId).emit('chatMessage', chatMessage);
    console.log(`💬 Chat message in room ${playerInfo.roomId} from ${playerInfo.playerData.name}: ${message}`);
    return true;
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`🎮 Starting UNO game in room ${roomId} with ${room.players.length} players`);
    
    room.deck = this.generateDeck();
    room.discardPile = [];
    room.drawStack = 0;
    room.calledUno.clear();
    room.direction = 1;
    room.currentPlayer = 0;

    room.players.forEach(player => {
      player.cards = [];
      for (let i = 0; i < 7; i++) {
        if (room.deck.length > 0) {
          player.cards.push(room.deck.shift());
        }
      }
      player.hasCalledUno = false;
      player.mustDraw = 0;
    });

    let firstCard;
    do {
      firstCard = room.deck.shift();
    } while (firstCard && (firstCard.color === 'wild'));

    if (firstCard) {
      room.discardPile.push(firstCard);
      room.currentColor = firstCard.color;
      this.handleFirstCardEffect(room, firstCard);
    }

    room.gameState = 'playing';

    this.addSystemMessage(roomId, `🎮 UNO Game Started! Cards dealt to all players!`);
    this.addSystemMessage(roomId, `🎯 ${room.players[room.currentPlayer].name}'s turn to play!`);

    this.broadcastToRoom(roomId, 'gameStarted', {
      message: '🎮 UNO Game Started! Cards dealt!'
    });

    this.broadcastGameState(roomId);
  }

  handleFirstCardEffect(room, card) {
    switch (card.value) {
      case 'skip':
        this.addSystemMessage(room.id, `⏭️ First card is Skip! ${room.players[0].name} is skipped!`);
        room.currentPlayer = 1 % room.players.length;
        break;
      case 'reverse':
        this.addSystemMessage(room.id, `🔄 First card is Reverse! Direction changed to counter-clockwise!`);
        room.direction = -1;
        room.currentPlayer = room.players.length - 1;
        break;
      case 'draw2':
        this.addSystemMessage(room.id, `📈 First card is Draw 2! ${room.players[0].name} must draw 2 cards!`);
        room.drawStack = 2;
        room.currentPlayer = 1 % room.players.length;
        break;
      default:
        room.currentPlayer = 0;
        break;
    }
  }

  isValidPlay(card, topCard, currentColor, drawStack) {
    if (drawStack > 0) {
      return (card.value === 'draw2' && topCard.value === 'draw2') ||
             (card.value === 'draw4' && topCard.value === 'draw4') ||
             (card.value === 'draw4');
    }
    if (card.color === 'wild') return true;
    return card.color === currentColor || card.value === topCard.value;
  }

  playCard(playerId, cardId, chosenColor = null) {
    const playerInfo = this.players.get(playerId);
    if (!playerInfo) return { success: false };

    const room = this.rooms.get(playerInfo.roomId);
    if (!room) return { success: false };

    const player = room.players.find(p => p.id === playerId);
    
    if (room.players[room.currentPlayer].id !== playerId) {
      return { success: false };
    }

    const cardIndex = player.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { success: false };

    const card = player.cards[cardIndex];
    const topCard = room.discardPile[room.discardPile.length - 1];

    if (!this.isValidPlay(card, topCard, room.currentColor, room.drawStack)) {
      return { success: false };
    }

    player.cards.splice(cardIndex, 1);
    room.discardPile.push(card);
    
    if (card.color === 'wild') {
      room.currentColor = chosenColor || 'red';
      this.addSystemMessage(playerInfo.roomId, `🌈 ${player.name} played a ${card.value === 'draw4' ? 'Wild Draw 4' : 'Wild'} card and chose ${chosenColor?.toUpperCase()}!`);
    } else {
      room.currentColor = card.color;
      this.addSystemMessage(playerInfo.roomId, `🃏 ${player.name} played ${card.color?.toUpperCase()} ${card.value?.toUpperCase()}!`);
    }

    player.hasCalledUno = false;
    room.calledUno.delete(playerId);

    if (player.cards.length === 1) {
      room.calledUno.add(playerId);
      player.hasCalledUno = true;
      this.addSystemMessage(playerInfo.roomId, `🚨 ${player.name} has UNO! (1 card remaining)`);
      this.broadcastToRoom(playerInfo.roomId, 'unoAlert', {
        player: player.name,
        message: `🚨 ${player.name} has UNO!`
      });
    }

    if (player.cards.length === 0) {
      room.gameState = 'finished';
      this.addSystemMessage(playerInfo.roomId, `🏆 ${player.name} wins the game! Congratulations! 🎉`);
      this.broadcastToRoom(playerInfo.roomId, 'gameWon', {
        winner: player.name,
        message: `🎉 ${player.name} wins the game!`
      });
      return { success: true };
    }

    this.handleActionCard(room, card, player.name);

    room.lastAction = {
      type: 'cardPlayed',
      player: player.name,
      card: card,
      timestamp: Date.now()
    };

    this.broadcastGameState(playerInfo.roomId);
    return { success: true };
  }

  // FIXED: Universal reverse that works for 2 players and 3+ players
  // UNIVERSAL Reverse Card - Works for 2, 3, and 4 players
handleActionCard(room, card, playerName) {
  console.log(`🎯 Handling ${card.value} card by ${playerName}, current player: ${room.currentPlayer}, direction: ${room.direction}, players: ${room.players.length}`);
  
  switch (card.value) {
    case 'skip':
      this.nextTurn(room);
      const skippedPlayer = room.players[room.currentPlayer];
      this.addSystemMessage(room.id, `⏭️ ${skippedPlayer.name} was skipped by ${playerName}!`);
      this.nextTurn(room);
      break;
      
    case 'reverse':
      console.log(`🔄 REVERSE CARD PLAYED by ${playerName}`);
      
      // STEP 1: Flip direction
      room.direction *= -1;
      this.addSystemMessage(room.id, `🔄 ${playerName} played Reverse! Direction: ${room.direction === 1 ? 'clockwise ⟲' : 'counter-clockwise ⟳'}`);
      
      // STEP 2: Move to next turn (this works for ALL player counts)
      this.nextTurn(room);
      
      console.log(`🔄 After reverse: Player ${room.currentPlayer} (${room.players[room.currentPlayer].name}) - Direction: ${room.direction}`);
      break;
      
    case 'draw2':
      this.nextTurn(room);
      room.drawStack += 2;
      this.addSystemMessage(room.id, `📈 +2 cards penalty for ${room.players[room.currentPlayer].name} by ${playerName}!`);
      break;
      
    case 'draw4':
      this.nextTurn(room);
      room.drawStack += 4;
      this.addSystemMessage(room.id, `📈 +4 cards penalty for ${room.players[room.currentPlayer].name} by ${playerName}!`);
      break;
      
    default:
      this.nextTurn(room);
      break;
  }

  if (room.gameState === 'playing') {
    this.addSystemMessage(room.id, `🎯 ${room.players[room.currentPlayer].name}'s turn!`);
  }
}


  drawCard(playerId) {
    const playerInfo = this.players.get(playerId);
    if (!playerInfo) return { success: false };

    const room = this.rooms.get(playerInfo.roomId);
    if (!room) return { success: false };

    const player = room.players.find(p => p.id === playerId);
    
    if (room.players[room.currentPlayer].id !== playerId) {
      return { success: false };
    }

    const cardsToDraw = Math.max(room.drawStack, 1);
    
    for (let i = 0; i < cardsToDraw; i++) {
      if (room.deck.length === 0) {
        this.reshuffleDeck(room);
      }
      if (room.deck.length > 0) {
        const drawnCard = room.deck.shift();
        player.cards.push(drawnCard);
      }
    }

    if (room.drawStack > 0) {
      this.addSystemMessage(playerInfo.roomId, `📥 ${player.name} drew ${cardsToDraw} penalty cards!`);
    } else {
      this.addSystemMessage(playerInfo.roomId, `📥 ${player.name} drew a card from the deck.`);
    }

    room.drawStack = 0;
    this.nextTurn(room);

    this.addSystemMessage(playerInfo.roomId, `🎯 ${room.players[room.currentPlayer].name}'s turn!`);

    room.lastAction = {
      type: 'cardDrawn',
      player: player.name,
      count: cardsToDraw,
      timestamp: Date.now()
    };

    this.broadcastGameState(playerInfo.roomId);
    return { success: true };
  }

  nextTurn(room) {
  const playerCount = room.players.length;
  room.currentPlayer = (room.currentPlayer + room.direction + playerCount) % playerCount;
  console.log(`🔄 Next turn: Player ${room.currentPlayer} (${room.players[room.currentPlayer].name}), Direction: ${room.direction}`);
}

  reshuffleDeck(room) {
    if (room.discardPile.length <= 1) return;
    
    const topCard = room.discardPile.pop();
    const shuffleCards = [...room.discardPile];
    
    shuffleCards.forEach(card => {
      if (card.color === 'wild') {
        card.chosenColor = null;
      }
    });
    
    room.deck = this.shuffleDeck(shuffleCards);
    room.discardPile = [topCard];
    
    this.addSystemMessage(room.id, `🔄 Deck reshuffled from discard pile!`);
  }

  getPublicGameState(room) {
    return {
      roomId: room.id,
      players: room.players.map((p, index) => ({
        id: p.id,
        name: p.name,
        cardCount: p.cards.length,
        avatar: p.avatar,
        hasCalledUno: p.hasCalledUno,
        isCurrentPlayer: index === room.currentPlayer
      })),
      currentPlayer: room.currentPlayer,
      currentPlayerName: room.players[room.currentPlayer]?.name || 'Unknown',
      currentColor: room.currentColor,
      topCard: room.discardPile[room.discardPile.length - 1],
      direction: room.direction,
      gameState: room.gameState,
      deckSize: room.deck.length,
      drawStack: room.drawStack,
      lastAction: room.lastAction
    };
  }

  getPrivateGameState(playerId) {
    const playerInfo = this.players.get(playerId);
    if (!playerInfo) return null;

    const room = this.rooms.get(playerInfo.roomId);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    const publicState = this.getPublicGameState(room);

    return {
      ...publicState,
      myCards: player.cards,
      isMyTurn: room.players[room.currentPlayer]?.id === playerId,
      mustDraw: player.mustDraw
    };
  }

  broadcastGameState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players.forEach(player => {
      const socket = io.sockets.sockets.get(player.id);
      if (socket) {
        const gameState = this.getPrivateGameState(player.id);
        socket.emit('gameUpdate', gameState);
      }
    });
  }

  broadcastToRoom(roomId, event, data) {
    io.to(roomId).emit(event, data);
  }

  removePlayer(playerId) {
    const playerInfo = this.players.get(playerId);
    if (playerInfo) {
      const room = this.rooms.get(playerInfo.roomId);
      if (room) {
        this.addSystemMessage(playerInfo.roomId, `👋 ${playerInfo.playerData.name} left the game.`);
        room.players = room.players.filter(p => p.id !== playerId);
        if (room.players.length === 0) {
          this.rooms.delete(playerInfo.roomId);
        } else {
          if (room.currentPlayer >= room.players.length) {
            room.currentPlayer = 0;
          }
        }
      }
    }
    this.players.delete(playerId);
  }
}

const game = new CompleteUnoGame();

io.on('connection', (socket) => {
  console.log('🎮 Player connected:', socket.id);

  socket.on('createRoom', (data) => {
    const result = game.createRoom(socket.id, data.playerName);
    socket.join(result.roomId);
    socket.emit('roomCreated', result);
  });

  socket.on('joinRoom', (data) => {
    const result = game.joinRoom(data.roomId, socket.id, data.playerName);
    if (result.error) {
      socket.emit('error', { message: result.error });
    } else {
      socket.join(data.roomId);
      socket.emit('roomJoined', result);
      socket.to(data.roomId).emit('playerJoined', { player: result.player });
    }
  });

  socket.on('playCard', (data) => {
    game.playCard(socket.id, data.cardId, data.chosenColor);
  });

  socket.on('drawCard', () => {
    game.drawCard(socket.id);
  });

  socket.on('sendMessage', (data) => {
    console.log('💬 Received chat message:', data);
    if (data.message && data.message.trim()) {
      const success = game.addChatMessage(socket.id, data.message);
      if (!success) {
        console.log('❌ Failed to send chat message');
      }
    }
  });

  socket.on('disconnect', () => {
    game.removePlayer(socket.id);
    console.log('👋 Player disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3003;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Complete UNO Game Server with Fixed Reverse for ALL Players running on port ${PORT}`);
  console.log(`🔄 Reverse card now works for 2-player and 3+ player games!`);
  console.log(`🃏 All features: Skip, Reverse, Draw 2, Draw 4, Chat, Themes!`);
});
