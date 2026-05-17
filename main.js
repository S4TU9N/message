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

let username = "";
let room = "";
let userColor = "";

/* -------------------- */
/* AUTO LOAD SAVED INFO */
/* -------------------- */

nameInput.value = localStorage.getItem("chat_name") || "";

const savedColor = localStorage.getItem("chat_color");

if (savedColor) {
  userColor = savedColor;
} else {
  userColor =
    "#" + Math.floor(Math.random() * 16777215).toString(16);

  localStorage.setItem("chat_color", userColor);
}

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

  data.forEach(addMessage);
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

        if (
          Date.now() - msgTime >
          15 * 60 * 1000
        ) {
          return;
        }

        addMessage(msg);
      }
    )
    .subscribe();
}

/* -------------------- */
/* ADD MESSAGE */
/* -------------------- */

function addMessage(msg) {
  const div = document.createElement("div");

  const time = new Date(msg.created_at);

  const hours = time.getHours()
    .toString()
    .padStart(2, "0");

  const minutes = time.getMinutes()
    .toString()
    .padStart(2, "0");

  const timeString = `${hours}:${minutes}`;

  div.innerHTML = `
    <span style="color:${msg.color}">
      ${msg.username}
    </span>
    <span style="color:gray"> [${timeString}]</span>:
    ${msg.content}
  `;

  messagesDiv.appendChild(div);

  messagesDiv.scrollTop =
    messagesDiv.scrollHeight;
}