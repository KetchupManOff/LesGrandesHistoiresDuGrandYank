const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Load stories
const storiesPath = path.join(__dirname, 'stories.json');
const defaultStoriesPath = path.join(__dirname, 'stories.default.json');

// Initialize stories.json from stories.default.json if missing
if (!fs.existsSync(storiesPath)) {
  try {
    if (fs.existsSync(defaultStoriesPath)) {
      fs.copyFileSync(defaultStoriesPath, storiesPath);
      console.log("stories.json initialized from stories.default.json");
    } else {
      fs.writeFileSync(storiesPath, JSON.stringify([], null, 2), 'utf8');
    }
  } catch (err) {
    console.error("Error copying default stories:", err);
  }
}

let stories = [];
try {
  const data = fs.readFileSync(storiesPath, 'utf8');
  stories = JSON.parse(data);
} catch (err) {
  console.error("Error reading stories.json:", err);
}

// State
let currentStory = null;
let currentLineIndex = -1;
const MASTER_PASSWORD = "Yank"; // Mot de passe par défaut

app.post('/api/login', (req, res) => {
  if (req.body.password === MASTER_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/save', (req, res) => {
  const { newStories } = req.body;
  // TODO: Secure this endpoint with a token if needed, but keeping it simple
  try {
    fs.writeFileSync(path.join(__dirname, 'stories.json'), JSON.stringify(newStories, null, 2), 'utf8');
    stories = newStories;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to save" });
  }
});

app.get('/api/stories', (req, res) => {
  res.json(stories);
});

app.get('/api/state', (req, res) => {
  res.json({
    currentStory,
    currentLineIndex
  });
});

app.post('/api/start', (req, res) => {
  const { storyId } = req.body;
  const story = stories.find(s => s.id === storyId);
  if (story) {
    currentStory = story;
    currentLineIndex = -1;
    io.emit('story_update', { story: currentStory, lineIndex: currentLineIndex });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Story not found" });
  }
});

app.post('/api/next', (req, res) => {
  if (currentStory && currentLineIndex < currentStory.lines.length - 1) {
    currentLineIndex++;
    io.emit('story_update', { story: currentStory, lineIndex: currentLineIndex });
    res.json({ success: true, lineIndex: currentLineIndex });
  } else {
    res.json({ success: false, message: "End of story or no active story" });
  }
});

app.post('/api/prev', (req, res) => {
  if (currentStory && currentLineIndex >= 0) {
    currentLineIndex--;
    io.emit('story_update', { story: currentStory, lineIndex: currentLineIndex });
    res.json({ success: true, lineIndex: currentLineIndex });
  } else {
    res.json({ success: false });
  }
});

io.on('connection', (socket) => {
  console.log('User connected');
  // Send current state to new connections
  socket.emit('story_update', { story: currentStory, lineIndex: currentLineIndex });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});