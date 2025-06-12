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