import './style.css'
import Experience from './Experience/Experience.js'

const enterBtn = document.querySelector('.intro-enter-btn')
const introScreen = document.querySelector('.intro-screen')

enterBtn.addEventListener('click', () =>
{
    introScreen.classList.add('hidden')

    if(!window.experience)
    {
        window.experience = new Experience({
            targetElement: document.querySelector('.experience')
        })
    }
})

