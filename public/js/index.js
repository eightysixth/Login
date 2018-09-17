const {ipcRenderer} = require("electron")

function promptLogIn(){
    ipcRenderer.send('prompt-login')
}

function hideStatus(){
    alertItem = document.getElementById("login-alert")
    alertItem.classList.add("hidden")
}

function notifyLoginStatus(success, message){
    alertItem = document.getElementById("login-alert")
    alertItem.className = "alert"
    alertItem.innerHTML = message;
    if (!success){
        alertItem.classList.add("alert-danger")
    } else {
        alertItem.classList.add("alert-success")
    }
}

function logout(){
    hideStatus();
    ipcRenderer.send('wipe-session-data')
}

function getSchedule(){
    ipcRenderer.send('show-schedule')
}

ipcRenderer.on("logged-in", (event, arg) =>{
    // Arg will be user's data
    notifyLoginStatus(true, '<img id="user-img"class="img-circle" width="32" height="32" src="'+arg.img+'">'+
                            " Logged in <b>" + arg.name + "</b>")
})

ipcRenderer.on('login-failed', (event, arg)=>{
    console.log('loginfailed', arg)
    if (arg.errCode != null){
        notifyLoginStatus(false, arg.msg)
        console.log(arg.msg)
    }
})