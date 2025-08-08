/**
 * Load configuration values onto the UI. This is an automated process.
 */
async function initSettingsValues(onStart = false) {
    const sEls = document.querySelectorAll('[settingValue]')

    for(const v of sEls) {
        const cVal = v.getAttribute('settingValue')
        const serverDependent = v.hasAttribute('serverDependent') // Means the first argument is the server id.
        const gFn = ConfigManager['get' + cVal]
        const gFnOpts = []
        if(serverDependent) {
            gFnOpts.push(ConfigManager.getSelectedServer())
        }
        if(typeof gFn === 'function') {
            if(v.tagName === 'INPUT') {
                if(v.type === 'number' || v.type === 'text') {
                    // Special Conditions
                    if(cVal === 'JavaExecutable') {
                        v.value = gFn.apply(null, gFnOpts)
                    } else if (cVal === 'DataDirectory') {
                        let gFnOpts = []
                        v.value = gFn.apply(null, gFnOpts)
                    } else if(cVal === 'JVMOptions') {
                        v.value = gFn.apply(null, gFnOpts).join(' ')
                    } else {
                        v.value = gFn.apply(null, gFnOpts)
                    }
                } else if(v.type === 'range') {
                    if(cVal === 'MinRAM' || cVal === 'MaxRAM') {
                        let val = gFn.apply(null, gFnOpts)
                        let realVal = val.substring(0, val.length-1)
                        if(val.endsWith('M')) {
                            val = Math.floor(parseInt(realVal)/1024*10)/10
                        } else {
                            val = Math.floor(parseFloat(realVal)*10)/10
                        }
                        v.value = val
                        if(onStart) {
                            const server = (await DistroAPI.getDistribution()).getServerById(ConfigManager.getSelectedServer())
                            const SETTINGS_MAX_MEMORY = ConfigManager.getAbsoluteMaxRAM(server.rawServer.javaOptions?.ram)
                            const SETTINGS_MIN_MEMORY = ConfigManager.getAbsoluteMinRAM(server.rawServer.javaOptions?.ram)
                            v.min = SETTINGS_MIN_MEMORY
                            v.max = SETTINGS_MAX_MEMORY
                        }
                    }
                }
            } else if(v.tagName === 'DIV' || v.tagName === 'SPAN') {
                if(v.tagName === 'DIV') {
                    if(v.classList.contains('toggle')) {
                        v.setAttribute('value', gFn.apply(null, gFnOpts))
                    }
                }
                if(cVal === 'MinRAM' || cVal === 'MaxRAM') {
                    let val = gFn.apply(null, gFnOpts)
                    let realVal = val.substring(0, val.length-1)
                    if(val.endsWith('M')) {
                        val = Math.floor(parseInt(realVal)/1024*10)/10
                    } else {
                        val = Math.floor(parseFloat(realVal)*10)/10
                    }
                    v.innerText = val
                }
            }
        }
    }
}


/**
 * Save the settings values.
 */
function saveSettingsValues() {
    const sEls = document.querySelectorAll('[settingValue]')
    let serverId = ConfigManager.getSelectedServer()
    let oldMinRAM = ConfigManager.getMinRAM(serverId)
    oldMinRAM = parseInt(oldMinRAM.substring(0,oldMinRAM.length-1))
    let oldMaxRAM = ConfigManager.getMaxRAM(serverId)
    oldMaxRAM = parseInt(oldMaxRAM.substring(0,oldMaxRAM.length-1))
    Array.from(sEls).map((v, index, arr) => {
        const cVal = v.getAttribute('settingValue')
        const serverDependent = v.hasAttribute('serverDependent') // Means the first argument is the server id.
        const sFn = ConfigManager['set' + cVal]
        const sFnOpts = []
        if(serverDependent) {
            sFnOpts.push(serverId)
        }
        if(typeof sFn === 'function') {
            if(v.tagName === 'INPUT') {
                if(v.type === 'number' || v.type === 'text') {
                    // Special Conditions
                    if(cVal === 'JVMOptions') {
                        if(!v.value.trim()) {
                            sFnOpts.push([])
                            sFn.apply(null, sFnOpts)
                        } else {
                            sFnOpts.push(v.value.trim().split(/\s+/))
                            sFn.apply(null, sFnOpts)
                        }
                    } else {
                        if(cVal === 'DataDirectory') {
                            let sFnOpts = [v.value]
                            sFn.apply(null, sFnOpts)
                        } else {
                            sFnOpts.push(v.value)
                            sFn.apply(null, sFnOpts)
                        }
                    }
                } else if(v.type === 'range') {
                    if(cVal === 'MinRAM' || cVal === 'MaxRAM') {
                        let val = v.value
                        val = Math.floor(val*1024) + 'M'
                        sFnOpts.push(val)
                        sFn.apply(null, sFnOpts)
                    }
                }
            } else if(v.tagName === 'DIV') {
                if(v.classList.contains('toggle')) {
                    sFnOpts.push(v.getAttribute('value')==="true")
                    sFn.apply(null, sFnOpts)
                    // Special Conditions
                    if(cVal === 'AllowPrerelease') {
                        changeAllowPrerelease(v.getAttribute('value')==="true")
                    }
                }
            }
        }
    })
    let minRAM = ConfigManager.getMinRAM(serverId)
    minRAM = parseInt(minRAM.substring(0,minRAM.length-1))
    let maxRAM = ConfigManager.getMaxRAM(serverId)
    maxRAM = parseInt(maxRAM.substring(0,maxRAM.length-1))
    if(minRAM>maxRAM) {
        if(oldMinRAM!=minRAM) {
            ConfigManager.setMaxRAM(serverId, minRAM+'M')
        } else {
            ConfigManager.setMinRAM(serverId, maxRAM+'M')
        }
    }
    ConfigManager.save()
}

async function openJavaExeDialog() {
    const properties = ['openFile']
    const options = {
        properties
    }
    options.title = Lang.queryJS('settings.fileSelectors.javaExecSelDialogTitle')

    if(process.platform === 'win32') {
        options.filters = [
            { name: Lang.queryJS('settings.fileSelectors.executables'), extensions: ['exe'] },
            { name: Lang.queryJS('settings.fileSelectors.allFiles'), extensions: ['*'] }
        ]
    }

    const res = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), options)
    if(!res.canceled) {
        let inputs = document.querySelectorAll('[settingValue]')
        for(let input of inputs) {
            if(input.getAttribute('settingValue') === 'JavaExecutable') {
                input.value = res.filePaths[0]
            }
        }
        saveSettingsValues()
        initSettingsValues()
    }
}

async function openLauncherRepositoryDialog() {
    const properties = ['openDirectory', 'createDirectory']
    const options = {
        properties
    }
    options.title = Lang.queryJS('settings.fileSelectors.selectDataDirectory')

    const res = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), options)
    if(!res.canceled) {
        let inputs = document.querySelectorAll('[settingValue]')
        for(let input of inputs) {
            if(input.getAttribute('settingValue') === 'DataDirectory') {
                input.value = res.filePaths[0]
            }
        }
        saveSettingsValues()
        initSettingsValues()
    }
}

async function prepareSettings() {
    await initSettingsValues(true)
}

/**
 * Fetches the GitHub atom release feed and parses it for the release notes
 * of the current version. This value is displayed on the UI.
 */
function populateReleaseNotes(){
    $.ajax({
        url: 'https://github.com/GaspardG0001/FlowBlock_mcLauncher/releases.atom',
        success: (data) => {
            const version = 'v' + remote.app.getVersion()
            const entries = $(data).find('entry')
            
            for(let i=0; i<entries.length; i++){
                const entry = $(entries[i])
                let id = entry.find('id').text()
                id = id.substring(id.lastIndexOf('/')+1)

                if(id === version){
                    settingsAboutChangelogTitle.innerHTML = entry.find('title').text()
                    settingsAboutChangelogText.innerHTML = entry.find('content').text()
                    settingsAboutChangelogButton.href = entry.find('link').attr('href')
                }
            }

        },
        timeout: 2500
    }).catch(err => {
        settingsAboutChangelogText.innerHTML = Lang.queryJS('settings.about.releaseNotesFailed')
    })
}

/**
 * Utility method to display version information on the
 * About and Update settings tabs.
 * 
 * @param {string} version The semver version to display.
 * @param {Element} valueElement The value element.
 * @param {Element} titleElement The title element.
 * @param {Element} checkElement The check mark element.
 */
function populateVersionInformation(version, valueElement, titleElement, checkElement){
    valueElement.innerHTML = version
    if(isPrerelease(version)){
        titleElement.innerHTML = Lang.queryJS('settings.about.preReleaseTitle')
        titleElement.style.color = '#ff886d'
        checkElement.style.background = '#ff886d'
    } else {
        titleElement.innerHTML = Lang.queryJS('settings.about.stableReleaseTitle')
        titleElement.style.color = null
        checkElement.style.background = null
    }
}

/**
 * Return whether or not the provided version is a prerelease.
 * 
 * @param {string} version The semver version to test.
 * @returns {boolean} True if the version is a prerelease, otherwise false.
 */
function isPrerelease(version){
    const preRelComp = semver.prerelease(version)
    return preRelComp != null && preRelComp.length > 0
}

/**
 * Update the properties of the update action button.
 * 
 * @param {string} text The new button text.
 * @param {boolean} disabled Optional. Disable or enable the button
 * @param {function} handler Optional. New button event handler.
 */
function settingsUpdateButtonStatus(text, disabled = false, handler = null){
    settingsUpdateActionButton.innerHTML = text
    settingsUpdateActionButton.disabled = disabled
    if(handler != null){
        settingsUpdateActionButton.onclick = handler
    }
}

/**
 * Populate the update tab with relevant information.
 * 
 * @param {Object} data The update data.
 */
function populateSettingsUpdateInformation(data){
    if(data != null){
        settingsUpdateTitle.innerHTML = isPrerelease(data.version) ? Lang.queryJS('settings.updates.newPreReleaseTitle') : Lang.queryJS('settings.updates.newReleaseTitle')
        populateVersionInformation(data.version, settingsUpdateVersionValue, settingsUpdateVersionTitle, settingsUpdateVersionCheck)
        
        if(process.platform === 'darwin'){
            settingsUpdateButtonStatus(Lang.queryJS('settings.updates.downloadButton'), false, () => {
                shell.openExternal(data.darwindownload)
            })
        } else {
            settingsUpdateButtonStatus(Lang.queryJS('settings.updates.downloadingButton'), true)
        }
    } else {
        settingsUpdateTitle.innerHTML = Lang.queryJS('settings.updates.latestVersionTitle')
        populateVersionInformation(remote.app.getVersion(), settingsUpdateVersionValue, settingsUpdateVersionTitle, settingsUpdateVersionCheck)
        settingsUpdateButtonStatus(Lang.queryJS('settings.updates.checkForUpdatesButton'), false, () => {
            if(!isDev){
                ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                settingsUpdateButtonStatus(Lang.queryJS('settings.updates.checkingForUpdatesButton'), true)
            }
        })
    }
}

/**
 * Prepare update tab for display.
 * 
 * @param {Object} data The update data.
 */
function prepareUpdateTab(data = null){
    populateSettingsUpdateInformation(data)
}