const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Enable CORS for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Load game data from book.json
let gameData = [];
try {
  const bookData = fs.readFileSync(path.join(__dirname, 'book-mm.json'), 'utf8');
  gameData = bookData.trim().split('\n').map(line => JSON.parse(line));
  console.log(`Loaded ${gameData.length} game rounds from book.json`);
} catch (err) {
  console.error('Error loading book.json:', err.message);
}

// Session storage for persistent balances
const sessions = new Map();

// Get all game rounds
app.get('/games', (req, res) => {
  res.json({
    totalRounds: gameData.length,
    games: gameData
  });
});

// Get a specific game round by ID
app.get('/games/:id', (req, res) => {
  const gameId = parseInt(req.params.id);
  const game = gameData.find(g => g.id === gameId);
  
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json(game);
});

// Get random game round
app.get('/games/random', (req, res) => {
  if (gameData.length === 0) {
    return res.status(404).json({ error: 'No game data available' });
  }
  
  const randomGame = gameData[Math.floor(Math.random() * gameData.length)];
  res.json(randomGame);
});

// Wallet authenticate endpoint
app.post('/wallet/authenticate', (req, res) => {
  // Generate a random session ID
  const sessionID = "valid_session_123"
  // Initialize session with starting balance
  sessions.set(sessionID, {
    balance: 10000000000,
    currency: "USD",
    events: []
  });
  
  res.json({
    sessionID: sessionID,
    balance: {
      amount: 1000000000000,
      currency: "USD"
    }
  });
});

// Wallet balance endpoint
app.post('/wallet/balance', (req, res) => {
  const { sessionID } = req.body;
  
  if (!sessionID) {
    return res.status(400).json({ error: 'sessionID is required' });
  }
  
  const session = sessions.get(sessionID);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  res.json({
    balance: {
      amount: session.balance,
      currency: session.currency
    }
  });
});

// Wallet end round endpoint
app.post('/wallet/end-round', (req, res) => {
  const { sessionID } = req.body;
  
  if (!sessionID) {
    return res.status(400).json({ error: 'sessionID is required' });
  }
  
  const session = sessions.get(sessionID);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  res.json({
    balance: {
      amount: session.balance,
      currency: session.currency
    }
  });
});

// Bet event endpoint
app.post('/bet/event', (req, res) => {
  const { sessionID, event } = req.body;
  
  if (!sessionID) {
    return res.status(400).json({ error: 'sessionID is required' });
  }
  
  if (!event) {
    return res.status(400).json({ error: 'event is required' });
  }
  
  const session = sessions.get(sessionID);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  // Store the event in the session with timestamp
  session.events.push({
    event: event,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    event: event
  });
});

// Simulate playing a round (returns random game data)
app.post('/wallet/play', (req, res) => {
  const { amount, mode } = req.body;
  let sessionID = req.body.sessionID;

  if (!sessionID) {
    return res.status(400).json({ error: 'sessionID is required' });
  }

  const session = sessions.get(sessionID);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  if (amount > session.balance) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Deduct bet amount from balance
  session.balance -= amount;

  if (gameData.length === 0) {
    return res.status(404).json({ error: 'No game data available' });
  }
  
  // Get random game round
  const randomGame = gameData[Math.floor(Math.random() * gameData.length)];
  
  res.json({
    balance: {
      amount: session.balance,
      currency: "USD"
    },
    config: {
      minBet: 100000,
      maxBet: 1000000000,
      stepBet: 100000,
      defaultBetLevel: 1000000,
      betLevels: [100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000],
      jurisdiction: {
        socialCasino: false,
        disabledFullscreen: false,
        disabledTurbo: false,
        disabledAutoplay: false,
        disabledFastSpin: false
      }
    },
    round: {
      state: randomGame.events,
      ...randomGame
    }
  });
});

// Get games by payout range
app.get('/games/payout/:min/:max', (req, res) => {
  const minPayout = parseFloat(req.params.min);
  const maxPayout = parseFloat(req.params.max);
  
  const filteredGames = gameData.filter(game => 
    game.payoutMultiplier >= minPayout && game.payoutMultiplier <= maxPayout
  );
  
  res.json({
    criteria: `Payout between ${minPayout} and ${maxPayout}`,
    count: filteredGames.length,
    games: filteredGames
  });
});

// Get games by criteria (basegame, freegame, etc.)
app.get('/games/criteria/:criteria', (req, res) => {
  const criteria = req.params.criteria;
  
  const filteredGames = gameData.filter(game => 
    game.criteria === criteria || game.criteria.includes(criteria)
  );
  
  res.json({
    criteria: criteria,
    count: filteredGames.length,
    games: filteredGames
  });
});

// Get summary statistics
app.get('/stats', (req, res) => {
  if (gameData.length === 0) {
    return res.json({ error: 'No game data available' });
  }
  
  const totalGames = gameData.length;
  const totalPayout = gameData.reduce((sum, game) => sum + game.payoutMultiplier, 0);
  const avgPayout = totalPayout / totalGames;
  const maxPayout = Math.max(...gameData.map(g => g.payoutMultiplier));
  const minPayout = Math.min(...gameData.map(g => g.payoutMultiplier));
  
  const criteriaCount = gameData.reduce((acc, game) => {
    acc[game.criteria] = (acc[game.criteria] || 0) + 1;
    return acc;
  }, {});
  
  res.json({
    totalGames,
    avgPayout: Math.round(avgPayout * 100) / 100,
    maxPayout,
    minPayout,
    totalPayout,
    criteriaBreakdown: criteriaCount
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Game API server running on port ${PORT}`);
  console.log('CORS enabled for all origins');
  console.log('Available endpoints:');
  console.log('  GET  /games - Get all game rounds');
  console.log('  GET  /games/:id - Get specific game by ID');
  console.log('  GET  /games/random - Get random game round');
  console.log('  POST /wallet/authenticate - Authenticate and get session ID');
  console.log('  POST /wallet/balance - Get wallet balance');
  console.log('  POST /wallet/end-round - End round and get balance');
  console.log('  POST /bet/event - Send betting event');
  console.log('  POST /wallet/play - Simulate playing (returns random game)');
  console.log('  GET  /games/payout/:min/:max - Filter by payout range');
  console.log('  GET  /games/criteria/:criteria - Filter by criteria');
  console.log('  GET  /stats - Get summary statistics');
});
