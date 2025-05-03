const express = require('express');
const session = require('express-session');
const req = require('express/lib/request');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://KingJunco:dodogama@king-junco.glav4m3.mongodb.net/?retryWrites=true&w=majority&appName=King-Junco";
let client;
let db;

// Session middleware
app.use(session({
  secret: 'monster-hunter-secret',
  resave: false,
  saveUninitialized: true,
}));

app.use(express.urlencoded({ extended: true }));

// MongoDB connection
async function getDb() {
  if (!client || !client.topology?.isConnected()) {
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db('Database');
    console.log('Connected to MongoDB');
  }
  return db;
}

// Home/Login/Register form
app.get('/', (req, res) => {
  const username = req.session.username;
  res.send(`
    <h2>${username ? `Welcome, ${username}` : 'Login or Register'}</h2>
    ${username ? `
      <a href="/new-topic">Create a New Topic</a><br/>
      <a href="/topics">View All Topics</a><br/>
      <a href="/logout">Logout</a>
    ` : `
      <form action="/" method="post">
        <input name="username" placeholder="Username" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit" name="action" value="register">Register</button>
        <button type="submit" name="action" value="login">Login</button>
      </form>
    `}
  `);
});

// Handle login/register
app.post('/', async (req, res) => {
  const db = await getDb();
  const users = db.collection('Users');
  const { username, password, action } = req.body;

  if (action === 'register') {
    const existing = await users.findOne({ username });
    if (existing) {
      return res.send('Username already exists. <a href="/">Try again</a>.');
    }

    await users.insertOne({ username, password, subscribedTopics: [] });
    res.send('Registration successful. <a href="/">Login now</a>.');
  } else if (action === 'login') {
    const user = await users.findOne({ username, password });
    if (!user) {
      return res.send('Invalid credentials. <a href="/">Try again</a>.');
    }

    req.session.username = username; // Save username in session
    res.redirect('/');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Topic creation form — only accessible if logged in
app.get('/new-topic', (req, res) => {
  if (!req.session.username) {
    return res.send('You must be logged in to create a topic. <a href="/">Login</a>');
  }

  res.send(`
    <h2>Create New Topic</h2>
    <form action="/new-topic" method="post">
      <input name="topic" placeholder="New Topic Name" required />
      <button type="submit">Create Topic</button>
    </form>
    <a href="/">Back to Home</a>
  `);
});

// Handle topic creation + auto-subscribe
app.post('/new-topic', async (req, res) => {
  if (!req.session.username) {
    return res.send('Unauthorized. <a href="/">Login</a>');
  }

  const db = await getDb();
  const topics = db.collection('Message_board');
  const users = db.collection('Users');

  const username = req.session.username;
  const { topic } = req.body;

  const topicExists = await topics.findOne({ name: topic });
  if (topicExists) {
    return res.send('Topic already exists. <a href="/new-topic">Try another</a>.');
  }

  await topics.insertOne({ name: topic, createdAt: new Date() });

  await users.updateOne(
    { username },
    { $addToSet: { subscribedTopics: topic } }
  );

  res.send(`Topic "${topic}" created and you are now subscribed. <a href="/">Go back</a>`);
});

//display all topics 
app.get('/topics', async(req, res) => {
  const db = await getDb();
  const topics = db.collection('Message_board')

  const allTopics = await topics.find({}).toArray();

  let list = '<ul>';
  allTopics.forEach(topic => {
    list +=  `<li>${topic.name}</li>`;
  });
  list += '</ul>'

  res.send(`
    <h2>All Topics</h2>
    ${list}
    <a href="/">Back to Home</a>
  `);
});
    

// Start server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
