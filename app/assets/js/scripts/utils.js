function openSettings() {
    switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
        let realId = currentSettingsView.replace('#','')
        document.getElementById('nav'+realId).setAttribute('selected', true)
        document.getElementById(realId).style=""
    })
}
function closeSettings() {
    switchView(getCurrentView(), VIEWS.landing, 500, 500, () => {
        let realId = currentSettingsView.replace('#','')
        document.getElementById(realId).style="display: none;"
        document.getElementById('nav'+realId).setAttribute('selected', true)
    })
}

const authorized = {
    "launchGame()": launchGame,
    "loginWithMicrosoft()": loginWithMicrosoft,
    "disconnect()": disconnect,
    "openSettings()": openSettings,
    "closeSettings()": closeSettings,
    "openJavaExeDialog()": openJavaExeDialog,
    "openLauncherRepositoryDialog()": openLauncherRepositoryDialog
}

function setActions() {
    let actionContainers = document.querySelectorAll('[action]')
    for(let container of actionContainers) {
        container.addEventListener('click', () => {
            try {
                authorized[container.getAttribute('action')]()
            } catch(e) {
                console.log(e)
            }
        })
    }
    let goSettingsButtons = document.querySelectorAll('[goSettings]')
    for(let button of goSettingsButtons) {
        button.addEventListener('click', () => {
            switchSettingsView(currentSettingsView, SETTINGS_VIEWS[button.getAttribute('goSettings')], 150, 150)
        })
    }

    let inputs = document.querySelectorAll('input')
    for(let input of inputs) {
        input.addEventListener('input', () => {
            saveSettingsValues()
            initSettingsValues()
        })
    }
    let toggles = document.querySelectorAll('.toggle')
    for(let toggle of toggles) {
        toggle.addEventListener('click', (e) => {
            if(e.currentTarget.getAttribute('disabled') != null)return;
            if(e.currentTarget.getAttribute('value') === 'true') {
                e.currentTarget.setAttribute('value', false)
            } else {
                e.currentTarget.setAttribute('value', true)
            }
            saveSettingsValues()
            initSettingsValues()
        })
    }
}
setActions()

let VIEWS = {
    "loading": "#loading"
}
if(document.getElementById('main')) {
    for(let c of document.getElementById('main').childNodes) {
        if(c.id) VIEWS[c.id] = `#${c.id}`
    }
}
let SETTINGS_VIEWS = {}
if(document.getElementById('main_settings')) {
    for(let c of document.getElementById('main_settings').childNodes) {
        if(c.id) SETTINGS_VIEWS[c.id.replace('settings_', '')] = `#${c.id}`
    }
}
let currentSettingsView = SETTINGS_VIEWS[Object.keys(SETTINGS_VIEWS)[0]]