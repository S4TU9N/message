const SUPABASE_URL = "https://kbpcgdsfqosgeoaanghf.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_BO_TCPEqe9YYw6BZpBmyZA_Hs2qFDE6"

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)

const joinBtn = document.getElementById("joinBtn")
const sendBtn = document.getElementById("sendBtn")

const setupDiv = document.getElementById("setup")
const chatDiv = document.getElementById("chat")

const messagesDiv = document.getElementById("messages")

const nameInput = document.getElementById("nameInput")
const colorInput = document.getElementById("colorInput")
const roomInput = document.getElementById("roomInput")
const passwordInput = document.getElementById("passwordInput")

const messageInput = document.getElementById("messageInput")

let currentRoom = null

joinBtn.onclick = async () => {

  const username = nameInput.value.trim()
  const color = colorInput.value
  const room = roomInput.value.trim()

  if (!username || !room) return

  localStorage.setItem("chat_name", username)
  localStorage.setItem("chat_color", color)

  currentRoom = room

  setupDiv.classList.add("hidden")
  chatDiv.classList.remove("hidden")

  loadMessages()
  subscribeToMessages()
}

sendBtn.onclick = async () => {

  const content = messageInput.value.trim()

  if (!content) return

  await supabaseClient
    .from("messages")
    .insert({
      room: currentRoom,
      username: localStorage.getItem("chat_name"),
      color: localStorage.getItem("chat_color"),
      content: content
    })

  messageInput.value = ""
}

async function loadMessages() {

  messagesDiv.innerHTML = ""

  const { data } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("room", currentRoom)
    .order("id", { ascending: true })

  data.forEach(addMessage)
}

function addMessage(msg) {

  const div = document.createElement("div")

  div.className = "message"

  div.innerHTML = `
    <span style="color:${msg.color}">
      ${msg.username}
    </span>:
    ${msg.content}
  `

  messagesDiv.appendChild(div)

  messagesDiv.scrollTop = messagesDiv.scrollHeight
}

function subscribeToMessages() {

  supabaseClient
    .channel("chat-room")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      payload => {

        if (payload.new.room === currentRoom) {
          addMessage(payload.new)
        }
      }
    )
    .subscribe()
}