const SUPABASE_URL = "https://kbpcgdsfqosgeoaanghf.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticGNnZHNmcW9zZ2VvYWFuZ2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ0NDEsImV4cCI6MjA5NDMyMDQ0MX0.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujg.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticGNnZHNmcW9zZ2VvYWFuZ2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ0NDEsImV4cCI6MjA5NDMyMDQ0MX0.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujgle_BO_TCPEqe9YYw6BZpBmyZA_Hs2qFDE6"

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

  const { data, error } = await supabaseClient
    .from("messages")
    .insert({
      room: currentRoom,
      username: localStorage.getItem("chat_name"),
      color: localStorage.getItem("chat_color"),
      content: content
    })

  if (error) {
    console.log("Insert error:", error)
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
    console.log("Select error:", error)
    return
  }

  if (!data) {
    console.log("No data returned")
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
}.rAZYev_j43ADqXw3jnXakxZFH0MwTP5S9-t3vbzhujgle_BO_TCPEqe9YYw6BZpBmyZA_Hs2qFDE6"

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
    const { data, error } = await supabaseClient
      .from("messages")
      .insert({
        room: currentRoom,
        username: localStorage.getItem("chat_name"),
        color: localStorage.getItem("chat_color"),
        content: content
  })

    if (error) {
      console.log(error)
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
    console.log("Select error:", error)
    return
  }

  if (!data) {
    console.log("No data returned")
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