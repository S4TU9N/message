const SUPABASE_URL =
  "https://kbpcgdsfqosgeoaanghf.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticGNnZHNmcW9zZ2VvYWFuZ2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ0NDEsImV4cCI6MjA5NDMyMDQ0MX0.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujg";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* -------------------- */
/* STATUS */
/* -------------------- */

function setStatus(msg, color = "gray") {
  const el = document.getElementById("statusBox");
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
}

/* -------------------- */
/* ELEMENTS */
/* -------------------- */

const setupDiv = document.getElementById("setup");
const chatDiv = document.getElementById("chat");

const roomInput = document.getElementById("roomInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const usernameInput = document.getElementById("usernameInput");

const joinBtn = document.getElementById("joinBtn");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");

const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const messageSound = new Audio("ping.mp3");

/* -------------------- */
/* STATE */
/* -------------------- */

let currentUser = null;
let currentProfile = null;
let room = "";
let initialLoadDone = false;
let activeChannel = null;

/* -------------------- */
/* AUTH */
/* -------------------- */

async function signUp(email, password, username) {
  setStatus("Signing up...");

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    setStatus("Signup failed: " + error.message, "red");
    return false;
  }

  if (!data?.user) {
    setStatus("Check email to confirm account", "orange");
    return false;
  }

  const color =
    "#" + Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0");

  const { error: profileError } =
    await supabaseClient.from("profiles").insert([
      {
        id: data.user.id,
        username,
        color
      }
    ]);

  if (profileError) {
    setStatus("Profile error: " + profileError.message, "red");
    return false;
  }

  setStatus("Signup success", "green");
  return true;
}

async function login(email, password) {
  setStatus("Logging in...");

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    setStatus("Login failed: " + error.message, "red");
    return false;
  }

  setStatus("Login success", "green");
  return true;
}

async function loadCurrentUser() {
  const { data: { user } } =
    await supabaseClient.auth.getUser();

  if (!user) return false;

  currentUser = user;

  const { data, error } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

  if (error || !data) {
    setStatus("Profile load failed", "red");
    return false;
  }

  currentProfile = data;
  return true;
}

/* -------------------- */
/* ROOM */
/* -------------------- */

async function createRoom(name) {
  if (!currentUser || !name) return;

  await supabaseClient.from("rooms").insert([
    {
      room_name: name,
      owner_id: currentUser.id
    }
  ]);
}

/* -------------------- */
/* JOIN ROOM */
/* -------------------- */

async function joinRoom() {
  room = roomInput.value.trim();
  if (!room) return;

  const loaded = await loadCurrentUser();
  if (!loaded) {
    setStatus("Login required", "red");
    return;
  }

  const url =
    window.location.origin +
    window.location.pathname +
    "?room=" +
    encodeURIComponent(room);

  history.replaceState({}, "", url);

  setupDiv.classList.add("hidden");
  chatDiv.classList.remove("hidden");

  await createRoom(room);
  await loadMessages();
  subscribeMessages();

  setStatus("Joined room: " + room, "green");
}

/* -------------------- */
/* MESSAGE SENDING */
/* -------------------- */

async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !currentUser) return;

  const { error } =
    await supabaseClient.from("messages").insert([
      {
        room,
        user_id: currentUser.id,
        username: currentProfile.username,
        color: currentProfile.color,
        content
      }
    ]);

  if (error) {
    setStatus("Send failed", "red");
    return;
  }

  messageInput.value = "";
}

/* -------------------- */
/* LOAD MESSAGES */
/* -------------------- */

async function loadMessages() {
  messagesDiv.innerHTML = "";

  const cutoff =
    new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } =
    await supabaseClient
      .from("messages")
      .select("*")
      .eq("room", room)
      .gt("created_at", cutoff)
      .order("created_at", { ascending: true });

  if (error) {
    setStatus("Load failed", "red");
    return;
  }

  for (const msg of data) {
    await addMessage(msg, false);
  }

  initialLoadDone = true;
}

/* -------------------- */
/* REALTIME */
/* -------------------- */

function subscribeMessages() {
  if (activeChannel) {
    supabaseClient.removeChannel(activeChannel);
  }

  activeChannel = supabaseClient
    .channel("chat-" + room)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `room=eq.${room}`
    }, async (payload) => {
      await addMessage(payload.new, initialLoadDone);
    })
    .subscribe();
}

/* -------------------- */
/* TOKENIZER */
/* -------------------- */

function tokenizeMessage(text) {
  const regex = /(https?:\/\/[^\s]+)|@([a-zA-Z0-9_]+)/g;
  const tokens = [];
  let last = 0;

  for (const m of text.matchAll(regex)) {
    if (m.index > last) {
      tokens.push({ type: "text", value: text.slice(last, m.index) });
    }

    if (m[1]) tokens.push({ type: "url", value: m[1] });
    if (m[2]) tokens.push({ type: "mention", value: m[2] });

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    tokens.push({ type: "text", value: text.slice(last) });
  }

  return tokens;
}

/* -------------------- */
/* URL HELPERS */
/* -------------------- */

function safeURL(url) {
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") ? u : null;
  } catch {
    return null;
  }
}

/* -------------------- */
/* EMBEDS */
/* -------------------- */

function isYouTube(url) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function getYouTubeID(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function createYouTubeEmbed(url) {
  const id = getYouTubeID(url);
  if (!id) return null;

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${id}`;
  iframe.width = "320";
  iframe.height = "180";
  iframe.allowFullscreen = true;
  iframe.style.border = "none";
  return iframe;
}

function isTenor(url) {
  return url.includes("tenor.com/view/");
}

function createTenorEmbed(url) {
  const match = url.match(/-(\d+)(\?.*)?$/);
  if (!match) return null;

  const iframe = document.createElement("iframe");
  iframe.src = `https://tenor.com/embed/${match[1]}`;
  iframe.width = "320";
  iframe.height = "320";
  iframe.style.border = "none";
  return iframe;
}

function isImage(url) {
  return /\.(png|jpg|jpeg|gif|webp)/i.test(url);
}

function createImageEmbed(url) {
  const img = document.createElement("img");
  img.src = url;
  img.style.maxWidth = "300px";
  return img;
}

function createLink(url) {
  const a = document.createElement("a");
  a.href = url;
  a.textContent = url;
  a.target = "_blank";
  return a;
}

/* -------------------- */
/* MESSAGE RENDER */
/* -------------------- */

async function addMessage(msg, playSound = true) {
  try {
    const container = document.createElement("div");

    const time = new Date(msg.created_at);
    container.textContent = "";

    const header = document.createElement("span");
    header.style.color = msg.color;
    header.textContent = msg.username + " ";
    container.appendChild(header);

    const body = document.createElement("span");

    for (const part of tokenizeMessage(msg.content)) {
      if (part.type === "text") {
        body.appendChild(document.createTextNode(part.value));
      }

      if (part.type === "url") {
        const safe = safeURL(part.value);
        if (!safe) continue;

        body.appendChild(createLink(safe.href));

        if (isYouTube(safe.href)) {
          const embed = createYouTubeEmbed(safe.href);
          if (embed) body.appendChild(embed);
        }

        if (isTenor(safe.href)) {
          const embed = createTenorEmbed(safe.href);
          if (embed) body.appendChild(embed);
        }

        if (isImage(safe.href)) {
          body.appendChild(createImageEmbed(safe.href));
        }
      }

      if (part.type === "mention") {
        const m = document.createElement("span");
        m.textContent = "@" + part.value;
        body.appendChild(m);
      }
    }

    container.appendChild(body);
    messagesDiv.appendChild(container);
  } catch (e) {
    console.error("render error", e);
  }
}

/* -------------------- */
/* EVENTS */
/* -------------------- */

joinBtn.onclick = joinRoom;
sendBtn.onclick = sendMessage;

messageInput.onkeydown = (e) => {
  if (e.key === "Enter") sendMessage();
};

/* -------------------- */
/* INIT */
/* -------------------- */

(async () => {
  const loaded = await loadCurrentUser();
  if (loaded) setStatus("Session restored", "green");
})();