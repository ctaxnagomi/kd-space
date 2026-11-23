import './style.css'
import Experience from './Experience/Experience.js'

const enterBtn = document.querySelector('.intro-enter-btn')
const introScreen = document.querySelector('.intro-screen')
const nameInput = document.querySelector('.intro-name-input')
const introRoomNote = document.querySelector('.intro-room-note')

// Capture the incoming room id before Social.syncUrl() adds one to a plain visit.
const roomParam = new URLSearchParams(window.location.search).get('space')
const sharedRoomId = roomParam && /^[a-z0-9]{4,12}$/i.test(roomParam)
    ? roomParam.toLowerCase()
    : null

function readJson(_key)
{
    try
    {
        return JSON.parse(localStorage.getItem(_key) || 'null')
    }
    catch(_error)
    {
        return null
    }
}

function renderIntroRoomNote()
{
    if(!introRoomNote || !sharedRoomId) return

    const spaces = readJson('kd-space-space-v1')
    const identity = readJson('kd-space-identity-v1')
    const space = spaces && spaces.spaces && spaces.spaces[sharedRoomId]
    if(!space) return

    const ownerName = (typeof space.ownerName === 'string' && space.ownerName.trim())
        || (identity && space.ownerId === identity.id && identity.name)
        || space.name

    if(!ownerName) return

    introRoomNote.textContent = `you are about to enter ${String(ownerName).trim().slice(0, 24)} Room`
    introRoomNote.classList.add('visible')
    introScreen.classList.add('has-room-note')
}

renderIntroRoomNote()

enterBtn.addEventListener('click', () =>
{
    const name = nameInput ? nameInput.value.trim().slice(0, 24) : ''
    if(name)
    {
        try
        {
            localStorage.setItem('kd-space-pending-name', name)
        }
        catch(_error)
        {
            // Storage may be blocked; the room still works with a guest name.
        }
    }

    introScreen.classList.add('hidden')
    document.body.classList.add('room-entered')

    if(!window.experience)
    {
        window.experience = new Experience({
            targetElement: document.querySelector('.experience')
        })
    }
})

