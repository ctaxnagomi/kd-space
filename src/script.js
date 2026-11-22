import './style.css'
import Experience from './Experience/Experience.js'

const enterBtn = document.querySelector('.intro-enter-btn')
const introScreen = document.querySelector('.intro-screen')
const nameInput = document.querySelector('.intro-name-input')

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

document.querySelectorAll('.area-btn').forEach((_button) =>
{
    _button.addEventListener('click', () =>
    {
        if(!window.experience || !window.experience.navigation) return

        const area = _button.dataset.area
        window.experience.navigation.focusArea(area)

        document.querySelectorAll('.area-btn').forEach((_other) =>
            _other.classList.toggle('active', _other === _button)
        )
    })
})

