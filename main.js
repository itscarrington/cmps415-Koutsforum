const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://KingJunco:dodogama@king-junco.glav4m3.mongodb.net/?retryWrites=true&w=majority&appName=King-Junco";
let client;
let db;

async function getDb() {
  if (!client || !client.topology?.isConnected()) {
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db('Database'); // match your Compass DB name
    console.log('Connected to MongoDB');
  }
  return db;
}

app.use(express.urlencoded({ extended: true }));

// Home page: combined login + register form
app.get('/', (req, res) => {
  res.send(`
    <h2>Login or Register</h2>
    <form action="/" method="post">
      <input name="username" placeholder="Username" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit" name="action" value="register">Register</button>
      <button type="submit" name="action" value="login">Login</button>
    </form>
  `);
});

// Combined Register/Login Route
app.post('/', async (req, res) => {
  const db = await getDb();
  const users = db.collection('Users');
  const { username, password, action } = req.body;

  if (action === 'register') {
    // Register Logic
    const existing = await users.findOne({ username });
    if (existing) {
      return res.send('Username already exists. <a href="/">Try again</a>.');
    }

    await users.insertOne({ username, password });
    res.send('Registration successful. <a href="/">Login now</a>.');
  } else if (action === 'login') {
    // Login Logic
    const user = await users.findOne({ username, password });
    if (!user) {
      return res.send('Invalid credentials. <a href="/">Try again</a>.');
    }

    res.send(`Welcome, ${username}!`);
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
