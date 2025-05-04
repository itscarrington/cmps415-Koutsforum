const express = require("express");
const session = require("express-session");
const req = require("express/lib/request");
const { MongoClient } = require("mongodb");

const app = express();
const port = 3000;

const uri =
  "mongodb+srv://KingJunco:dodogama@king-junco.glav4m3.mongodb.net/?retryWrites=true&w=majority&appName=King-Junco";
let client;
let db;

// Session middleware
app.use(
  session({
    secret: "monster-hunter-secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.urlencoded({ extended: true }));

// MongoDB connection
async function getDb() {
  if (!client || !client.topology?.isConnected()) {
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    db = client.db("Database");
    console.log("Connected to MongoDB");
  }
  return db;
}

// Home/Login/Register form
app.get("/", (req, res) => {
  const username = req.session.username;
  res.send(`
    <h2>${username ? `Welcome, ${username}` : "Login or Register"}</h2>
    ${
      username
        ? `
      <a href="/new-topic">Create a New Topic</a><br/>
      <a href="/topics">View All Topics</a><br/>
      <a href="/subscribed-topics">View Subscribed Topics</a><br/>
      <a href="/logout">Logout</a>
    `
        : `
      <form action="/" method="post">
        <input name="username" placeholder="Username" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit" name="action" value="register">Register</button>
        <button type="submit" name="action" value="login">Login</button>
      </form>
    `
    }
  `);
});

// Handle login/register
app.post("/", async (req, res) => {
  const db = await getDb();
  const users = db.collection("Users");
  const { username, password, action } = req.body;

  if (action === "register") {
    const existing = await users.findOne({ username });
    if (existing) {
      return res.send('Username already exists. <a href="/">Try again</a>.');
    }

    await users.insertOne({ username, password, subscribedTopics: [] });
    res.send('Registration successful. <a href="/">Login now</a>.');
  } else if (action === "login") {
    const user = await users.findOne({ username, password });
    if (!user) {
      return res.send('Invalid credentials. <a href="/">Try again</a>.');
    }

    req.session.username = username; // Save username in session
    res.redirect("/");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Topic creation form — only accessible if logged in
app.get("/new-topic", (req, res) => {
  if (!req.session.username) {
    return res.send(
      'You must be logged in to create a topic. <a href="/">Login</a>'
    );
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
app.post("/new-topic", async (req, res) => {
  if (!req.session.username) {
    return res.send('Unauthorized. <a href="/">Login</a>');
  }

  const db = await getDb();
  const topics = db.collection("Message_board");
  const users = db.collection("Users");

  const username = req.session.username;
  const { topic } = req.body;

  const topicExists = await topics.findOne({ name: topic });
  if (topicExists) {
    return res.send(
      'Topic already exists. <a href="/new-topic">Try another</a>.'
    );
  }

  // Insert the new topic with the accessCount initialized to 0
  await topics.insertOne({
    name: topic,
    createdAt: new Date(),
    accessCount: 0, // Initialize access count to 0
    subscribers: [],
  });

  await users.updateOne(
    { username },
    { $addToSet: { subscribedTopics: topic } }
  );
  await topics.updateOne(
    { name: topic },
    { $addToSet: { subscribers: username } },
    { upsert: true }
  );

  res.send(
    `Topic "${topic}" created and you are now subscribed. <a href="/">Go back</a>`
  );
});

//display all topics
app.get("/topics", async (req, res) => {
  const db = await getDb();
  const topics = db.collection("Message_board");
  const currentUser = req.session.username;

  const allTopics = await topics.find({}).toArray();

  let list = "<ul>";
  allTopics.forEach((topic) => {
    list += `<li><a href="/topic/${encodeURIComponent(topic.name)}">${
      topic.name
    }</a>
    ${
      currentUser
        ? ` <form action="/subscribe" method="POST">
        <input type="hidden" name="topic" value="${topic.name}"/>
        <button type="submit">Subscribe</button>
        </form>
        `
        : ""
    }
      </li>`;
  });
  list += "</ul>";

  res.send(`
    <h2>All Topics</h2>
    ${list}
    <a href="/">Back to Home</a>
  `);
});

app.post("/subscribe", async (req, res) => {
  const currentUser = req.session.username;
  const topic = req.body.topic;

  const db = await getDb();
  const users = db.collection("Users");
  const board = db.collection("Message_board");

  await users.updateOne(
    { username: currentUser },
    { $addToSet: { subscribedTopics: topic } }
  );

  await board.updateOne(
    { name: topic },
    { $addToSet: { subscribers: currentUser } },
    { upsert: true }
  );
  console.log(`User subscribed to: ${topic}`);

  res.redirect("/topics");
});

app.get("/subscribed-topics", async (req, res) => {
  const db = await getDb();
  const person = db.collection("Users");
  const username = req.session.username;

  const user = await person.findOne(
    { username },
    { projection: { subscribedTopics: 1, _id: 0 } }
  );

  const subbedTopics = user.subscribedTopics || [];
  let listHtml = "<ul>";
  subbedTopics.forEach((topic) => {
    listHtml += `
    <li>
      ${topic}
      <form action ="/unsubscribe" method="POST">
        <input type="hidden" name="topic" value="${topic}"/>
        <button type="submit">Unsubscribe</button>
      </form>
    </li>
    `;
  });
  listHtml += "</ul>";

  res.send(`
    <h2>Subscribed topics for ${username}</h2>
    ${listHtml}
    <a href="/">Back to home</a>
    `);
});

app.post("/unsubscribe", async (req, res) => {
  const db = await getDb();
  const users = db.collection("Users");
  const board = db.collection("Message_board");
  const username = req.session.username;
  const removeTopic = req.body.topic;

  if (!username) {
    return res.send("Not logged in");
  }

  await users.updateOne(
    { username },
    { $pull: { subscribedTopics: removeTopic } }
  );

  await board.updateOne(
    {name: removeTopic},
    { $pull: {subscribers: username} }
  );

  res.redirect("/subscribed-topics");
});

// View messages in a topic (only if subscribed)
app.get("/topic/:name", async (req, res) => {
  if (!req.session.username) {
    return res.send('Please log in to view this topic. <a href="/">Login</a>');
  }

  const db = await getDb();
  const users = db.collection("Users");
  const topics = db.collection("Message_board");
  const messages = db.collection("Messages");
  const topicName = req.params.name;
  const username = req.session.username;

  const user = await users.findOne({ username });

  if (!user || !user.subscribedTopics.includes(topicName)) {
    return res.send(
      `You are not subscribed to "${topicName}". <a href="/topics">View topics</a>`
    );
  }

  // Increment the access count
  await topics.updateOne({ name: topicName }, { $inc: { accessCount: 1 } });

  const topicMessages = await messages
    .find({ topic: topicName })
    .sort({ timestamp: 1 })
    .toArray();

  let messageList = "<ul>";
  topicMessages.forEach((msg) => {
    messageList += `<li><strong>${msg.username}:</strong> ${msg.text}</li>`;
  });
  messageList += "</ul>";

  // Get the current access count
  const topic = await topics.findOne({ name: topicName });
  const accessCount = topic.accessCount;

  res.send(`
    <h2>Messages in "${topicName}"</h2>
    <p>This topic has been viewed ${accessCount} times.</p>
    ${messageList}

    <form action="/topic/${topicName}" method="POST">
      <input name="text" placeholder="Type your message" required />
      <button type="submit">Send</button>
    </form>

    <a href="/">Back to home</a>
  `);
});

// Post a message to a topic (only if subscribed)
app.post("/topic/:name", async (req, res) => {
  if (!req.session.username) {
    return res.send('You must be logged in to post. <a href="/">Login</a>');
  }

  const db = await getDb();
  const users = db.collection("Users");
  const messages = db.collection("Messages");
  const topicName = req.params.name.trim(); // Trim the topic name for any extra spaces
  const username = req.session.username;
  const { text } = req.body;

  const user = await users.findOne({ username });

  // Make sure subscribedTopics exists and is an array
  const subscribedTopics = user?.subscribedTopics || [];

  // Ensure the topic name is compared without leading/trailing spaces and in a case-insensitive manner
  if (
    !user ||
    !subscribedTopics.some(
      (topic) => topic.trim().toLowerCase() === topicName.toLowerCase()
    )
  ) {
    return res.send(
      `You are not subscribed to "${topicName}". <a href="/topics">View topics</a>`
    );
  }

  if (!text || text.trim() === "") {
    return res.send(
      'Message cannot be empty. <a href="/topic/${topicName}">Go back</a>'
    );
  }

  // Insert the new message into the database
  await messages.insertOne({
    topic: topicName,
    username,
    text,
    timestamp: new Date(),
  });

  // Redirect to the topic page to show the newly posted message
  res.redirect(`/topic/${topicName}`);
});

// Start server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
