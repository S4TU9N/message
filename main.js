const SUPABASE_URL = "https://kbpcgdsfqosgeoaanghf.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticGNnZHNmcW9zZ2VvYWFuZ2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ0NDEsImV4cCI6MjA5NDMyMDQ0MX0.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujg";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/* -------------------- */
/* STATUS */
/* -------------------- */

function setStatus(msg, color = "black") {
  const box = document.getElementById("statusBox");
  if (!box) return;

  box.textContent = msg;
  box.style.color = color;
  box.style.fontWeight = "bold";
}

/* -------------------- */
/* STATE */
/* -------------------- */

let currentUser = null;
let currentProfile = null;
let room = "";
let initialLoadDone = false;
let activeChannel = null;

/* -------------------- */
/* INIT AUTH */
/* -------------------- */

(async () => {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    currentUser = data.session.user;
    await loadCurrentUser();
    setStatus("Session restored", "green");
  } else {
    setStatus("Not logged in", "gray");
  }
})();

/* -------------------- */
/* DOM */
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

/* -------------------- */
/* AUTH */
/* -------------------- */

async function signUp(email, password, username) {
  setStatus("Signing up...", "gray");

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    setStatus("Signup failed: " + error.message, "red");
    return;
  }

  if (data.user) {
    await supabaseClient.from("profiles").insert([
      {
        id: data.user.id,
        username,
        color: "#6c8cff"
      }
    ]);
  }

  setStatus("Signup complete", "green");
}

async function login(email, password) {
  setStatus("Logging in...", "gray");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setStatus("Login failed: " + error.message, "red");
    return;
  }

  await loadCurrentUser();
  setStatus("Logged in", "green");
}

async function loadCurrentUser() {
  const { data } = await supabaseClient.auth.getSession();
  const session = data.session;

  if (!session) return false;

  currentUser = session.user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  currentProfile = profile || null;

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

async function joinRoom() {
  room = roomInput.value.trim();
  if (!room) return;

  const ok = await loadCurrentUser();
  if (!ok) {
    setStatus("Login required", "red");
    return;
  }

  setupDiv.classList.add("hidden");
  chatDiv.classList.remove("hidden");

  await createRoom(room);
  await loadMessages();
  subscribeMessages();

  setStatus("Joined " + room, "green");
}

/* -------------------- */
/* MESSAGE SENDING */
/* -------------------- */

async function sendMessage() {
  const content = messageInput.value.trim();

  if (!content || !currentUser || !currentProfile) {
    setStatus("Cannot send message", "red");
    return;
  }

  const { error } = await supabaseClient.from("messages").insert([
    {
      room,
      user_id: currentUser.id,
      username: currentProfile.username,
      color: currentProfile.color,
      content
    }
  ]);

  if (error) {
    setStatus("Send failed: " + error.message, "red");
    return;
  }

  messageInput.value = "";
}

/* -------------------- */
/* LOAD MESSAGES */
/* -------------------- */

async function loadMessages() {
  messagesDiv.innerHTML = "";

  const { data } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("room", room)
    .order("created_at", { ascending: true });

  if (!data) return;

  data.forEach(m => renderMessage(m, false));

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
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room=eq.${room}`
      },
      payload => renderMessage(payload.new, initialLoadDone)
    )
    .subscribe();
}

/* -------------------- */
/* TOKENIZE */
/* -------------------- */

function tokenize(text) {
  const regex = /(https?:\/\/[^\s]+)|@([a-zA-Z0-9_]+)/g;

  const out = [];
  let last = 0;

  for (const m of text.matchAll(regex)) {
    if (m.index > last) {
      out.push({ type: "text", value: text.slice(last, m.index) });
    }

    if (m[1]) out.push({ type: "url", value: m[1] });
    if (m[2]) out.push({ type: "mention", value: m[2] });

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    out.push({ type: "text", value: text.slice(last) });
  }

  return out;
}

/* -------------------- */
/* EMBEDS (kept minimal hooks) */
/* -------------------- */

function safeURL(u) {
  try {
    const url = new URL(u);
    return url.protocol.startsWith("http") ? url : null;
  } catch {
    return null;
  }
}

/* -------------------- */
/* RENDER MESSAGE (FIXED STRUCTURE) */
/* -------------------- */

function renderMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "block";
  wrapper.style.margin = "6px 0";

  const header = document.createElement("div");

  const name = document.createElement("span");
  name.textContent = msg.username + " ";
  name.style.color = msg.color;

  const time = document.createElement("span");
  if (msg.created_at) {
    time.textContent =
      " • " +
      new Date(msg.created_at).toLocaleTimeString();
  }
  time.style.opacity = "0.6";
  time.style.fontSize = "12px";

  header.appendChild(name);
  header.appendChild(time);

  const body = document.createElement("div");
  body.style.display = "block";

  for (const part of tokenize(msg.content)) {
    if (part.type === "text") {
      body.appendChild(document.createTextNode(part.value));
    }

    if (part.type === "url") {
      const safe = safeURL(part.value);
      if (!safe) continue;

      const a = document.createElement("a");
      a.href = safe.href;
      a.textContent = safe.href;
      a.target = "_blank";

      body.appendChild(a);

      if (isYouTube?.(safe.href)) {
        const embed = createYouTubeEmbed?.(safe.href);
        if (embed) body.appendChild(embed);
      }

      if (isTenor?.(safe.href)) {
        const embed = createTenorEmbed?.(safe.href);
        if (embed) body.appendChild(embed);
      }
    }

    if (part.type === "mention") {
      const m = document.createElement("span");
      m.textContent = "@" + part.value;
      m.style.color = "#4aa3ff";
      body.appendChild(m);
    }
  }

  wrapper.appendChild(header);
  wrapper.appendChild(body);

  messagesDiv.appendChild(wrapper);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* -------------------- */
/* EVENTS */
/* -------------------- */

joinBtn.onclick = joinRoom;

sendBtn.onclick = sendMessage;

messageInput.onkeydown = (e) => {
  if (e.key === "Enter") sendMessage();
};

signupBtn.onclick = () =>
  signUp(
    emailInput.value.trim(),
    passwordInput.value,
    usernameInput.value.trim()
  );

loginBtn.onclick = () =>
  login(
    emailInput.value.trim(),
    passwordInput.value
  );