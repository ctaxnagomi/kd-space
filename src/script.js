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

    if(!window.experience)
    {
        window.experience = new Experience({
            targetElement: document.querySelector('.experience')
        })
    }
})

