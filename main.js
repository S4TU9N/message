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
const colorInput =  document.getElementById("colorInput");

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

  await loadMessages();
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

  data.forEach(msg => addMessage(msg, false));

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

        if (Date.now() - msgTime > 15 * 60 * 1000) {
          return;
        }

        addMessage(msg, initialLoadDone);
      }
    )
    .subscribe();
}

/* -------------------- */
/* TOKENIZE MESSAGE */
/* -------------------- */

const urlRegex = /(https?:\/\/[^\s]+)/;

function tokenizeMessage(text) {

  const tokens = [];

  const regex =
    /(https?:\/\/[^\s]+)|@([a-zA-Z0-9_]+)/g;

  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {

    const index = match.index;

    // normal text before token
    if (index > lastIndex) {

      tokens.push({
        type: "text",
        value: text.slice(lastIndex, index)
      });
    }

    // URL
    if (match[1]) {

      tokens.push({
        type: "url",
        value: match[1]
      });
    }

    // Mention
    else if (match[2]) {

      tokens.push({
        type: "mention",
        value: match[2]
      });
    }

    lastIndex =
      index + match[0].length;
  }

  // remaining text
  if (lastIndex < text.length) {

    tokens.push({
      type: "text",
      value: text.slice(lastIndex)
    });
  }

  return tokens;
}

/* -------------------- */
/* EMBED HELPERS */
/* -------------------- */

function isYouTube(url) {
  return (
    url.includes("youtube.com/watch?v=") ||
    url.includes("youtu.be/")
  );
}

function getYouTubeID(url) {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1);
    }

    return u.searchParams.get("v");

  } catch {
    return null;
  }
}

function createYouTubeEmbed(url) {

  const id = getYouTubeID(url);

  if (!id) {
    return document.createTextNode(url);
  }

  const iframe = document.createElement("iframe");

  iframe.src =
    `https://www.youtube.com/embed/${id}`;

  iframe.width = "320";
  iframe.height = "180";

  iframe.allowFullscreen = true;

  iframe.style.border = "none";
  iframe.style.borderRadius = "10px";
  iframe.style.marginTop = "6px";
  iframe.style.display = "block";

  iframe.referrerPolicy = "strict-origin-when-cross-origin";

  return iframe;
}

function isTenor(url) {
  return url.includes("tenor.com");
}

function createTenorEmbed(url) {

  const iframe = document.createElement("iframe");

  iframe.src = url;

  iframe.width = "320";
  iframe.height = "320";

  iframe.style.border = "none";
  iframe.style.borderRadius = "10px";
  iframe.style.marginTop = "6px";
  iframe.style.display = "block";

  return iframe;
}

function isImage(url) {
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(url);
}

function createImageEmbed(url) {

  const img = document.createElement("img");

  img.src = url;

  img.style.maxWidth = "300px";
  img.style.borderRadius = "10px";
  img.style.marginTop = "6px";
  img.style.display = "block";

  return img;
}

/* -------------------- */
/* ADD MESSAGE */
/* -------------------- */

function addMessage(msg, playSound = true) {

  const container =
    document.createElement("div");

  container.style.marginBottom = "10px";

  // Header

  const time = new Date(msg.created_at);

  const hh = time
    .getHours()
    .toString()
    .padStart(2, "0");

  const mm = time
    .getMinutes()
    .toString()
    .padStart(2, "0");

  const name =
    document.createElement("span");

  name.style.color = msg.color;
  name.textContent = msg.username;

  const timeSpan =
    document.createElement("span");

  timeSpan.style.color = "gray";
  timeSpan.textContent =
    ` [${hh}:${mm}]: `;

  container.appendChild(name);
  container.appendChild(timeSpan);

  // Body

  const body =
    document.createElement("span");

  const parts =
    tokenizeMessage(msg.content);

  for (const part of parts) {

    // TEXT
    if (part.type === "text") {

      body.appendChild(
        document.createTextNode(part.value)
      );
    }

    // URL
    if (part.type === "url") {

      // YouTube
      if (isYouTube(part.value)) {

        body.appendChild(
          createYouTubeEmbed(part.value)
        );

        continue;
      }

      // Tenor
      if (isTenor(part.value)) {

        body.appendChild(
          createTenorEmbed(part.value)
        );

        continue;
      }

      // Images
      if (isImage(part.value)) {

        body.appendChild(
          createImageEmbed(part.value)
        );

        continue;
      }

      // Normal link fallback

      const a =
        document.createElement("a");

      a.href = part.value;
      a.textContent = part.value;

      a.target = "_blank";
      a.rel = "noopener noreferrer";

      a.style.color = "#6ea8ff";

      body.appendChild(a);
    }

    // Mention
    if (part.type === "mention") {

      const m =
        document.createElement("span");

      m.textContent =
        "@" + part.value;

      m.style.fontWeight = "bold";
      m.style.color = "#644dff";

      body.appendChild(m);
    }
  }

  container.appendChild(body);

  messagesDiv.appendChild(container);

  messagesDiv.scrollTop =
    messagesDiv.scrollHeight;

  // Notification sound

  if (
    playSound &&
    document.visibilityState !== "visible"
  ) {

    messageSound.currentTime = 0;

    messageSound.play().catch(() => {});
  }
}