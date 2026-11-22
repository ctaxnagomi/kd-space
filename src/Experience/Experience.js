import * as THREE from 'three'
import { Pane } from 'tweakpane'

import Time from './Utils/Time.js'
import Sizes from './Utils/Sizes.js'
import Stats from './Utils/Stats.js'

import Resources from './Resources.js'
import Renderer from './Renderer.js'
import Camera from './Camera.js'
import World from './World.js'
import Navigation from './Navigation.js'
import Studio from './Studio.js'
import Social from './Social.js'
import MediaPanel from './MediaPanel.js'
import Interactive from './Interactive.js'
import ProfileChip from './ProfileChip.js'
import Presence from './Presence.js'
import PresenceUI from './PresenceUI.js'
import Messaging from './Messaging.js'
import MessagingUI from './MessagingUI.js'
import ScreenCapture from './ScreenCapture.js'
import ScrollSync from './ScrollSync.js'
import ModelTransfer from './ModelTransfer.js'
import FloatingNav from './FloatingNav.js'

import assets from './assets.js'

export default class Experience
{
    static instance

    constructor(_options = {})
    {
        if(Experience.instance)
        {
            return Experience.instance
        }
        Experience.instance = this

        // Options
        this.targetElement = _options.targetElement

        if(!this.targetElement)
        {
            console.warn('Missing \'targetElement\' property')
            return
        }

        this.time = new Time()
        this.sizes = new Sizes()
        this.setSocial()
        this.setConfig()
        this.setStats()
        this.setDebug()
        this.setScene()
        this.setCamera()
        this.setRenderer()
        this.setResources()
        this.setWorld()
        this.setNavigation()
        this.setStudio()
        this.setMedia()
        this.setScreenCapture()
        this.setScrollSync()
        this.setProfileChip()
        this.setPresence()
        this.setModelTransfer()
        this.setMessaging()
        this.setFloatingNav()

        this.sizes.on('resize', () =>
        {
            this.resize()
        })

        this.update()
    }

    // static getInstance(_options = {})
    // {
    //     console.log(Experience.instance)
    //     if(Experience.instance)
    //     {
    //         return Experience.instance
    //     }
        
    //     console.log('create')
    //     Experience.instance = new Experience(_options)
        
    //     return Experience.instance
    // }

    setConfig()
    {
        this.config = {}
    
        // Pixel ratio
        this.config.pixelRatio = Math.min(Math.max(window.devicePixelRatio, 1), 2)

        // Width and height
        const boundings = this.targetElement.getBoundingClientRect()
        this.config.width = boundings.width
        this.config.height = boundings.height || window.innerHeight
        this.config.smallestSide = Math.min(this.config.width, this.config.height)
        this.config.largestSide = Math.max(this.config.width, this.config.height)
        
        // Debug
        // this.config.debug = window.location.hash === '#debug'
        this.config.debug = this.config.width > 420
    }

    setStats()
    {
        if(this.config.debug)
        {
            this.stats = new Stats(true)
        }
    }

    setDebug()
    {
        if(this.config.debug)
        {
            this.debug = new Pane()
            this.debug.containerElem_.style.width = '320px'
        }
    }
    
    setScene()
    {
        this.scene = new THREE.Scene()
    }

    setCamera()
    {
        this.camera = new Camera()
    }

    setRenderer()
    {
        this.renderer = new Renderer({ rendererInstance: this.rendererInstance })

        this.targetElement.appendChild(this.renderer.instance.domElement)
    }

    setResources()
    {
        this.resources = new Resources(assets)
    }

    setWorld()
    {
        this.world = new World()
    }

    setNavigation()
    {
        this.navigation = new Navigation()
    }

    setStudio()
    {
        this.studio = new Studio()
    }

    setSocial()
    {
        this.social = new Social()
    }

    setMedia()
    {
        this.mediaPanel = new MediaPanel()
        this.interactive = new Interactive()
    }

    setScreenCapture()
    {
        this.screenCapture = new ScreenCapture()
    }

    setScrollSync()
    {
        this.scrollSync = new ScrollSync()
    }

    setProfileChip()
    {
        this.profileChip = new ProfileChip()
    }

    setPresence()
    {
        this.presence = new Presence(this.social)
        this.presenceUI = new PresenceUI()
    }

    setModelTransfer()
    {
        this.modelTransfer = new ModelTransfer(this.studio)
    }

    setMessaging()
    {
        this.messaging = new Messaging(this.presence)
        this.messagingUI = new MessagingUI()
    }

    setFloatingNav()
    {
        this.floatingNav = new FloatingNav()
    }

    update()
    {
        if(this.stats)
            this.stats.update()
        
        this.camera.update()
        
        if(this.renderer)
            this.renderer.update()

        if(this.world)
            this.world.update()

        if(this.navigation)
            this.navigation.update()

        if(this.studio)
            this.studio.update()

        if(this.interactive)
            this.interactive.update()

        if(this.screenCapture)
            this.screenCapture.render()

        window.requestAnimationFrame(() =>
        {
            this.update()
        })
    }

    resize()
    {
        // Config
        const boundings = this.targetElement.getBoundingClientRect()
        this.config.width = boundings.width
        this.config.height = boundings.height
        this.config.smallestSide = Math.min(this.config.width, this.config.height)
        this.config.largestSide = Math.max(this.config.width, this.config.height)

        this.config.pixelRatio = Math.min(Math.max(window.devicePixelRatio, 1), 2)

        if(this.camera)
            this.camera.resize()

        if(this.renderer)
            this.renderer.resize()

        if(this.world)
            this.world.resize()
    }

    destroy()
    {
        
    }
}
