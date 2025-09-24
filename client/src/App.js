import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

function App() {
  // NETWORK STATE
  const [gameState, setGameState] = useState('lobby');
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [player, setPlayer] = useState(null);
  const [room, setRoom] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState('create');
  const [gameData, setGameData] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [isMyTurn, setIsMyTurn] = useState(false);

  // UI STATE
  const [theme, setTheme] = useState('dark');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState(null);

  // SOCKET CONNECTION
  useEffect(() => {
    console.log('🔗 Initializing socket connection...');
    
    const socketInstance = io('http://localhost:3003', {
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('✅ Connected to server');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('❌ Disconnected from server');
    });

    socketInstance.on('roomCreated', (data) => {
      console.log('🏠 Room created:', data);
      setRoom(data.room);
      setPlayer(data.room.players[0]);
      setGameState('waiting');
    });

    socketInstance.on('roomJoined', (data) => {
      console.log('🚪 Room joined:', data);
      setRoom(data.room);
      setPlayer(data.player);
      setGameState('waiting');
    });

    socketInstance.on('playerJoined', (data) => {
      console.log('👤 Player joined:', data);
      setRoom(prevRoom => ({
        ...prevRoom,
        players: [...(prevRoom?.players || []), data.player]
      }));
    });

    socketInstance.on('gameStarted', (data) => {
      console.log('🎮 Game started:', data);
      setGameState('playing');
    });

    socketInstance.on('gameUpdate', (data) => {
      console.log('📊 Game update received:', data);
      setGameData(data);
      setMyCards(data.myCards || []);
      setIsMyTurn(data.isMyTurn || false);
    });

    socketInstance.on('gameWon', (data) => {
      console.log('🏆 Game won:', data);
      showWinAnimation(data.winner);
      setTimeout(() => {
        setGameState('lobby');
        setRoom(null);
        setPlayer(null);
        setGameData(null);
        setMyCards([]);
        setChatMessages([]);
      }, 5000);
    });

    socketInstance.on('unoAlert', (data) => {
      showUnoAlert(data.message);
    });

    socketInstance.on('chatMessage', (message) => {
      setChatMessages(prev => [...prev, {
        player: message.player,
        message: message.message,
        timestamp: message.timestamp,
        type: message.type || 'player'
      }]);
    });

    socketInstance.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    setSocket(socketInstance);

    return () => {
      console.log('🔌 Closing socket connection');
      socketInstance.close();
    };
  }, []);

  // GAME FUNCTIONS
  const createRoom = () => {
    if (socket && playerName.trim()) {
      console.log('🎯 Creating room for:', playerName);
      socket.emit('createRoom', { playerName: playerName.trim() });
    }
  };

  const joinRoom = () => {
    if (socket && playerName.trim() && roomId.trim()) {
      console.log('🎯 Joining room:', roomId);
      socket.emit('joinRoom', { 
        roomId: roomId.trim().toUpperCase(), 
        playerName: playerName.trim() 
      });
    }
  };

  const playCard = (cardId, chosenColor = null) => {
    if (socket && isMyTurn) {
      console.log('🃏 Playing card:', cardId, 'with color:', chosenColor);
      socket.emit('playCard', { cardId, chosenColor });
    }
  };

  const drawCard = () => {
    if (socket && isMyTurn) {
      console.log('🃏 Drawing card from pile');
      socket.emit('drawCard');
    } else {
      console.log('❌ Cannot draw - not your turn or not connected');
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const sendChatMessage = () => {
    if (socket && chatInput.trim()) {
      socket.emit('sendMessage', { 
        message: chatInput.trim() 
      });
      setChatInput('');
    }
  };

  const handleCardClick = (card) => {
    if (!isMyTurn) return;

    if (card.color === 'wild') {
      setPendingWildCard(card);
      setShowColorPicker(true);
    } else {
      playCard(card.id);
    }
  };

  const handleColorChoice = (color) => {
    if (pendingWildCard) {
      playCard(pendingWildCard.id, color);
      setPendingWildCard(null);
      setShowColorPicker(false);
    }
  };

  // NOTIFICATION FUNCTIONS
  const showWinAnimation = (winner) => {
    const overlay = document.createElement('div');
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.5s ease;
      ">
        <div style="
          text-align: center;
          background: linear-gradient(135deg, #ffd700, #ff6b6b);
          padding: 60px;
          border-radius: 30px;
          color: white;
          font-size: 2.5em;
          font-weight: bold;
          animation: celebration 2s ease;
          box-shadow: 0 30px 100px rgba(0,0,0,0.5);
        ">
          🏆<br>
          ${winner} Wins!<br>
          <span style="font-size: 0.5em; opacity: 0.8;">🎉 Congratulations! 🎉</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 4000);
  };

  const showUnoAlert = (message) => {
    const alert = document.createElement('div');
    alert.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ff4757, #ff3742);
        color: white;
        padding: 30px 50px;
        border-radius: 20px;
        font-size: 1.5em;
        font-weight: bold;
        z-index: 9999;
        animation: unoAlert 3s ease;
        box-shadow: 0 20px 60px rgba(255, 71, 87, 0.5);
      ">
        ${message}
      </div>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => {
      if (document.body.contains(alert)) {
        document.body.removeChild(alert);
      }
    }, 3000);
  };

  // KEYBOARD SUPPORT
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && showColorPicker) {
        setShowColorPicker(false);
        setPendingWildCard(null);
      }
      if (e.key === 'Enter' && showChat && chatInput.trim()) {
        sendChatMessage();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showColorPicker, showChat, chatInput]);

  // FUTURISTIC THEMES
  const themes = {
    dark: {
      background: 'radial-gradient(ellipse at center, #0f0f23 0%, #1a1a2e 45%, #16213e 100%)',
      tableGradient: 'radial-gradient(ellipse at center, #1e3a8a 0%, #1e40af 30%, #1d4ed8 100%)',
      cardBg: 'rgba(15, 23, 42, 0.8)',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      border: 'rgba(148, 163, 184, 0.3)',
      glow: '#3b82f6',
      neon: '#06d6a0',
      accent: '#8b5cf6',
      glass: 'rgba(255, 255, 255, 0.05)',
      hologram: 'linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1), rgba(6, 214, 160, 0.1))'
    },
    light: {
      background: 'radial-gradient(ellipse at center, #f1f5f9 0%, #e2e8f0 45%, #cbd5e1 100%)',
      tableGradient: 'radial-gradient(ellipse at center, #059669 0%, #10b981 30%, #34d399 100%)',
      cardBg: 'rgba(255, 255, 255, 0.9)',
      text: '#1e293b',
      textSecondary: '#475569',
      border: 'rgba(30, 41, 59, 0.2)',
      glow: '#059669',
      neon: '#0891b2',
      accent: '#7c3aed',
      glass: 'rgba(255, 255, 255, 0.3)',
      hologram: 'linear-gradient(45deg, rgba(5, 150, 105, 0.1), rgba(124, 58, 237, 0.1), rgba(8, 145, 178, 0.1))'
    }
  };

  const currentTheme = themes[theme];

  // CARD DESIGN FUNCTIONS
  const getUnoCardDesign = (card) => {
    const cardDesigns = {
      red: {
        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)',
        shadow: '0 8px 32px rgba(220, 38, 38, 0.4)',
        border: '3px solid rgba(255, 255, 255, 0.3)'
      },
      blue: {
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)',
        shadow: '0 8px 32px rgba(37, 99, 235, 0.4)',
        border: '3px solid rgba(255, 255, 255, 0.3)'
      },
      green: {
        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)',
        shadow: '0 8px 32px rgba(22, 163, 74, 0.4)',
        border: '3px solid rgba(255, 255, 255, 0.3)'
      },
      yellow: {
        background: 'linear-gradient(135deg, #facc15 0%, #eab308 50%, #ca8a04 100%)',
        shadow: '0 8px 32px rgba(250, 204, 21, 0.4)',
        border: '3px solid rgba(255, 255, 255, 0.3)',
        color: '#1f2937'
      },
      wild: {
        background: `conic-gradient(from 0deg, #dc2626 0deg 90deg, #2563eb 90deg 180deg, #16a34a 180deg 270deg, #facc15 270deg 360deg)`,
        shadow: '0 8px 32px rgba(139, 92, 246, 0.6)',
        border: '3px solid rgba(255, 255, 255, 0.5)'
      },
      deck: {
        background: 'linear-gradient(135deg, #6c757d 0%, #495057 50%, #343a40 100%)',
        shadow: '0 8px 32px rgba(108, 117, 125, 0.4)',
        border: '3px solid rgba(255, 255, 255, 0.4)'
      }
    };
    
    return cardDesigns[card.color] || cardDesigns.red;
  };

  const getCardDisplayText = (card) => {
    const displays = {
      'skip': '⊘',
      'reverse': '⇄',
      'draw2': '+2',
      'draw4': '+4',
      'wild': 'W'
    };
    return displays[card.value] || card.value.toUpperCase();
  };

  // STYLES
  const styles = {
    app: {
      fontFamily: "'Orbitron', 'Exo 2', 'Inter', futuristic, monospace",
      margin: 0,
      background: currentTheme.background,
      color: currentTheme.text,
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden'
    },
    
    holoBackground: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: currentTheme.hologram,
      opacity: 0.3,
      animation: 'hologram 8s ease-in-out infinite',
      zIndex: -1
    },

    gameTable: {
      position: 'absolute',
      top: '20%',
      left: '10%',
      width: '80%',
      height: '60%',
      background: currentTheme.tableGradient,
      borderRadius: '50%',
      transform: 'perspective(1000px) rotateX(60deg)',
      boxShadow: `
        inset 0 0 100px rgba(0,0,0,0.3),
        0 20px 100px rgba(0,0,0,0.5),
        0 0 60px ${currentTheme.glow}
      `,
      border: `2px solid ${currentTheme.neon}`,
      animation: 'tableGlow 4s ease-in-out infinite alternate'
    },

    container: {
      position: 'relative',
      zIndex: 1,
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto'
    },

    themeToggle: {
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.neon})`,
      border: `2px solid ${currentTheme.border}`,
      borderRadius: '50%',
      width: '70px',
      height: '70px',
      cursor: 'pointer',
      zIndex: 1000,
      backdropFilter: 'blur(20px)',
      fontSize: '2em',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: `0 8px 32px ${currentTheme.accent}40, inset 0 0 20px rgba(255,255,255,0.1)`,
      animation: 'float 3s ease-in-out infinite'
    },

    chatToggle: {
      position: 'fixed',
      top: '30px',
      right: '30px',
      background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.neon})`,
      color: 'white',
      border: `2px solid ${currentTheme.neon}`,
      borderRadius: '20px',
      padding: '15px 20px',
      cursor: 'pointer',
      zIndex: 1000,
      fontSize: '1.1em',
      fontWeight: '600',
      transition: 'all 0.3s ease',
      boxShadow: `0 8px 32px ${currentTheme.accent}40`,
      backdropFilter: 'blur(20px)',
      textShadow: '0 0 10px rgba(255,255,255,0.5)'
    },

    lobby: {
      textAlign: 'center',
      padding: '80px 60px',
      background: `${currentTheme.cardBg} ${currentTheme.hologram}`,
      borderRadius: '30px',
      marginTop: '100px',
      backdropFilter: 'blur(30px)',
      border: `2px solid ${currentTheme.neon}`,
      boxShadow: `
        0 30px 100px rgba(0,0,0,0.3),
        inset 0 0 60px rgba(255,255,255,0.05),
        0 0 60px ${currentTheme.glow}30
      `
    },

    title: {
      fontSize: '6em',
      fontWeight: '900',
      marginBottom: '20px',
      background: `linear-gradient(135deg, ${currentTheme.neon}, ${currentTheme.accent}, ${currentTheme.glow})`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      letterSpacing: '-3px',
      textShadow: `0 0 30px ${currentTheme.glow}`,
      animation: 'titleGlow 3s ease-in-out infinite alternate'
    },

    card: {
      width: '160px',
      height: '240px',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '2.5em',
      fontWeight: 'bold',
      color: 'white',
      cursor: 'pointer',
      position: 'relative',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      transformStyle: 'preserve-3d',
      overflow: 'hidden'
    },

    cardCorner: {
      position: 'absolute',
      top: '8px',
      left: '8px',
      fontSize: '0.6em',
      fontWeight: 'bold',
      background: 'rgba(255,255,255,0.9)',
      color: '#000',
      width: '24px',
      height: '32px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },

    cardCornerBottom: {
      position: 'absolute',
      bottom: '8px',
      right: '8px',
      fontSize: '0.6em',
      fontWeight: 'bold',
      background: 'rgba(255,255,255,0.9)',
      color: '#000',
      width: '24px',
      height: '32px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: 'rotate(180deg)'
    },

    cardCenter: {
      fontSize: '0.4em',
      fontWeight: 'bold',
      textAlign: 'center',
      background: 'rgba(255,255,255,0.9)',
      color: '#000',
      padding: '8px',
      borderRadius: '8px',
      marginTop: '10px'
    },

    handCard: {
      width: '110px',
      height: '165px',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      color: 'white',
      cursor: 'pointer',
      minWidth: '110px',
      fontSize: '1.5em',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      transformStyle: 'preserve-3d'
    },

    playerHand: {
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '15px',
      padding: '30px',
      background: `${currentTheme.glass} ${currentTheme.hologram}`,
      borderRadius: '30px',
      maxWidth: '95vw',
      overflowX: 'auto',
      backdropFilter: 'blur(30px)',
      border: `2px solid ${currentTheme.neon}`,
      boxShadow: `
        0 20px 60px rgba(0,0,0,0.3),
        inset 0 0 40px rgba(255,255,255,0.05),
        0 0 40px ${currentTheme.glow}30
      `,
      zIndex: 100
    },

    centerArea: {
      display: 'flex',
      gap: '80px',
      justifyContent: 'center',
      alignItems: 'center',
      margin: '60px 0',
      position: 'relative',
      zIndex: 2
    },

    gameBoard: {
      textAlign: 'center',
      padding: '40px',
      minHeight: '100vh',
      position: 'relative'
    },

    gameHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '30px',
      background: `${currentTheme.cardBg} ${currentTheme.hologram}`,
      borderRadius: '25px',
      marginBottom: '40px',
      backdropFilter: 'blur(30px)',
      border: `2px solid ${currentTheme.neon}`,
      boxShadow: `
        0 20px 60px rgba(0,0,0,0.2),
        inset 0 0 40px rgba(255,255,255,0.05),
        0 0 40px ${currentTheme.glow}20
      `
    },

    players: {
      display: 'flex',
      gap: '25px',
      flexWrap: 'wrap'
    },

    player: {
      padding: '25px 30px',
      background: `${currentTheme.glass} ${currentTheme.hologram}`,
      borderRadius: '20px',
      border: `2px solid ${currentTheme.border}`,
      backdropFilter: 'blur(20px)',
      transition: 'all 0.3s ease',
      minWidth: '160px'
    },

    currentPlayer: {
      background: `linear-gradient(135deg, ${currentTheme.neon}, ${currentTheme.accent})`,
      color: 'white',
      border: `2px solid ${currentTheme.neon}`,
      boxShadow: `
        0 15px 40px ${currentTheme.neon}40,
        inset 0 0 30px rgba(255,255,255,0.1)
      `,
      transform: 'scale(1.05)',
      animation: 'currentPlayerGlow 2s ease-in-out infinite alternate'
    },

    turnIndicator: {
      fontSize: '2.2em',
      fontWeight: '700',
      margin: '40px 0',
      padding: '30px',
      background: `${currentTheme.cardBg} ${currentTheme.hologram}`,
      borderRadius: '25px',
      backdropFilter: 'blur(30px)',
      border: `2px solid ${currentTheme.border}`,
      boxShadow: `0 20px 60px rgba(0,0,0,0.2)`,
      transition: 'all 0.3s ease'
    },

    myTurn: {
      background: `linear-gradient(135deg, ${currentTheme.neon}, ${currentTheme.accent})`,
      color: 'white',
      border: `2px solid ${currentTheme.neon}`,
      boxShadow: `
        0 20px 60px ${currentTheme.neon}40,
        inset 0 0 40px rgba(255,255,255,0.1)
      `,
      animation: 'myTurnPulse 2s ease-in-out infinite'
    },

    chatContainer: {
      position: 'fixed',
      top: '30px',
      right: showChat ? '30px' : '-380px',
      width: '350px',
      height: '550px',
      background: `${currentTheme.cardBg} ${currentTheme.hologram}`,
      borderRadius: '25px',
      border: `2px solid ${currentTheme.neon}`,
      backdropFilter: 'blur(30px)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 999,
      transition: 'right 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: `
        0 30px 100px rgba(0,0,0,0.4),
        inset 0 0 60px rgba(255,255,255,0.05),
        0 0 60px ${currentTheme.glow}30
      `
    },

    colorPicker: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: `${currentTheme.cardBg} ${currentTheme.hologram}`,
      padding: '50px',
      borderRadius: '30px',
      border: `2px solid ${currentTheme.neon}`,
      backdropFilter: 'blur(40px)',
      zIndex: 2000,
      textAlign: 'center',
      boxShadow: `
        0 50px 150px rgba(0,0,0,0.5),
        inset 0 0 80px rgba(255,255,255,0.05),
        0 0 80px ${currentTheme.glow}40
      `
    },

    colorOption: {
      width: '90px',
      height: '90px',
      borderRadius: '50%',
      cursor: 'pointer',
      margin: '15px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.5em',
      fontWeight: 'bold',
      color: 'white',
      border: '4px solid rgba(255, 255, 255, 0.3)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
      flexDirection: 'column'
    },

    input: {
      padding: '20px 28px',
      fontSize: '1.3em',
      border: `2px solid ${currentTheme.border}`,
      borderRadius: '20px',
      margin: '12px',
      width: '320px',
      background: `${currentTheme.glass} ${currentTheme.hologram}`,
      color: currentTheme.text,
      backdropFilter: 'blur(20px)',
      transition: 'all 0.3s ease',
      outline: 'none',
      fontFamily: 'inherit'
    },

    button: {
      padding: '20px 40px',
      fontSize: '1.3em',
      border: 'none',
      borderRadius: '20px',
      margin: '12px',
      cursor: 'pointer',
      background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.neon})`,
      color: 'white',
      fontWeight: '700',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: `
        0 15px 40px ${currentTheme.accent}40,
        inset 0 0 20px rgba(255,255,255,0.1)
      `,
      transform: 'translateY(0)',
      fontFamily: 'inherit',
      textShadow: '0 0 10px rgba(255,255,255,0.3)'
    },

    connectionStatus: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '15px',
      marginBottom: '30px',
      fontSize: '1.2em',
      fontWeight: '600'
    },

    statusDot: {
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      background: connected ? currentTheme.neon : '#ef4444',
      boxShadow: `0 0 20px ${connected ? currentTheme.neon : '#ef4444'}`,
      animation: connected ? 'connected 2s ease-in-out infinite' : 'disconnected 1s ease-in-out infinite'
    }
  };

  // RENDER UNO CARD
  const renderUnoCard = (card, isHand = false) => {
    const design = getUnoCardDesign(card);
    const displayText = getCardDisplayText(card);
    const cardStyle = isHand ? styles.handCard : styles.card;
    
    return (
      <div
        key={card.id}
        style={{
          ...cardStyle,
          background: design.background,
          boxShadow: design.shadow,
          border: design.border,
          color: design.color || 'white',
          cursor: card.color === 'deck' && isMyTurn ? 'pointer' : (isHand && isMyTurn ? 'pointer' : 'default'),
          opacity: card.color === 'deck' && !isMyTurn ? 0.7 : 1
        }}
        className={isHand ? "hand-card" : "card-3d"}
        onClick={() => {
          if (card.color === 'deck') {
            drawCard();
          } else if (isHand) {
            handleCardClick(card);
          }
        }}
      >
        {/* Card back pattern for deck */}
        {card.color === 'deck' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: `
              repeating-linear-gradient(
                45deg,
                rgba(255,255,255,0.1) 0px,
                rgba(255,255,255,0.1) 10px,
                transparent 10px,
                transparent 20px
              )
            `,
            opacity: 0.3
          }} />
        )}

        {/* Top-left corner */}
        {card.color !== 'deck' && (
          <div style={styles.cardCorner}>
            {displayText}
          </div>
        )}
        
        {/* Center display */}
        <div style={{ 
          fontSize: card.color === 'deck' ? '1.5em' : '1em', 
          textAlign: 'center',
          zIndex: 1,
          position: 'relative'
        }}>
          {card.color === 'deck' ? '🃏' : displayText}
        </div>
        
        {/* UNO text for deck */}
        {card.color === 'deck' && (
          <div style={{
            fontSize: '0.8em',
            fontWeight: 'bold',
            marginTop: '10px',
            opacity: 0.8,
            zIndex: 1,
            position: 'relative'
          }}>
            UNO
          </div>
        )}

        {/* Special styling for Draw 4 */}
        {card.value === 'draw4' && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '0.6em',
            fontWeight: 'bold',
            background: 'rgba(255,255,255,0.9)',
            color: '#000',
            padding: '4px 8px',
            borderRadius: '8px'
          }}>
            WILD DRAW 4
          </div>
        )}
        
        {/* UNO logo for special cards */}
        {(card.value === 'skip' || card.value === 'reverse' || card.value === 'draw2' || card.value === 'wild') && (
          <div style={styles.cardCenter}>
            UNO
          </div>
        )}
        
        {/* Bottom-right corner */}
        {card.color !== 'deck' && (
          <div style={styles.cardCornerBottom}>
            {displayText}
          </div>
        )}
        
        {/* Holographic overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
          opacity: 0.6,
          pointerEvents: 'none'
        }} />
      </div>
    );
  };

  // CSS ANIMATIONS
  const cssAnimations = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600;700&display=swap');
    
    @keyframes hologram {
      0%, 100% { transform: translateX(-5px) translateY(-2px); opacity: 0.3; }
      25% { transform: translateX(5px) translateY(2px); opacity: 0.4; }
      50% { transform: translateX(-3px) translateY(3px); opacity: 0.2; }
      75% { transform: translateX(3px) translateY(-1px); opacity: 0.35; }
    }
    
    @keyframes tableGlow {
      0% { box-shadow: inset 0 0 100px rgba(0,0,0,0.3), 0 20px 100px rgba(0,0,0,0.5), 0 0 60px ${currentTheme.glow}60; }
      100% { box-shadow: inset 0 0 100px rgba(0,0,0,0.3), 0 20px 100px rgba(0,0,0,0.5), 0 0 60px ${currentTheme.neon}80; }
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes titleGlow {
      0% { text-shadow: 0 0 30px ${currentTheme.glow}; }
      100% { text-shadow: 0 0 50px ${currentTheme.neon}, 0 0 70px ${currentTheme.accent}; }
    }
    
    @keyframes currentPlayerGlow {
      0% { box-shadow: 0 15px 40px ${currentTheme.neon}40, inset 0 0 30px rgba(255,255,255,0.1); }
      100% { box-shadow: 0 20px 60px ${currentTheme.neon}60, inset 0 0 40px rgba(255,255,255,0.2); }
    }
    
    @keyframes myTurnPulse {
      0%, 100% { box-shadow: 0 20px 60px ${currentTheme.neon}40, inset 0 0 40px rgba(255,255,255,0.1); }
      50% { box-shadow: 0 30px 80px ${currentTheme.neon}70, inset 0 0 60px rgba(255,255,255,0.2); }
    }
    
    @keyframes connected {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }
    
    @keyframes disconnected {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(0.8); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
    
    @keyframes celebration {
      0% { transform: scale(0.5) rotate(-10deg); }
      50% { transform: scale(1.1) rotate(10deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
    
    @keyframes unoAlert {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
      10% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
      90% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.05); }
    }
    
    .card-3d:hover {
      transform: rotateY(15deg) rotateX(5deg) translateZ(30px) !important;
      box-shadow: 0 25px 80px rgba(0,0,0,0.4) !important;
    }
    
    .hand-card:hover {
      transform: translateY(-25px) rotateY(10deg) rotateZ(5deg) scale(1.15) !important;
      z-index: 10 !important;
      box-shadow: 0 30px 80px rgba(0,0,0,0.4) !important;
    }
    
    .button:hover {
      transform: translateY(-5px) scale(1.05) !important;
      box-shadow: 0 20px 60px ${currentTheme.accent}60, inset 0 0 30px rgba(255,255,255,0.2) !important;
    }
    
    .theme-toggle:hover {
      transform: scale(1.2) rotateY(180deg) !important;
      box-shadow: 0 15px 50px ${currentTheme.accent}60, inset 0 0 30px rgba(255,255,255,0.2) !important;
    }
    
    .input:focus {
      border-color: ${currentTheme.neon} !important;
      box-shadow: 0 0 30px ${currentTheme.neon}40 !important;
    }
  `;

  // Insert CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = cssAnimations;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [theme]);

  console.log('=== DEBUG INFO ===');
  console.log('Game State:', gameState);
  console.log('Connected:', connected);
  console.log('My Cards:', myCards);
  console.log('Is My Turn:', isMyTurn);
  console.log('Draw Stack:', gameData?.drawStack);
  console.log('==================');

  if (gameState === 'lobby') {
    return (
      <div style={styles.app}>
        <div style={styles.holoBackground} />
        
        <div 
          style={styles.themeToggle} 
          className="theme-toggle"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? '🌞' : '🌙'}
        </div>
        
        <div style={styles.container}>
          <div style={styles.lobby}>
            <h1 style={styles.title}>🃏 UNO</h1>
            <p style={{fontSize: '1.8em', marginBottom: '40px', color: currentTheme.textSecondary}}>
              Futuristic Multiplayer Card Experience
            </p>
            
            <div style={styles.connectionStatus}>
              <div style={styles.statusDot}></div>
              {connected ? 'Connected to server' : 'Connecting to server...'}
            </div>

            <div>
              <input 
                style={styles.input}
                className="input"
                type="text" 
                placeholder="Enter your name..." 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
              {mode === 'join' && (
                <input 
                  style={styles.input}
                  className="input"
                  type="text" 
                  placeholder="Room ID..." 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              )}
            </div>
            
            <div>
              <button 
                style={styles.button}
                className="button"
                onClick={() => {
                  setMode('create');
                  if (playerName.trim()) createRoom();
                }}
                disabled={!playerName.trim() || !connected}
              >
                ➕ Create Room
              </button>
              <button 
                style={styles.button}
                className="button"
                onClick={() => {
                  if (mode === 'join') {
                    if (playerName.trim() && roomId.trim()) joinRoom();
                  } else {
                    setMode('join');
                  }
                }}
              >
                🚪 {mode === 'join' ? 'Join Room' : 'Join Existing'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div style={styles.app}>
        <div style={styles.holoBackground} />
        
        <div 
          style={styles.themeToggle} 
          className="theme-toggle"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? '🌞' : '🌙'}
        </div>
        
        <div style={styles.container}>
          <div style={styles.lobby}>
            <h1 style={{...styles.title, fontSize: '4em'}}>🏠 Room: {room?.id}</h1>
            <p style={{fontSize: '1.5em', marginBottom: '40px', color: currentTheme.textSecondary}}>
              Share this room ID with your friends!
            </p>
            
            <div style={{ marginBottom: '50px' }}>
              <h3 style={{ marginBottom: '30px', fontSize: '1.8em', color: currentTheme.neon }}>
                Players ({room?.players?.length || 0}/4):
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
                {room?.players?.map((roomPlayer, index) => (
                  <div key={index} style={{
                    ...styles.player,
                    ...(roomPlayer.id === player?.id ? {
                      background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.neon})`,
                      color: 'white',
                      boxShadow: `0 15px 40px ${currentTheme.accent}40`
                    } : {})
                  }}>
                    <div style={{ fontWeight: '700', fontSize: '1.3em' }}>
                      {roomPlayer.name}
                    </div>
                    {roomPlayer.id === player?.id && (
                      <div style={{ fontSize: '0.9em', opacity: 0.8, marginTop: '5px' }}>
                        (You)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              fontSize: '1.5em', 
              fontWeight: '600',
              padding: '25px',
              background: `${currentTheme.glass} ${currentTheme.hologram}`,
              borderRadius: '20px',
              border: `2px solid ${currentTheme.border}`,
              backdropFilter: 'blur(20px)'
            }}>
              {room?.players?.length < 2 ? 
                `⏳ Waiting for more players... (${room?.players?.length}/4)` :
                '⚡ Game starting soon! Prepare for battle!'
              }
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div style={styles.app}>
        <div style={styles.holoBackground} />
        <div style={styles.gameTable} />
        
        {/* Theme Toggle */}
        <div 
          style={styles.themeToggle} 
          className="theme-toggle"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? '🌞' : '🌙'}
        </div>

        {/* Chat Toggle */}
        <button 
          style={styles.chatToggle}
          onClick={() => setShowChat(!showChat)}
        >
         💬 Chat
        </button>

        {/* Chat Container */}
        <div style={styles.chatContainer}>
          <div style={{ 
            padding: '20px', 
            borderBottom: `3px solid ${currentTheme.border}`, 
            fontWeight: '700', 
            fontSize: '1.3em',
            color: currentTheme.neon,
            textAlign: 'center'
          }}>
            💬 Chat
          </div>
          <div style={{ 
            flex: 1, 
            padding: '20px', 
            overflowY: 'auto', 
            fontSize: '0.95em' 
          }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', opacity: 0.6, padding: '30px' }}>
                No messages yet.<br/>Start chatting!
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div key={index} style={{
                  marginBottom: '15px',
                  padding: '12px 15px',
                  background: msg.type === 'system' 
                    ? `${currentTheme.accent}40` 
                    : `${currentTheme.glass} ${currentTheme.hologram}`,
                  borderRadius: '15px',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${currentTheme.border}`
                }}>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.9em', 
                    marginBottom: '5px', 
                    color: msg.type === 'system' ? currentTheme.accent : currentTheme.neon 
                  }}>
                    {msg.player}
                  </div>
                  <div style={{ fontSize: '0.85em' }}>{msg.message}</div>
                  <div style={{ fontSize: '0.7em', opacity: 0.7, marginTop: '5px' }}>
                    {msg.timestamp}
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ 
            display: 'flex', 
            padding: '20px', 
            gap: '12px', 
            borderTop: `2px solid ${currentTheme.border}` 
          }}>
            <input 
              style={{
                flex: 1,
                padding: '12px 15px',
                border: `1px solid ${currentTheme.border}`,
                borderRadius: '15px',
                background: `${currentTheme.glass}`,
                color: currentTheme.text,
                fontSize: '0.9em',
                backdropFilter: 'blur(10px)'
              }}
              type="text"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              maxLength={100}
            />
            <button 
              style={{
                padding: '12px 18px',
                border: 'none',
                borderRadius: '15px',
                background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.neon})`,
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.1em',
                fontWeight: '600'
              }}
              onClick={sendChatMessage}
            >
              ➤
            </button>
          </div>
        </div>

        <div style={styles.container}>
          <div style={styles.gameBoard}>
            {/* Game Header */}
            <div style={styles.gameHeader}>
              <div style={styles.players}>
                {gameData?.players?.map((playerData, index) => (
                  <div 
                    key={index} 
                    style={{
                      ...styles.player,
                      ...(playerData.isCurrentPlayer ? styles.currentPlayer : {})
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '1.2em' }}>
                      {playerData.name}
                    </div>
                    <div style={{ fontSize: '1em', opacity: 0.9, marginTop: '5px' }}>
                      🃏 {playerData.cardCount} cards
                    </div>
                    {playerData.hasCalledUno && (
                      <div style={{ fontSize: '0.9em', marginTop: '5px', color: currentTheme.neon }}>
                        🚨 UNO!
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '1.3em', fontWeight: '600', color: currentTheme.neon }}>
                Room: {gameData?.roomId}
              </div>
            </div>

            {/* Game Center */}
            <div style={styles.centerArea}>
              <div style={{ textAlign: 'center' }}>
                {renderUnoCard({
                  id: 'deck',
                  color: 'deck',
                  value: 'deck'
                })}
                <div style={{ 
                  marginTop: '20px', 
                  fontSize: '1.4em', 
                  fontWeight: '700',
                  color: currentTheme.neon,
                  textShadow: `0 0 10px ${currentTheme.neon}`
                }}>
                  Draw Pile ({gameData?.deckSize || 0})
                  {gameData?.drawStack > 0 && (
                    <div style={{ 
                      fontSize: '0.8em', 
                      color: '#ef4444',
                      marginTop: '5px',
                      textShadow: '0 0 10px #ef4444',
                      animation: 'pulse 1s infinite'
                    }}>
                      ⚡ +{gameData.drawStack} penalty
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                {gameData?.topCard && renderUnoCard(gameData.topCard)}
                <div style={{ 
                  marginTop: '20px', 
                  fontSize: '1.4em', 
                  fontWeight: '700',
                  color: currentTheme.neon,
                  textShadow: `0 0 10px ${currentTheme.neon}`
                }}>
                  Current Color
                  <div style={{ 
                    fontSize: '0.9em', 
                    marginTop: '5px',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}>
                    {gameData?.currentColor || 'Unknown'}
                  </div>
                </div>
              </div>
            </div>

            {/* Turn Indicator */}
            <div style={{
              ...styles.turnIndicator,
              ...(isMyTurn ? styles.myTurn : {})
            }}>
              {isMyTurn ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '20px',
                  textShadow: '0 0 20px rgba(255,255,255,0.8)'
                }}>
                  ⚡ YOUR TURN! ⚡
                </div>
              ) : (
                <div style={{ 
                  opacity: 0.8,
                  textShadow: `0 0 10px ${currentTheme.glow}`
                }}>
                  ⏳ Waiting for {gameData?.currentPlayerName || 'player'}...
                </div>
              )}
              
              {gameData?.direction && (
                <div style={{ 
                  fontSize: '0.6em', 
                  marginTop: '10px', 
                  opacity: 0.7 
                }}>
                  Direction: {gameData.direction === 1 ? '↻ Clockwise' : '↺ Counter-clockwise'}
                </div>
              )}
            </div>
          </div>

          {/* Player Hand */}
          <div style={styles.playerHand}>
            {myCards.length > 0 ? (
              myCards.map((card) => renderUnoCard(card, true))
            ) : (
              <div style={{ 
                padding: '40px', 
                opacity: 0.7, 
                fontSize: '1.2em',
                background: `${currentTheme.glass} ${currentTheme.hologram}`,
                borderRadius: '20px',
                border: `2px solid ${currentTheme.border}`,
                backdropFilter: 'blur(20px)',
                color: currentTheme.textSecondary
              }}>
                🎴 No cards in hand...
              </div>
            )}
          </div>
        </div>

        {/* Color Picker Modal */}
        {showColorPicker && (
          <>
            {/* Background overlay */}
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.7)',
              zIndex: 1999
            }} onClick={() => setShowColorPicker(false)} />
            
            <div style={styles.colorPicker}>
              <h3 style={{ 
                marginBottom: '30px', 
                fontSize: '2.2em',
                color: currentTheme.neon,
                textShadow: `0 0 20px ${currentTheme.neon}`
              }}>
                🌈 Choose Color for Wild Card
              </h3>
              <div style={{ marginBottom: '20px', opacity: 0.8 }}>
                Playing: {pendingWildCard?.value === 'draw4' ? 'Wild Draw 4' : 'Wild Card'}
              </div>
              <div>
                {[
                  {name: 'red', color: '#dc2626', emoji: '❤️'},
                  {name: 'blue', color: '#2563eb', emoji: '💙'},
                  {name: 'green', color: '#16a34a', emoji: '💚'},
                  {name: 'yellow', color: '#facc15', emoji: '💛'}
                ].map((colorObj) => (
                  <div
                    key={colorObj.name}
                    style={{
                      ...styles.colorOption,
                      background: `linear-gradient(135deg, ${colorObj.color}, ${colorObj.color}dd)`
                    }}
                    onClick={() => handleColorChoice(colorObj.name)}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.3)';
                      e.target.style.boxShadow = `0 15px 50px ${colorObj.color}60`;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
                    }}
                  >
                    <div style={{ fontSize: '1.2em' }}>
                      {colorObj.emoji}
                    </div>
                    <div style={{ fontSize: '0.7em', marginTop: '5px' }}>
                      {colorObj.name.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ 
                marginTop: '20px', 
                fontSize: '0.9em', 
                opacity: 0.7 
              }}>
                Click a color or press Esc to cancel
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.holoBackground} />
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <h2 style={{ 
            fontSize: '3em', 
            marginBottom: '30px',
            color: currentTheme.neon,
            textShadow: `0 0 30px ${currentTheme.neon}`
          }}>
            🎮 Loading Futuristic UNO...
          </h2>
          <p style={{ fontSize: '1.3em', opacity: 0.8 }}>
            Initializing holographic gaming environment...
          </p>
          <div style={{ 
            marginTop: '40px',
            padding: '30px',
            background: `${currentTheme.glass} ${currentTheme.hologram}`,
            borderRadius: '20px',
            backdropFilter: 'blur(20px)',
            border: `2px solid ${currentTheme.border}`
          }}>
            Current state: {gameState}
          </div>
        </div>
      </div>
    </div>
    
  );
  
}


export default App;
