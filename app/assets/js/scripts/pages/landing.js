function updateAvatar(uuid) {
    let avatarContainers = document.querySelectorAll('[avatar]')
    for(let container of avatarContainers) {
        container.src = `https://nmsr.nickac.dev/fullbody/${uuid}`
    }
}
function updateUsername(displayName) {
    let usernameContainers = document.querySelectorAll('[username]')
    for(let container of usernameContainers) {
        container.innerText = displayName
    }
}

function openLaunchOverlay() {
    let launchOverlay = document.querySelectorAll('[launch_overlay]')
    for(let overlay of launchOverlay) {
        overlay.style=""
    }
}
function closeLaunchOverlay() {
    let launchOverlay = document.querySelectorAll('[launch_overlay]')
    for(let overlay of launchOverlay) {
        overlay.style="display: none;"
    }
}

function updateLaunchText(text) {
    let launchTextContainers = document.querySelectorAll('[launch_text]')
    for(let container of launchTextContainers) {
        container.innerText = text
    }
}
function updateLaunchPercentage(percentage) {
    let launchPercentageContainers = document.querySelectorAll('[launch_percentage]')
    for(let container of launchPercentageContainers) {
        container.style.width = percentage+'%'
    }
}

function updateSelectedAccount(authUser) {
    if(authUser != null) {
        if(authUser.displayName != null) {
            updateUsername(authUser.displayName)
        }
        if(authUser.uuid != null) {
            updateAvatar(authUser.uuid)
        }
    }
}
updateSelectedAccount(ConfigManager.getSelectedAccount())