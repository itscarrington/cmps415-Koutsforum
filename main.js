const express = require("express");
const session = require("express-session");
const { MongoClient } = require("mongodb");
const Observer = require("./observer");

const app = express();
const port = 3000;

const uri = "mongodb+srv://KingJunco:dodogama@king-junco.glav4m3.mongodb.net/?retryWrites=true&w=majority&appName=King-Junco";
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
app.use(express.static('public')); // For serving CSS/images

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

// Custom middleware for headers
app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.isAuthenticated = !!req.session.username;
  next();
});

// Home/Login/Register form
app.get("/home", async (req, res) => {
  const username = req.session.username;
  
  res.locals = {
    isAuthenticated: !!username,
    username: username
  };
  
  let content = '';
  
  if (username) {
    const db = await getDb();
    const users = db.collection("Users");
    const messages = db.collection("Messages");
    
    const user = await users.findOne({ username });
    const subscribedTopics = user?.subscribedTopics || [];
    
    let subscribedTopicsContent = '';
    
    if (subscribedTopics.length > 0) {
      subscribedTopicsContent = "<h3>Earliest messages from your subscribed topics:</h3>";
      subscribedTopicsContent += "<div class='topic-container'>";
      
      for (const subTopic of subscribedTopics) {
        // Get the 2 earliest messages for this topic
        const earliestMessages = await messages
          .find({ topic: subTopic })
          .sort({ timestamp: -1 }) // Ascending order - oldest first
          .limit(2)
          .toArray();
        
        // Create a section for this topic using the styling similar to catalog-item
        subscribedTopicsContent += `
          <div class="catalog-item">
            <h4><a href="/topic/${subTopic}">${subTopic}</a></h4>
        `;
        
        if (earliestMessages.length > 0) {
          subscribedTopicsContent += "<div class='post-messages'>";
          earliestMessages.forEach(msg => {
            subscribedTopicsContent += `
              <div class="post">
                <div class="post-info">${msg.username}</div>
                <div class="post-message">${msg.text}</div>
              </div>
            `;
          });
          subscribedTopicsContent += "</div>";
        } else {
          subscribedTopicsContent += "<p>No messages found in this topic.</p>";
        }
        
        subscribedTopicsContent += `
            <div><a href="/topic/${subTopic}">View all messages</a></div>
          </div>
        `;
      }
      
      subscribedTopicsContent += "</div>";
    } else {
      subscribedTopicsContent = "<p>You are not subscribed to any topics. <a href='/topics'>Browse topics</a> to subscribe.</p>";
    }
    
    content = `
      <h2>Welcome, ${username}</h2>
      <div class="user-actions">
        <a href="/new-topic">Create a New Topic</a> | 
        <a href="/topics">View All Topics</a> | 
        <a href="/subscribed-topics">View Subscribed Topics</a> | 
        <a href="/notifications">Notifications</a>
      </div>
      
      <div class="subscribed-content">
        ${subscribedTopicsContent}
      </div>
    `;
  } else {
    content = `
      <h2>Login or Register</h2>
      <div class="post">
        <form action="/" method="post">
          <div>
            <input name="username" placeholder="Username" required />
          </div>
          <div>
            <input name="password" type="password" placeholder="Password" required />
          </div>
          <div>
            <button type="submit" name="action" value="register">Register</button>
            <button type="submit" name="action" value="login">Login</button>
          </div>
        </form>
      </div>
    `;
  }
  
  // Use the layout function to wrap the content
  const html = layout("Home", content, res);
  res.send(html);
});

function layout(title, content, res) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - koutsforum</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          max-width: 1200px;
          margin: 0 auto;
          padding: 10px;
          background-color: #eef2ff;
          color: #000;
        }
        .header {
          background-color: #800;
          color: white;
          padding: 5px;
          margin-bottom: 10px;
        }
        .board-title {
          font-weight: bold;
          font-size: 24px;
        }
        .post {
          background-color: #f0e0d6;
          border: 1px solid #d9bfb7;
          padding: 5px;
          margin-bottom: 10px;
        }
        .post-info {
          color: #117743;
          font-weight: bold;
        }
        .post-message {
          margin-top: 5px;
        }
        .reply-form {
          margin-top: 20px;
        }
        textarea {
          width: 100%;
          height: 100px;
        }
        .catalog-item {
          display: inline-block;
          width: 200px;
          vertical-align: top;
          margin: 5px;
          padding: 5px;
          background-color: #f0e0d6;
          border: 1px solid #d9bfb7;
        }
        .catalog-item img {
          max-width: 100%;
          max-height: 150px;
        }
        .user-controls {
          float: right;
          color: white;
        }
        a {
          color:rgb(39, 172, 255);
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .new-thread {
          background-color: #f0e0d6;
          padding: 10px;
          margin-bottom: 20px;
        }
        .topic-container {
          display: flex;
          flex-wrap: wrap;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="board-title">koutsforum</span>
        <span class="user-controls">
          ${res.locals.isAuthenticated ? 
            `Welcome, ${res.locals.username} | 
            <a href="/home">Home</a> |
            <a href="/new-topic">New Board</a> | 
            <a href="/topics">All Boards</a> | 
            <a href="/subscribed-topics">Your Boards</a> | 
            <a href="/logout">Logout</a>` : 
            `<a href="/">Login/Register</a>`}
        </span>
      </div>
      ${content}
    </body>
    </html>
  `;
}

// Home/Login/Register form
app.get("/", (req, res) => {
  if (res.locals.isAuthenticated) {
    return res.redirect("/home");
  }

  res.send(layout("Login", `
    <div style="width: 300px; margin: 0 auto;">
      <h2>Login or Register</h2>
      <form action="/" method="post">
        <div style="margin-bottom: 5px;">
          <input name="username" placeholder="Username" required style="width: 100%;" />
        </div>
        <div style="margin-bottom: 5px;">
          <input name="password" type="password" placeholder="Password" required style="width: 100%;" />
        </div>
        <div>
          <button type="submit" name="action" value="register" style="width: 48%;">Register</button>
          <button type="submit" name="action" value="login" style="width: 48%;">Login</button>
        </div>
      </form>
    </div>
  `, res));
});

// Handle login/register
app.post("/", async (req, res) => {
  const db = await getDb();
  const users = db.collection("Users");
  const { username, password, action } = req.body;

  if (action === "register") {
    const existing = await users.findOne({ username });
    if (existing) {
      return res.send(layout("Error", 'Username already exists. <a href="/">Try again</a>.', res));
    }

    await users.insertOne({ username, password, subscribedTopics: [] });
    res.send(layout("Success", 'Registration successful. <a href="/">Login now</a>.', res));
  } else if (action === "login") {
    const user = await users.findOne({ username, password });
    if (!user) {
      return res.send(layout("Error", 'Invalid credentials. <a href="/">Try again</a>.', res));
    }

    req.session.username = username;
    res.redirect("/home");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Board creation form
app.get("/new-topic", (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect("/");
  }

  res.send(layout("New Board", `
    <div class="new-thread">
      <h2>Create New Board</h2>
      <form action="/new-topic" method="post">
        <input name="topic" placeholder="Board Name (e.g. /mh/ - Monster Hunter General)" required style="width: 100%;" />
        <div style="margin-top: 10px;">
          <button type="submit">Create Board</button>
          <a href="/topics" style="margin-left: 10px;">Cancel</a>
        </div>
      </form>
    </div>
  `, res));
});

// Handle board creation + auto-subscribe
app.post("/new-topic", async (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect("/");
  }

  const db = await getDb();
  const topics = db.collection("Message_board");
  const users = db.collection("Users");

  const username = req.session.username;
  const { topic } = req.body;
  const observer = new Observer(db);

  const topicExists = await topics.findOne({ name: topic });
  if (topicExists) {
    return res.send(layout("Error", 'Board already exists. <a href="/new-topic">Try another</a>.', res));
  }

  await topics.insertOne({
    name: topic,
    createdAt: new Date(),
    accessCount: 0,
    subscribers: [],
  });

  observer.subscribe(username, topic);

  res.redirect(`/topic/${encodeURIComponent(topic)}`);
});

// Display all boards in catalog style
app.get("/topics", async (req, res) => {
  const db = await getDb();
  const topics = db.collection("Message_board");

  const allTopics = await topics.find({}).sort({ accessCount: -1 }).toArray();

  let catalog = '<div class="catalog">';
  allTopics.forEach((topic) => {
    catalog += `
      <div class="catalog-item">
        <div class="post-info">${topic.name}</div>
        <div>${topic.accessCount} views</div>
        <div style="margin-top: 5px;">
          <a href="/topic/${encodeURIComponent(topic.name)}">Visit</a>
          ${res.locals.isAuthenticated ? 
            `| <a href="/subscribe/${encodeURIComponent(topic.name)}">Subscribe</a>` : ''}
        </div>
      </div>
    `;
  });
  catalog += '</div>';

  res.send(layout("All Boards", `
    <h2>All Boards</h2>
    ${catalog}
    ${res.locals.isAuthenticated ? '<div><a href="/new-topic">Create New Board</a></div>' : ''}
  `, res));
});

// Subscribe to a board
app.get("/subscribe/:name", async (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect("/");
  }

  const topic = decodeURIComponent(req.params.name);
  const observer = new Observer(db);
  observer.subscribe(req.session.username, topic);

  res.redirect(`/topic/${encodeURIComponent(topic)}`);
});

// View subscribed boards
app.get("/subscribed-topics", async (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect("/");
  }

  const db = await getDb();
  const person = db.collection("Users");
  const username = req.session.username;

  const user = await person.findOne(
    { username },
    { projection: { subscribedTopics: 1, _id: 0 } }
  );

  const subbedTopics = user.subscribedTopics || [];
  let listHtml = '<div class="catalog">';
  subbedTopics.forEach((topic) => {
    listHtml += `
      <div class="catalog-item">
        <div class="post-info">${topic}</div>
        <div style="margin-top: 5px;">
          <a href="/topic/${encodeURIComponent(topic)}">Visit</a>
          | <a href="/unsubscribe/${encodeURIComponent(topic)}">Unsubscribe</a>
        </div>
      </div>
    `;
  });
  listHtml += '</div>';

  res.send(layout("Your Boards", `
    <h2>Your Subscribed Boards</h2>
    ${subbedTopics.length > 0 ? listHtml : '<p>You are not subscribed to any boards yet.</p>'}
    <div style="margin-top: 10px;">
      <a href="/topics">Browse All Boards</a>
    </div>
  `, res));
});

// Unsubscribe from a board
app.get("/unsubscribe/:name", async (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect("/");
  }

  const topic = decodeURIComponent(req.params.name);
  const observer = new Observer(db);
  observer.unsubscribe(req.session.username, topic);

  res.redirect("/subscribed-topics");
});

// View messages in a board (only if subscribed)
app.get("/topic/:name", async (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.send(layout("Error", 'Please log in to view this board. <a href="/">Login</a>', res));
  }

  const db = await getDb();
  const users = db.collection("Users");
  const topics = db.collection("Message_board");
  const messages = db.collection("Messages");
  const topicName = decodeURIComponent(req.params.name);
  const username = req.session.username;

  const user = await users.findOne({ username });

  if (!user || !user.subscribedTopics.includes(topicName)) {
    return res.send(layout("Error", `
      You are not subscribed to "${topicName}". 
      <a href="/subscribe/${encodeURIComponent(topicName)}">Subscribe now</a> or 
      <a href="/topics">browse other boards</a>
    `, res));
  }

  // Increment the access count
  await topics.updateOne({ name: topicName }, { $inc: { accessCount: 1 } });

  const topicMessages = await messages
    .find({ topic: topicName })
    .sort({ timestamp: 1 })
    .toArray();

  let messageList = "";
  topicMessages.forEach((msg) => {
    messageList += `
      <div class="post">
        <div class="post-info">${msg.username} <span style="color: #707070;">${new Date(msg.timestamp).toLocaleString()}</span></div>
        <div class="post-message">${msg.text.replace(/\n/g, '<br>')}</div>
      </div>
    `;
  });

  // Get the current access count
  const topic = await topics.findOne({ name: topicName });
  const accessCount = topic.accessCount;

  res.send(layout(topicName, `
    <h2>${topicName}</h2>
    <p style="color: #707070;">This board has been viewed ${accessCount} times.</p>
    
    <div style="margin-top: 20px;">
      ${messageList}
    </div>

    <div class="new-thread">
      <h3>Post a Reply</h3>
      <form action="/topic/${encodeURIComponent(topicName)}" method="POST">
        <textarea name="text" placeholder="Type your message here..." required></textarea>
        <div style="margin-top: 5px;">
          <button type="submit">Post</button>
        </div>
      </form>
    </div>
    
    <div style="margin-top: 20px;">
      <a href="/topics">Back to all boards</a>
    </div>
  `, res));
});

// Post a message to a board (only if subscribed)
app.post("/topic/:name", async (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect("/");
  }

  const db = await getDb();
  const users = db.collection("Users");
  const messages = db.collection("Messages");
  const topicName = decodeURIComponent(req.params.name);
  const username = req.session.username;
  const { text } = req.body;

  const user = await users.findOne({ username });

  if (!user || !user.subscribedTopics.includes(topicName)) {
    return res.send(layout("Error", `You are not subscribed to "${topicName}".`, res));
  }

  if (!text || text.trim() === "") {
    return res.redirect(`/topic/${encodeURIComponent(topicName)}`);
  }

  await messages.insertOne({
    topic: topicName,
    username: username, 
    text,
    timestamp: new Date(),
  });

  const observer = new Observer(db);
  await observer.notify(topicName, text);

  res.redirect(`/topic/${encodeURIComponent(topicName)}`);
});

app.get("/notifications", async (req, res) => {
  const username = req.session.username;
  const db = await getDb();
  const notif = await db
    .collection("Notifications")
    .find({ username: username })
    .sort({ createdAt: -1 })
    .toArray();

  res.send(`
    <h2>Notifications</h2>
    <ul>
    ${notif.map(
      (look) =>
        `<li>New message in ${look.event} from user ${look.username}: ${look.data}</li>`
    )}
    </ul>`);
});

// Start server
app.listen(port, () => {
  console.log(`Go to http://localhost:${port}`);
});