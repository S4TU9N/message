const SUPABASE_URL =
  "https://kbpcgdsfqosgeoaanghf.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticGNnZHNmcW9zZ2VvYWFuZ2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ0NDEsImV4cCI6MjA5NDMyMDQ0MX0.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujg";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* -------------------- */
/* ELEMENTS */
/* -------------------- */

const setupDiv = document.getElementById("setup");
const chatDiv = document.getElementById("chat");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const passwordInput = document.getElementById("passwordInput");
const colorInput = document.getElementById("colorInput");

const joinBtn = document.getElementById("joinBtn");

const messagesDiv = document.getElementById("messages");

const messageInput =
  document.getElementById("messageInput");

const sendBtn =
  document.getElementById("sendBtn");

const messageSound =
  new Audio("ping.mp3");

/* -------------------- */
/* STATE */
/* -------------------- */

let username = "";
let room = "";
let userColor = "";

let initialLoadDone = false;
let activeChannel = null;

/* -------------------- */
/* LOAD SAVED INFO */
/* -------------------- */

nameInput.value =
  localStorage.getItem("chat_name") || "";

const savedColor =
  localStorage.getItem("chat_color");

if (savedColor) {

  userColor = savedColor;

} else {

  userColor =
    "#" +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0");

  localStorage.setItem(
    "chat_color",
    userColor
  );
}

colorInput.value = userColor;

/* -------------------- */
/* ROOM FROM URL */
/* -------------------- */

const params =
  new URLSearchParams(window.location.search);

if (params.get("room")) {

  roomInput.value =
    params.get("room");
}

/* -------------------- */
/* JOIN ROOM */
/* -------------------- */

joinBtn.addEventListener(
  "click",
  joinRoom
);

async function joinRoom() {

  username =
    nameInput.value.trim();

  room =
    roomInput.value.trim();

  userColor =
    colorInput.value;

  if (!username || !room) {
    return;
  }

  localStorage.setItem(
    "chat_name",
    username
  );

  localStorage.setItem(
    "chat_color",
    userColor
  );

  const newUrl =
    window.location.origin +
    window.location.pathname +
    "?room=" +
    encodeURIComponent(room);

  history.replaceState(
    {},
    "",
    newUrl
  );

  setupDiv.classList.add("hidden");

  chatDiv.classList.remove("hidden");

  await loadMessages();

  subscribeMessages();
}

/* -------------------- */
/* ENTER KEY SUPPORT */
/* -------------------- */

[nameInput, roomInput].forEach(input => {

  input.addEventListener(
    "keydown",
    (e) => {

      if (e.key === "Enter") {
        joinRoom();
      }
    }
  );
});

messageInput.addEventListener(
  "keydown",
  (e) => {

    if (e.key === "Enter") {
      sendMessage();
    }
  }
);

/* -------------------- */
/* SEND MESSAGE */
/* -------------------- */

sendBtn.addEventListener(
  "click",
  sendMessage
);

async function sendMessage() {

  const content =
    messageInput.value.trim();

  if (!content) {
    return;
  }

  await supabaseClient
    .from("messages")
    .insert([
      {
        room,
        username,
        content,
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

  const cutoff =
    new Date(
      Date.now() - 15 * 60 * 1000
    ).toISOString();

  const { data, error } =
    await supabaseClient
      .from("messages")
      .select("*")
      .eq("room", room)
      .gt("created_at", cutoff)
      .order(
        "created_at",
        { ascending: true }
      );

  if (error) {

    console.error(error);

    return;
  }

  data.forEach(msg => {

    addMessage(msg, false);
  });

  initialLoadDone = true;
}

/* -------------------- */
/* REALTIME */
/* -------------------- */

function subscribeMessages() {

  if (activeChannel) {

    supabaseClient.removeChannel(
      activeChannel
    );
  }

  activeChannel =
    supabaseClient
      .channel("chat-" + room)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        (payload) => {

          const msg = payload.new;

          if (msg.room !== room) {
            return;
          }

          const msgTime =
            new Date(
              msg.created_at
            ).getTime();

          if (
            Date.now() - msgTime >
            15 * 60 * 1000
          ) {
            return;
          }

          addMessage(
            msg,
            initialLoadDone
          );
        }
      )
      .subscribe();
}

/* -------------------- */
/* TOKENIZER */
/* -------------------- */

function tokenizeMessage(text) {

  const tokens = [];

  const regex =
    /(https?:\/\/[^\s]+)|@([a-zA-Z0-9_]+)/g;

  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {

    const index = match.index;

    if (index > lastIndex) {

      tokens.push({
        type: "text",
        value: text.slice(
          lastIndex,
          index
        )
      });
    }

    if (match[1]) {

      tokens.push({
        type: "url",
        value: match[1]
      });

    } else if (match[2]) {

      tokens.push({
        type: "mention",
        value: match[2]
      });
    }

    lastIndex =
      index + match[0].length;
  }

  if (lastIndex < text.length) {

    tokens.push({
      type: "text",
      value: text.slice(lastIndex)
    });
  }

  return tokens;
}

/* -------------------- */
/* URL HELPERS */
/* -------------------- */

function safeURL(url) {

  try {

    const parsed =
      new URL(url);

    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    ) {
      return parsed;
    }

    return null;

  } catch {

    return null;
  }
}

/* -------------------- */
/* YOUTUBE */
/* -------------------- */

function isYouTube(url) {

  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be")
  );
}

function getYouTubeID(url) {

  try {

    const u = new URL(url);

    // youtu.be/abc
    if (
      u.hostname.includes(
        "youtu.be"
      )
    ) {

      return u.pathname
        .split("/")[1];
    }

    // youtube shorts
    if (
      u.pathname.includes(
        "/shorts/"
      )
    ) {

      return u.pathname
        .split("/shorts/")[1]
        ?.split("/")[0];
    }

    // watch?v=
    if (
      u.searchParams.get("v")
    ) {

      return u.searchParams.get("v");
    }

    // embed/
    if (
      u.pathname.includes(
        "/embed/"
      )
    ) {

      return u.pathname
        .split("/embed/")[1]
        ?.split("/")[0];
    }

    return null;

  } catch {

    return null;
  }
}

function createYouTubeEmbed(url) {

  const id =
    getYouTubeID(url);

  if (!id) {

    return createLink(url);
  }

  const iframe =
    document.createElement(
      "iframe"
    );

  iframe.src =
    `https://www.youtube.com/embed/${encodeURIComponent(id)}`;

  iframe.width = "320";
  iframe.height = "180";

  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

  iframe.allowFullscreen = true;

  iframe.loading = "lazy";

  iframe.referrerPolicy =
    "strict-origin-when-cross-origin";

  iframe.style.border = "none";
  iframe.style.borderRadius = "10px";
  iframe.style.marginTop = "6px";
  iframe.style.display = "block";

  return iframe;
}

/* -------------------- */
/* TENOR */
/* -------------------- */

function isTenor(url) {

  return url.includes("tenor.com");
}

function createTenorEmbed(url) {

  const safe =
    safeURL(url);

  if (!safe) {

    return createLink(url);
  }

  const iframe =
    document.createElement(
      "iframe"
    );

  iframe.src = safe.href;

  iframe.width = "320";
  iframe.height = "320";

  iframe.loading = "lazy";

  iframe.style.border = "none";
  iframe.style.borderRadius = "10px";
  iframe.style.marginTop = "6px";
  iframe.style.display = "block";

  return iframe;
}

/* -------------------- */
/* IMAGE */
/* -------------------- */

function isImage(url) {

  return /\.(png|jpg|jpeg|gif|webp)$/i
    .test(url);
}

function createImageEmbed(url) {

  const img =
    document.createElement(
      "img"
    );

  img.src = url;

  img.loading = "lazy";

  img.style.maxWidth = "300px";
  img.style.borderRadius = "10px";
  img.style.marginTop = "6px";
  img.style.display = "block";

  return img;
}

/* -------------------- */
/* NORMAL LINK */
/* -------------------- */

function createLink(url) {

  const a =
    document.createElement("a");

  a.href = url;

  a.textContent = url;

  a.target = "_blank";

  a.rel =
    "noopener noreferrer";

  a.style.color =
    "#6ea8ff";

  return a;
}

/* -------------------- */
/* ADD MESSAGE */
/* -------------------- */

function addMessage(
  msg,
  playSound = true
) {

  const container =
    document.createElement(
      "div"
    );

  container.style.marginBottom =
    "10px";

  /* HEADER */

  const time =
    new Date(msg.created_at);

  const hh =
    time
      .getHours()
      .toString()
      .padStart(2, "0");

  const mm =
    time
      .getMinutes()
      .toString()
      .padStart(2, "0");

  const name =
    document.createElement(
      "span"
    );

  name.style.color =
    msg.color;

  name.textContent =
    msg.username;

  const timeSpan =
    document.createElement(
      "span"
    );

  timeSpan.style.color =
    "gray";

  timeSpan.textContent =
    ` [${hh}:${mm}]: `;

  container.appendChild(name);

  container.appendChild(
    timeSpan
  );

  /* BODY */

  const body =
    document.createElement(
      "span"
    );

  const parts =
    tokenizeMessage(
      msg.content
    );

  for (const part of parts) {

    // TEXT
    if (
      part.type === "text"
    ) {

      body.appendChild(
        document.createTextNode(
          part.value
        )
      );
    }

    // URL
    else if (
      part.type === "url"
    ) {

      const safe =
        safeURL(
          part.value
        );

      if (!safe) {
        continue;
      }

      // YouTube
      if (
        isYouTube(
          safe.href
        )
      ) {

        body.appendChild(
          createYouTubeEmbed(
            safe.href
          )
        );

        continue;
      }

      // Tenor
      if (
        isTenor(
          safe.href
        )
      ) {

        body.appendChild(
          createTenorEmbed(
            safe.href
          )
        );

        continue;
      }

      // Images
      if (
        isImage(
          safe.href
        )
      ) {

        body.appendChild(
          createImageEmbed(
            safe.href
          )
        );

        continue;
      }

      // Normal links
      body.appendChild(
        createLink(
          safe.href
        )
      );
    }

    // MENTION
    else if (
      part.type ===
      "mention"
    ) {

      const mention =
        document.createElement(
          "span"
        );

      mention.textContent =
        "@" + part.value;

      mention.style.fontWeight =
        "bold";

      mention.style.color =
        "#644dff";

      body.appendChild(
        mention
      );
    }
  }

  container.appendChild(body);

  messagesDiv.appendChild(
    container
  );

  messagesDiv.scrollTop =
    messagesDiv.scrollHeight;

  /* SOUND */

  if (
    playSound &&
    document.visibilityState !==
      "visible"
  ) {

    messageSound.currentTime = 0;

    messageSound
      .play()
      .catch(() => {});
  }
}