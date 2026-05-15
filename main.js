const SUPABASE_URL = "https://kbpcgdsfqosgeoaanghf.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticGNnZHNmcW9zZ2VvYWFuZ2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ0NDEsImV4cCI6MjA5NDMyMDQ0MX0.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujg"

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
const params = new URLSearchParams(window.location.search)
const roomFromURL = params.get("room")

if (roomFromURL) {
  roomInput.value = roomFromURL
}

const passwordInput = document.getElementById("passwordInput")
const savedName = localStorage.getItem("username")
const savedColor = localStorage.getItem("color")


const messageInput = document.getElementById("messageInput")

let currentRoom = null
let username = ""
let color = ""

if (savedName) nameInput.value = savedName
if (savedColor) colorInput.value = savedColor

joinBtn.onclick = async () => {
  username = nameInput.value.trim()
  color = colorInput.value
  localStorage.setItem("username", username)
  localStorage.setItem("color", color)
  const room = roomInput.value.trim()

  if (!username || !room) return

  currentRoom = room
  const newURL = `${window.location.pathname}?room=${encodeURIComponent(room)}`
  window.history.replaceState({}, "", newURL)

  setupDiv.classList.add("hidden")
  chatDiv.classList.remove("hidden")

  loadMessages()
  subscribeToMessages()
}

sendBtn.onclick = async () => {
  const content = messageInput.value.trim()
  if (!content) return

  const { error } = await supabaseClient
    .from("messages")
    .insert({
      room: currentRoom,
      username,
      color,
      content
    })

  if (error) {
    addMessage({
      username: "SYSTEM",
      color: "red",
      content: "Send failed: " + error.message
    })
    return
  }

  messageInput.value = ""
}

async function loadMessages() {
  messagesDiv.innerHTML = ""

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("room", currentRoom)
    .order("id", { ascending: true })

  if (error) {
    addMessage({
      username: "SYSTEM",
      color: "red",
      content: "Load failed: " + error.message
    })
    return
  }

  data.forEach(addMessage)
}

function addMessage(msg) {
  const div = document.createElement("div")
  div.className = "message"

  div.innerHTML = `
    <span style="color:${msg.color}">
      ${msg.username}
    </span>: ${msg.content}
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
      (payload) => {
        if (payload.new.room === currentRoom) {
          addMessage(payload.new)
        }
      }
    )
    .subscribe()
}