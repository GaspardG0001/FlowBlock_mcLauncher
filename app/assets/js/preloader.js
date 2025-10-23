const {ipcRenderer}  = require('electron')
const fs             = require('fs-extra')
const os             = require('os')
const path           = require('path')

const ConfigManager  = require('./configmanager')
const { DistroAPI }  = require('./distromanager')
const LangLoader     = require('./langloader')
const { LoggerUtil } = require('helios-core')
const isDev          = require('./isdev')
const AuthManager    = require('./authmanager')
// eslint-disable-next-line no-unused-vars
const { HeliosDistribution } = require('helios-core/common')

const logger = LoggerUtil.getLogger('Preloader')

logger.info('Loading..')

// Function to update loading text
function updateLoadingText(text) {
    const loadingTextElement = document.getElementById('loadingText')
    if (loadingTextElement) {
        loadingTextElement.textContent = text
    }
}

// Load ConfigManager FIRST
ConfigManager.load()

// Yuck!
// TODO Fix this
DistroAPI['commonDir'] = ConfigManager.getCommonDirectory()
DistroAPI['instanceDir'] = ConfigManager.getInstanceDirectory()

// Load Strings BEFORE using them
LangLoader.setupLanguage()

// NOW we can use translations
updateLoadingText(LangLoader.queryJS('preloader.loadingConfig'))

// Function to validate Microsoft account
async function validateMicrosoftAccount() {
    const selectedAcc = ConfigManager.getSelectedAccount()
    
    if(selectedAcc == null) {
        logger.info('No account selected, validation skipped.')
        return true
    }

    updateLoadingText(LangLoader.queryJS('preloader.validatingAccount'))
    logger.info('Validating Microsoft account...')

    try {
        const isValid = await AuthManager.validateSelected()
        
        if(!isValid) {
            logger.warn('Account validation failed, removing invalid account.')
            updateLoadingText(LangLoader.queryJS('preloader.accountInvalid'))
            ConfigManager.removeAuthAccount(selectedAcc.uuid)
            ConfigManager.save()
            return false
        } else {
            logger.info('Account validation successful.')
            updateLoadingText(LangLoader.queryJS('preloader.accountValid'))
            return true
        }
    } catch(error) {
        logger.error('Error during account validation:', error)
        updateLoadingText(LangLoader.queryJS('preloader.accountError'))
        return true // Continue anyway to avoid blocking the launcher
    }
}

// Function to check for updates and block loading if update is available
async function checkForUpdatesBlocking() {
    return new Promise((resolve, reject) => {
        if (isDev) {
            logger.info('Skipping update check in development mode')
            resolve(false)
            return
        }

        updateLoadingText(LangLoader.queryJS('preloader.checkingUpdates'))
        logger.info('Checking for launcher updates...')

        // Initialize auto-updater
        ipcRenderer.send('autoUpdateAction', 'initAutoUpdater', ConfigManager.getAllowPrerelease())

        // Listen for auto-updater events
        const updateHandler = (event, status, info) => {
            switch(status) {
                case 'ready':
                    logger.info('Auto-updater initialized, checking for updates...')
                    ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                    break

                case 'checking-for-update':
                    updateLoadingText(LangLoader.queryJS('preloader.searchingUpdates'))
                    logger.info('Checking for update...')
                    break

                case 'update-not-available':
                    updateLoadingText(LangLoader.queryJS('preloader.launcherUpToDate'))
                    logger.info('No updates available.')
                    setTimeout(() => {
                        ipcRenderer.removeListener('autoUpdateNotification', updateHandler)
                        resolve(false)
                    }, 500)
                    break

                case 'update-available':
                    updateLoadingText(LangLoader.queryJS('preloader.updateAvailable'))
                    logger.info('Update available, downloading...', info)
                    break

                case 'update-downloaded':
                    updateLoadingText(LangLoader.queryJS('preloader.updateDownloaded'))
                    logger.info('Update downloaded, installing...', info)
                    setTimeout(() => {
                        ipcRenderer.removeListener('autoUpdateNotification', updateHandler)
                        ipcRenderer.send('autoUpdateAction', 'installUpdateNow')
                        resolve(true)
                    }, 1000)
                    break

                case 'realerror':
                    logger.error('Error during update check:', info)
                    updateLoadingText(LangLoader.queryJS('preloader.updateError'))
                    setTimeout(() => {
                        ipcRenderer.removeListener('autoUpdateNotification', updateHandler)
                        resolve(false)
                    }, 1000)
                    break
            }
        }

        ipcRenderer.on('autoUpdateNotification', updateHandler)
    })
}

/**
 * 
 * @param {HeliosDistribution} data 
 */
async function onDistroLoad(data){
    if(data != null){
        
        // Resolve the selected server if its value has yet to be set.
        if(ConfigManager.getSelectedServer() == null || data.getServerById(ConfigManager.getSelectedServer()) == null){
            logger.info('Determining default selected server..')
            ConfigManager.setSelectedServer(data.getMainServer().rawServer.id)
            ConfigManager.save()
        }
    }

    // Validate Microsoft account before continuing
    await validateMicrosoftAccount()

    // Check for launcher updates before continuing (blocking)
    await checkForUpdatesBlocking()

    ipcRenderer.send('distributionIndexDone', data != null)
}

// Ensure Distribution is downloaded and cached.
updateLoadingText(LangLoader.queryJS('preloader.downloadingDistribution'))
DistroAPI.getDistribution()
    .then(async heliosDistro => {
        logger.info('Loaded distribution index.')
        updateLoadingText(LangLoader.queryJS('preloader.distributionLoaded'))

        await onDistroLoad(heliosDistro)
    })
    .catch(async err => {
        logger.info('Failed to load an older version of the distribution index.')
        logger.info('Application cannot run.')
        logger.error(err)
        updateLoadingText(LangLoader.queryJS('preloader.distributionError'))

        await onDistroLoad(null)
    })

// Clean up temp dir incase previous launches ended unexpectedly. 
updateLoadingText(LangLoader.queryJS('preloader.cleaningTemp'))
fs.remove(path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
    if(err){
        logger.warn('Error while cleaning natives directory', err)
    } else {
        logger.info('Cleaned natives directory.')
    }
})