const SUPABASE_URL =
  "https://kbpcgdsfqosgeoaanghf.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticGNnZHNmcW9zZ2VvYWFuZ2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ0NDEsImV4cCI6MjA5NDMyMDQ0MX0.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujg";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

/* -------------------- */
/* STATE */
/* -------------------- */

let currentUser = null;
let currentProfile = null;
let room = "";
let activeChannel = null;
let initialLoadDone = false;


let roomReloadTimeout = null;

function scheduleRoomReload() {
  clearTimeout(roomReloadTimeout);
  roomReloadTimeout = setTimeout(loadOpenRooms, 200);
}

/* -------------------- */
/* UI */
/* -------------------- */

function setStatus(msg, color = "black") {
  const box = document.getElementById("statusBox");
  if (!box) return;

  box.textContent = msg;
  box.style.color = color;
  box.style.fontWeight = "bold";
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
/* AUTH STATE */
/* -------------------- */


const authSection =
  document.getElementById("authSection");

const roomSection =
  document.getElementById("roomSection");

const logoutBtn =
  document.getElementById("logoutBtn");

async function loadSession() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session || null;
}

function updateAuthUI() {
  const roomSection = document.getElementById("roomSection");
  const chat = document.getElementById("chat");

  if (!currentUser) {
    authSection.style.display = "block";
    roomSection.style.display = "none";
    chat.style.display = "none";
    return;
  }

  const usernameEl = document.getElementById("usernameDisplay");
  if (usernameEl) {
    usernameEl.textContent = currentProfile?.username || "User";
  }
  authSection.style.display = "none";
  roomSection.style.display = "block";
  chat.style.display = "block";
}


async function loadCurrentUser() {
  const session = await loadSession();

  if (!session) {

  currentUser = null;
  currentProfile = null;

  updateAuthUI();

  return false;
  }

  currentUser = session.user;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error || !profile) {
    const { data: created, error: insertError } =
      await supabaseClient
        .from("profiles")
        .upsert({
          id: currentUser.id,
          username: currentUser.email.split("@")[0],
          color: "#6c8cff"
        })
        .select()
        .single();

    if (insertError) {
      console.log(insertError);
      return false;
    }

    currentProfile = created;
    updateAuthUI();
    return true;
  }

  currentProfile = profile;
  updateAuthUI();
  return true;
}

/* -------------------- */
/* SIGNUP / LOGIN */
/* -------------------- */

async function signUp(email, password, username) {
  setStatus("Signing up...", "gray");
  const regex = /^[\w-]+$/;
  if (!regex.test(username)) {
    setStatus("Username must be alphanumeric, or contain underscores or hyphens", "red")
    return;
  }
  const { data: existingUser } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingUser) {
    setStatus("Username taken", "red");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    setStatus(error.message, "red");
    return;
  }

  if (data.user) {
    await supabaseClient.from("profiles").insert({
      id: data.user.id,
      username,
      color: "#6c8cff"
    });
  }

  setStatus("Signup complete (check email if required)", "green");
}

async function logout() {

  await supabaseClient.auth.signOut();

  currentUser = null;
  currentProfile = null;

  updateAuthUI();

  setupDiv.classList.remove("hidden");
  chatDiv.classList.add("hidden");
}

async function login(email, password) {
  setStatus("Logging in...", "gray");

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    setStatus(error.message, "red");
    return;
  }

  const ok = await loadCurrentUser();

  if (!ok) {
    setStatus("Failed to load profile (check RLS / network)", "red");
    currentProfile = null;
    return;
  }

  console.log("session:", session);
  console.log("user:", currentUser);
  console.log("profile:", profile, error);
  if (ok) setStatus("Logged in", "green");
  updateAuthUI();
}

/* -------------------- */
/* ROOMS */
/* -------------------- */

async function loadOpenRooms() {
  console.log("Loading open rooms...");
  const { data, error } = await supabaseClient
    .from("rooms")
    .select("*")
    .order("last_active", { ascending: false });
  console.log("rooms:", data);
  if (error) {
    setStatus(error.message, "red");
    return;
  }

  const container = document.getElementById("openRooms");
  if (!container) {
    setStatus("Missing openRooms div", "red");
    return;
  }

  container.innerHTML = "";

  data.forEach(roomRow => {
    const btn = document.createElement("button");
    btn.textContent = roomRow.name;

    btn.onclick = () => {
      roomInput.value = roomRow.name;
      joinRoom();
    };

    container.appendChild(btn);
  });
}

async function createRoom(name) {
  if (!currentUser) return;

  const { error } = await supabaseClient.from("rooms").upsert({
    name: name,
    owner_id: currentUser.id,
    last_active: new Date().toISOString(),
    user_count: 1
  });

  if (error) {
    console.log("createRoom error:", error);
  }
}

/* -------------------- */
/* JOIN ROOM */
/* -------------------- */

async function joinRoom() {
  room = roomInput.value.trim();
  if (!room) return;

  if (!currentUser) {
    setStatus("Login required", "red");
    return;
  }

  if (!currentProfile) {
    setStatus("Loading profile...", "gray");
    const ok = await loadCurrentUser();
    if (!ok || !currentProfile) return;
  }

  history.replaceState(
    {},
    "",
    `?room=${encodeURIComponent(room)}`
  );

  setupDiv.classList.add("hidden");
  chatDiv.classList.remove("hidden");

  await createRoom(room);
  await loadMessages();
  subscribeMessages();

  setStatus(`Joined ${room}`, "green");
}

/* -------------------- */
/* MESSAGE SEND */
/* -------------------- */

async function sendMessage() {
  const content = messageInput.value.trim();
  if (content.length > 1000) {
    setStatus("Message is too long", "red");
    return;
  }
  if (!content || !currentUser || !currentProfile) return;

  const messageData = {
    room,
    user_id: currentUser.id,
    username: currentProfile.username,
    color: currentProfile.color,
    content
  };

  const { error } =
    await supabaseClient
      .from("messages")
      .insert(messageData);

  if (error) {
    setStatus(error.message, "red");
    return;
  }

  messageInput.value = "";
}

/* -------------------- */
/* LOAD MESSAGES */
/* -------------------- */

async function loadMessages() {
  messagesDiv.innerHTML = "";

  const cutoff = new Date(
    Date.now() - 15 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("room", room)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (error) {
    setStatus(error.message, "red");
    return;
  }

  data.forEach(m => addMessage(m, false));

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
    .channel("room-" + room)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room=eq.${room}`
      },
      payload => addMessage(payload.new)
    )
    .subscribe();
}

/* -------------------- */
/* TOKENIZER */
/* -------------------- */

function tokenizeMessage(text) {
  const regex =
    /(https?:\/\/[^\s]+)|@([a-zA-Z0-9_]+)/g;

  const out = [];
  let last = 0;

  for (const m of text.matchAll(regex)) {
    if (m.index > last) {
      out.push({
        type: "text",
        value: text.slice(last, m.index)
      });
    }

    if (m[1]) out.push({ type: "url", value: m[1] });
    if (m[2]) out.push({ type: "mention", value: m[2] });

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    out.push({
      type: "text",
      value: text.slice(last)
    });
  }

  return out;
}

/* -------------------- */
/* HELPERS */
/* -------------------- */

function timeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;

  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return `${Math.floor(diff / 86400)}d ago`;
}

function wrapEmbed(el) {
  const d = document.createElement("div");
  d.style.display = "block";
  d.style.marginTop = "6px";
  d.appendChild(el);
  return d;
}

function safeURL(url) {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol)
      ? u
      : null;
  } catch {
    return null;
  }
}

function createLink(url) {
  const a = document.createElement("a");
  a.href = url;
  a.textContent = url;
  a.target = "_blank";
  return a;
}

/* embeds */

function isYouTube(url) {
  return url.includes("youtu");
}

function getYouTubeID(url) {
  const u = new URL(url);
  if (u.hostname.includes("youtu.be"))
    return u.pathname.slice(1);
  return u.searchParams.get("v");
}

function createYouTubeEmbed(url) {
  const id = getYouTubeID(url);
  if (!id) return null;

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${id}`;
  iframe.width = "320";
  iframe.height = "180";
  return iframe;
}

function isTenor(url) {
  return url.includes("tenor.com");
}

function createTenorEmbed(url) {
  const m = url.match(/-(\d+)/);
  if (!m) return null;

  const iframe = document.createElement("iframe");
  iframe.src = `https://tenor.com/embed/${m[1]}`;
  iframe.width = "320";
  iframe.height = "320";
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

/* -------------------- */
/* MESSAGE RENDER */
/* -------------------- */

async function addMessage(msg, playSound = true) {
  const container = document.createElement("div");

  const time = new Date(msg.created_at);

  const header = document.createElement("div");

  header.innerHTML =
    `<b style="color:${msg.color}">
      ${msg.username}
    </b>
    <span style="color:#888;font-size:12px">
      ${time.toLocaleTimeString("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })}
    </span>`;
  container.appendChild(header);

  const body = document.createElement("div");

  for (const part of tokenizeMessage(msg.content)) {
    if (part.type === "text") {
      body.appendChild(
        document.createTextNode(part.value)
      );
    }

    if (part.type === "mention") {
      const m = document.createElement("span");
      m.textContent = "@" + part.value;
      m.style.color = "#4da6ff";
      body.appendChild(m);
    }

    if (part.type === "url") {
      const safe = safeURL(part.value);
      if (!safe) continue;

      body.appendChild(createLink(safe.href));

      if (isYouTube(safe.href)) {
        const e = createYouTubeEmbed(safe.href);
        if (e) body.appendChild(wrapEmbed(e));
      }

      if (isTenor(safe.href)) {
        const e = createTenorEmbed(safe.href);
        if (e) body.appendChild(wrapEmbed(e));
      }

      if (isImage(safe.href)) {
        body.appendChild(createImageEmbed(safe.href));
      }
    }
  }

  container.appendChild(body);
  messagesDiv.appendChild(container);

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* -------------------- */
/* EVENTS */
/* -------------------- */

logoutBtn.onclick = logout;

signupBtn.onclick = () =>
  signUp(
    emailInput.value,
    passwordInput.value,
    usernameInput.value
  );

loginBtn.onclick = () =>
  login(
    emailInput.value,
    passwordInput.value
  );

joinBtn.onclick = joinRoom;
sendBtn.onclick = sendMessage;

messageInput.onkeydown = e => {
  if (e.key === "Enter") sendMessage();
};

/* -------------------- */
/* INIT */
/* -------------------- */

(async () => {
  setStatus("Loading session...", "gray");

  const ok = await loadCurrentUser();

  await loadOpenRooms(); 

  updateAuthUI();

  if (ok) {
    setStatus("Session restored", "green");
  } else {
    setStatus("Not logged in", "orange");
  }
})();

supabaseClient
  .channel("rooms-live")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "rooms" },
    () => scheduleRoomReload()
  )
  .subscribe();