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

const roomInput = document.getElementById("roomInput");
const emailInput =
  document.getElementById("emailInput");

const passwordInput =
  document.getElementById("passwordInput");

const usernameInput =
  document.getElementById("usernameInput");

  


const joinBtn = document.getElementById("joinBtn");

const signupBtn =
  document.getElementById("signupBtn");

const loginBtn =
  document.getElementById("loginBtn");

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

let currentUser = null;
let currentProfile = null;
let room = "";

let initialLoadDone = false;
let activeChannel = null;

/* -------------------- */
/* AUTH */
/* -------------------- */

async function signUp(
  email,
  password,
  username
) {

  const {
    data,
    error
  } =
    await supabaseClient.auth.signUp({
      email,
      password
    });

  if (error) {

    alert(error.message);

    return false;
  }

  if (!data.user) {

    alert(
      "Check your email to confirm signup."
    );

    return false;
  }

  const color =
    "#" +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0");

  const {
    error: profileError
  } =
    await supabaseClient
      .from("profiles")
      .insert([
        {
          id: data.user.id,
          username,
          color
        }
      ]);

  if (profileError) {

    alert(profileError.message);

    return false;
  }

  return true;
}

async function login(
  email,
  password
) {

  const { error } =
    await supabaseClient.auth
      .signInWithPassword({
        email,
        password
      });

  if (error) {

    alert(error.message);

    return false;
  }

  return true;
}

function updateAuthUI() {

  if (currentProfile) {

    loginBtn.style.display = "none";
    signupBtn.style.display = "none";

    emailInput.style.display = "none";
    passwordInput.style.display = "none";
    usernameInput.style.display = "none";
  }
}

/* -------------------- */
/* AUTH BUTTONS */
/* -------------------- */

signupBtn.addEventListener(
  "click",
  async () => {

    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value.trim();

    const username =
      usernameInput.value.trim();

    if (
      !email ||
      !password ||
      !username
    ) {

      alert(
        "Fill in all fields."
      );

      return;
    }

    const success =
      await signUp(
        email,
        password,
        username
      );

    if (success) {

      alert(
        "Account created."
      );
    }
  }
);

loginBtn.addEventListener(
  "click",
  async () => {

    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value.trim();

    if (
      !email ||
      !password
    ) {

      alert(
        "Fill in all fields."
      );

      return;
    }

    const success =
      await login(
        email,
        password
      );

    if (success) {

      alert(
        "Logged in."
      );
    }
  }
);

async function loadCurrentUser() {

  const {
    data: { user }
  } =
    await supabaseClient.auth.getUser();

  if (!user) {
    return false;
  }

  currentUser = user;

  const {
    data: profile,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

  if (error || !profile) {

    console.error(error);

    return false;
  }

  currentProfile = profile;
  updateAuthUI();
  return true;
}


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
async function createRoom(
  roomName
) {

  if (!currentUser) {
    return;
  }

  const {
    error
  } =
    await supabaseClient
      .from("rooms")
      .insert([
        {
          room_name:
            roomName,
          owner_id:
            currentUser.id
        }
      ]);

  if (error) {

    console.error(error);
  }
}

async function isRoomOwner(
  roomName
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("rooms")
      .select("*")
      .eq(
        "room_name",
        roomName
      )
      .single();

  if (error || !data) {
    return false;
  }

  return (
    data.owner_id ===
    currentUser.id
  );
}

async function joinRoom() {

  room =
    roomInput.value.trim();

  if (!room) {
    return;
  }

  const loaded =
    await loadCurrentUser();

  if (!loaded) {

    alert(
      "You must log in first."
    );

    return;
  }

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

  setupDiv.classList.add(
    "hidden"
  );

  chatDiv.classList.remove(
    "hidden"
  );

  await loadMessages();

  subscribeMessages();
}

/* -------------------- */
/* ENTER KEY SUPPORT */
/* -------------------- */

roomInput.addEventListener(
  "keydown",
  (e) => {

    if (e.key === "Enter") {
      joinRoom();
    }
  }
);

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

  if (content.length > 2000) {

  alert(
    "Message too long."
  );

  return;
  }

  if (!currentUser) {
    return;
  }

  const {
    error
  } =
    await supabaseClient
      .from("messages")
      .insert([
        {
          room,
          user_id:
            currentUser.id,
          username:
            currentProfile.username,
          color:
            currentProfile.color,
          content
        }
      ]);

  if (error) {

    console.error(error);

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

    for (const msg of data) {

      await addMessage(
        msg,
        false
      );
    }

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
          table: "messages",
          filter: `room=eq.${room}`
        },
        async (payload) => {

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
          await addMessage(
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

    let id = null;

    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1);
    }

    else if (u.pathname.includes("/shorts/")) {
      id = u.pathname.split("/shorts/")[1];
    }

    else if (u.pathname.includes("/embed/")) {
      id = u.pathname.split("/embed/")[1];
    }

    else {
      id = u.searchParams.get("v");
    }

    if (!id) return null;

    // only strip noise, do NOT validate length
    id = id.split("?")[0].split("&")[0].split("/")[0];

    return id;

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

  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

  iframe.loading = "lazy";

  iframe.style.border = "none";
  iframe.style.borderRadius = "10px";
  iframe.style.marginTop = "6px";
  iframe.style.display = "block";

  iframe.referrerPolicy =
    "strict-origin-when-cross-origin";

  return iframe;
}

/* -------------------- */
/* TENOR */
/* -------------------- */

function isTenor(url) {

  return (
    url.includes("tenor.com/view/")
  );
}

function createTenorEmbed(
  url
) {

  const match =
    url.match(/-(\d+)(\?.*)?$/);

  if (!match) {

    return null;
  }

  const gifId =
    match[1];

  const iframe =
    document.createElement(
      "iframe"
    );

  iframe.src =
    `https://tenor.com/embed/${gifId}`;

  iframe.width = "320";

  iframe.height = "320";

  iframe.loading =
    "lazy";

  iframe.style.border =
    "none";

  iframe.style.borderRadius =
    "10px";

  iframe.style.marginTop =
    "6px";

  iframe.style.display =
    "block";

  iframe.allowFullscreen =
    true;

  iframe.referrerPolicy =
    "strict-origin-when-cross-origin";

  return iframe;
}

/* -------------------- */
/* IMAGE */
/* -------------------- */

function isImage(url) {

  return /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i
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

async function addMessage(
  msg,
  playSound = true
) {

  try {

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

      try {

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

          try {

            const safe =
              safeURL(
                part.value
              );

            if (!safe) {
              continue;
            }

            // hyperlink first
            body.appendChild(
              createLink(
                safe.href
              )
            );

            // YouTube
            if (
              isYouTube(
                safe.href
              )
            ) {

              try {

                const embed =
                  createYouTubeEmbed(
                    safe.href
                  );

                body.appendChild(
                  embed
                );

              } catch (err) {

                console.error(
                  "YouTube embed failed:",
                  err
                );
              }

              continue;
            }

            // Tenor
            if (
              isTenor(
                safe.href
              )
            ) {

              try {

                const embed =
                  createTenorEmbed(
                    safe.href
                  );

                if (embed) {

                  body.appendChild(
                    embed
                  );
                }

              } catch (err) {

                console.error(
                  "Tenor embed failed:",
                  err
                );
              }

              continue;
            }

            // Images
            if (
              isImage(
                safe.href
              )
            ) {

              try {

                body.appendChild(
                  createImageEmbed(
                    safe.href
                  )
                );

              } catch (err) {

                console.error(
                  "Image embed failed:",
                  err
                );
              }

              continue;
            }

          } catch (err) {

            console.error(
              "Message part failed:",
              err
            );
          }
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

      } catch (err) {

        console.error(
          "Message part failed:",
          err,
          part
        );
      }
    }

    container.appendChild(
      body
    );

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

  } catch (err) {

    console.error(
      "addMessage failed:",
      err,
      msg
    );
  }
}
/* -------------------- */
/* AUTO LOGIN */
/* -------------------- */

(async () => {

  const loaded =
    await loadCurrentUser();
  const {
    data: existingRoom
  } = await supabaseClient
    .from("rooms")
    .select("*")
    .eq("room_name", room)
    .single();

  if (!existingRoom) {

    await createRoom(room);
  }
  if (loaded) {

    console.log(
      "Logged in as",
      currentProfile.username
    );
  }
})();
