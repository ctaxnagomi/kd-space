import * as THREE from 'three'
import Experience from './Experience.js'
import Baked from './Baked.js'
import GoogleLeds from './GoogleLeds.js'
import LoupedeckButtons from './LoupedeckButtons.js'
import CoffeeSteam from './CoffeeSteam.js'
import TopChair from './TopChair.js'
import ElgatoLight from './ElgatoLight.js'
import BouncingLogo from './BouncingLogo.js'
import Screen from './Screen.js'
import DeskPlant from './DeskPlant.js'
import DeskLamp from './DeskLamp.js'
import { DEFAULT_YOUTUBE_URL, DEFAULT_SITE_URL } from './Screen.js'

export default class World
{
    constructor(_options)
    {
        this.experience = new Experience()
        this.config = this.experience.config
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.screenSettingsKey = 'kd-space-screen-settings-v1'
        this.screenSettings = this.loadScreenSettings()

        this.resources.on('groupEnd', (_group) =>
        {
            if(_group.name === 'base')
            {
                this.setBaked()
                this.setGoogleLeds()
                this.setLoupedeckButtons()
                this.setCoffeeSteam()
                this.setTopChair()
                this.setElgatoLight()
                this.setBouncingLogo()
                this.setScreens()
                this.setDeskPlant()
                this.setDeskLamp()
            }
        })
    }

    setBaked()
    {
        this.baked = new Baked()
    }

    setGoogleLeds()
    {
        this.googleLeds = new GoogleLeds()
    }

    setLoupedeckButtons()
    {
        this.loupedeckButtons = new LoupedeckButtons()
    }

    setCoffeeSteam()
    {
        this.coffeeSteam = new CoffeeSteam()
    }

    setTopChair()
    {
        this.topChair = new TopChair()
    }

    setElgatoLight()
    {
        this.elgatoLight = new ElgatoLight()
    }

    setBouncingLogo()
    {
        this.bouncingLogo = new BouncingLogo()
    }

    setDeskPlant()
    {
        this.deskPlant = new DeskPlant()
    }

    setDeskLamp()
    {
        this.deskLamp = new DeskLamp()
    }

    setScreens()
    {
        this.pcScreen = new Screen(
            this.resources.items.pcScreenModel.scene.children[0],
            '/assets/videoPortfolio.mp4',
            this.screenSettings.monitor,
            'monitor'
        )
        this.macScreen = new Screen(
            this.resources.items.macScreenModel.scene.children[0],
            '/assets/videoStream.mp4',
            this.screenSettings.laptop,
            'laptop'
        )
        this.applyScreenSettings(this.screenSettings)
    }

    loadScreenSettings()
    {
        const defaults = {
            monitor: { mode: 'site', youtubeUrl: DEFAULT_YOUTUBE_URL, siteUrl: DEFAULT_SITE_URL },
            laptop: { mode: 'youtube', youtubeUrl: DEFAULT_YOUTUBE_URL, siteUrl: DEFAULT_SITE_URL }
        }

        try
        {
            const json = localStorage.getItem(this.screenSettingsKey)
            if(!json) return defaults

            const stored = JSON.parse(json)
            for(const key of ['monitor', 'laptop'])
            {
                if(!stored || !stored[key]) continue
                if(stored[key].mode) defaults[key].mode = stored[key].mode
                if(stored[key].youtubeUrl) defaults[key].youtubeUrl = stored[key].youtubeUrl
                if(stored[key].siteUrl) defaults[key].siteUrl = stored[key].siteUrl
            }
        }
        catch(_error)
        {
            console.error('KD Space: could not read screen settings', _error)
        }

        return defaults
    }

    getScreen(_key)
    {
        return _key === 'laptop' ? this.macScreen : this.pcScreen
    }

    applyScreenSettings(_settings)
    {
        if(!_settings) return

        for(const key of ['monitor', 'laptop'])
        {
            if(!_settings[key]) continue
            const screen = this.getScreen(key)
            if(!screen) continue

            for(const setting of ['mode', 'youtubeUrl', 'siteUrl'])
            {
                if(_settings[key][setting]) screen.setSetting(setting, _settings[key][setting])
            }
        }

        this.screenSettings = this.getScreenSettings()
    }

    getScreenSettings()
    {
        return {
            monitor: this.pcScreen ? this.pcScreen.getSettings() : this.screenSettings.monitor,
            laptop: this.macScreen ? this.macScreen.getSettings() : this.screenSettings.laptop
        }
    }

    updateScreenSetting(_key, _setting, _value)
    {
        // Keep the stored value even if the models have not finished loading yet.
        if(!this.screenSettings[_key]) this.screenSettings[_key] = {}
        this.screenSettings[_key][_setting] = _value

        const screen = this.getScreen(_key)
        if(screen) screen.setSetting(_setting, _value)
        this.saveScreenSettings()
    }

    saveScreenSettings()
    {
        this.screenSettings = this.getScreenSettings()
        try
        {
            localStorage.setItem(this.screenSettingsKey, JSON.stringify(this.screenSettings))
        }
        catch(_error)
        {
            console.error('KD Space: could not save screen settings', _error)
        }
    }

    resize()
    {
    }

    update()
    {
        if(this.googleLeds)
            this.googleLeds.update()

        if(this.loupedeckButtons)
            this.loupedeckButtons.update()

        if(this.coffeeSteam)
            this.coffeeSteam.update()

        if(this.topChair)
            this.topChair.update()

        if(this.bouncingLogo)
            this.bouncingLogo.update()

        if(this.pcScreen) this.pcScreen.update()
        if(this.macScreen) this.macScreen.update()
    }

    destroy()
    {
    }
}