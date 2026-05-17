const SUPABASE_URL = "https://kbpcgdsfqosgeoaanghf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticGNnZHNmcW9zZ2VvYWFuZ2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ0NDEsImV4cCI6MjA5NDMyMDQ0MX0.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujg";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const setupDiv = document.getElementById("setup");
const chatDiv = document.getElementById("chat");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const passwordInput = document.getElementById("passwordInput");

const joinBtn = document.getElementById("joinBtn");

const messagesDiv = document.getElementById("messages");

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const messageSound = new Audio("ping.mp3");

let username = "";
let room = "";
let userColor = "";

let initialLoadDone = false;

/* -------------------- */
/* AUTO LOAD SAVED INFO */
/* -------------------- */

nameInput.value = localStorage.getItem("chat_name") || "";

const savedColor = localStorage.getItem("chat_color");

if (savedColor) {
  userColor = savedColor;
} else {
  userColor =
    "#" +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0");

  localStorage.setItem("chat_color", userColor);
}

colorInput.value = userColor;

/* -------------------- */
/* ROOM FROM URL */
/* -------------------- */

const params = new URLSearchParams(window.location.search);

if (params.get("room")) {
  roomInput.value = params.get("room");
}

/* -------------------- */
/* JOIN ROOM */
/* -------------------- */

joinBtn.addEventListener("click", joinRoom);

async function joinRoom() {
  username = nameInput.value.trim();
  room = roomInput.value.trim();
  userColor = colorInput.value;

  localStorage.setItem("chat_color", userColor);

  if (!username || !room) return;

  localStorage.setItem("chat_name", username);

  const newUrl =
    window.location.origin +
    window.location.pathname +
    "?room=" +
    encodeURIComponent(room);

  history.replaceState({}, "", newUrl);

  setupDiv.classList.add("hidden");
  chatDiv.classList.remove("hidden");

  loadMessages();
  subscribeMessages();
}

/* -------------------- */
/* ENTER KEY SUPPORT */
/* -------------------- */

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    joinRoom();
  }
});

roomInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    joinRoom();
  }
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

/* -------------------- */
/* SEND MESSAGE */
/* -------------------- */

sendBtn.addEventListener("click", sendMessage);

async function sendMessage() {
  const content = messageInput.value.trim();

  if (!content) return;

  await supabaseClient.from("messages").insert([
    {
      room: room,
      username: username,
      content: content,
      color: userColor
    }
  ]);

  messageInput.value = "";
}

/* -------------------- */
/* LOAD MESSAGES */
/* -------------------- */

async function loadMessages() {
  messagesDiv.innerHTML = "";

  const fifteenMinutesAgo =
    new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("room", room)
    .gt("created_at", fifteenMinutesAgo)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(msg => addMessage(msg, false)); // false = no sound

  initialLoadDone = true;
}

/* -------------------- */
/* REALTIME */
/* -------------------- */

function subscribeMessages() {
  supabaseClient
    .channel("chat-room-" + room)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      (payload) => {
        const msg = payload.new;

        if (msg.room !== room) return;

        const msgTime = new Date(msg.created_at).getTime();

        if (Date.now() - msgTime > 15 * 60 * 1000) return;

        addMessage(msg, initialLoadDone);
      }
    )
    .subscribe();
}

/* -------------------- */
/* TOKENIZE MESSAGE */
/* -------------------- */

function tokenizeMessage(text) {
  const tokens = [];

  let i = 0;

  while (i < text.length) {
    const urlMatch = text.slice(i).match(urlRegex);
    const mentionMatch = text.slice(i).match(/^@([a-zA-Z0-9_]+)/);

    // URL found at current position
    if (urlMatch && urlMatch.index === 0) {
      const url = urlMatch[0];
      tokens.push({ type: "url", value: url });
      i += url.length;
      continue;
    }

    // mention found at current position
    if (mentionMatch) {
      const mention = mentionMatch[1];
      tokens.push({ type: "mention", value: mention });
      i += mention.length + 1;
      continue;
    }

    // fallback: accumulate normal text
    let nextSpecial = text.length;

    const nextUrl = text.slice(i).search(urlRegex);
    const nextMention = text.slice(i).search(/@/);

    if (nextUrl !== -1) nextSpecial = Math.min(nextSpecial, i + nextUrl);
    if (nextMention !== -1) nextSpecial = Math.min(nextSpecial, i + nextMention);

    const chunk = text.slice(i, nextSpecial);
    tokens.push({ type: "text", value: chunk });

    i = nextSpecial;
  }

  return tokens;
}

/* -------------------- */
/* ADD MESSAGE */
/* -------------------- */

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Detect URLs */
const urlRegex = /(https?:\/\/[^\s]+)/g;

/* Detect mentions like @user */
const mentionRegex = /@([a-zA-Z0-9_]+)/g;

function addMessage(msg, playSound = true) {
  const container = document.createElement("div");

  // --- header (username + time) ---
  const time = new Date(msg.created_at);
  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");

  const name = document.createElement("span");
  name.style.color = msg.color;
  name.textContent = msg.username;

  const timeSpan = document.createElement("span");
  timeSpan.style.color = "gray";
  timeSpan.textContent = ` [${hh}:${mm}]: `;

  container.appendChild(name);
  container.appendChild(timeSpan);

  // --- message body (safe parsing) ---
  const body = document.createElement("span");

  const parts = tokenizeMessage(msg.content);

  for (const part of parts) {
    if (part.type === "text") {
      body.appendChild(document.createTextNode(part.value));
    }

    if (part.type === "url") {
      const a = document.createElement("a");
      a.href = part.value;
      a.textContent = part.value;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      body.appendChild(a);
    }

    if (part.type === "mention") {
      const m = document.createElement("span");
      m.textContent = "@" + part.value;
      m.style.fontWeight = "bold";
      m.style.color = "#644dff";
      body.appendChild(m);
    }
  }

  container.appendChild(body);
  messagesDiv.appendChild(container);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  if (playSound) {
    messageSound.play().catch(() => {});
  }
}